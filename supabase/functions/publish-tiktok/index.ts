/**
 * publish-tiktok — Processes queued TikTok publish jobs.
 *
 * Called by the Inngest `publish-scheduled-post` function after sleeping
 * until the post's scheduled_for time.  Also called directly by publish-now.
 *
 * Supports two media types via the TikTok Content Posting API v2:
 *   image  → PHOTO  (up to 35 images, PULL_FROM_URL carousel)
 *   video  → VIDEO  (single file, PULL_FROM_URL)
 *
 * ⚠️  SANDBOX NOTE: The Content Posting API requires TikTok app review before
 *     production use.  Until approved, only the developer's own TikTok account
 *     can receive posts.  Request access at:
 *     https://developers.tiktok.com/products/content-posting-api/
 *
 * Flow per job:
 *  1. Fetch access token from social_accounts.
 *  2. Get signed URL(s) for the post asset(s) from Supabase Storage.
 *  3. POST /v2/post/publish/content/init/ to initiate the post.
 *  4. Poll /v2/post/publish/status/fetch/ until PUBLISH_COMPLETE or FAILED.
 *  5. Update posts, publish_jobs, and audit_logs.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MAX_ATTEMPTS = 3;
const TIKTOK_BASE = "https://open.tiktokapis.com/v2";
/** Polls up to this many times before treating the publish as best-effort. */
const MAX_POLLS = 5;
const POLL_INTERVAL_MS = 3_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (_req: Request) => {
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── Fetch queued TikTok jobs that are due ─────────────────────────────────

  const { data: jobs, error: jobsError } = await serviceClient
    .from("publish_jobs")
    .select(
      `
      id,
      post_id,
      attempt_count,
      posts (
        id,
        workspace_id,
        brand_id,
        platform,
        caption,
        hashtags,
        hook,
        media_type,
        social_account_id,
        post_assets ( asset_id, sort_order, assets ( file_path, mime_type ) )
      )
    `,
    )
    .eq("status", "queued")
    .lte("run_at", new Date().toISOString())
    .eq("posts.platform", "tiktok");

  if (jobsError) {
    console.error("Failed to fetch jobs:", jobsError.message);
    return new Response(JSON.stringify({ error: jobsError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const results: { job_id: string; success: boolean; error?: string }[] = [];

  for (const job of jobs ?? []) {
    const post = job.posts as Record<string, unknown> | null;
    if (!post) continue;

    // Mark job as in-flight so duplicate runs skip it
    await serviceClient
      .from("publish_jobs")
      .update({ status: "publishing" })
      .eq("id", job.id);

    try {
      // ── Fetch social account credentials ──────────────────────────────────

      const socialAccountId = post.social_account_id as string | null;
      if (!socialAccountId) throw new Error("No social account linked to post");

      const { data: account } = await serviceClient
        .from("social_accounts")
        .select("external_account_id, account_identifier, access_token")
        .eq("id", socialAccountId)
        .single();

      if (!account) throw new Error("Social account not found");
      if (!account.access_token)
        throw new Error("TikTok access token missing on social account");

      const accessToken = account.access_token as string;

      // ── Build caption text (TikTok title field, max 2 200 chars) ──────────

      const hashtags = (post.hashtags as string[] | null) ?? [];
      const captionParts = [
        post.hook as string | undefined,
        post.caption as string | undefined,
        hashtags.join(" "),
      ].filter(Boolean);
      const captionText = captionParts.join(" ").slice(0, 2_200);

      // ── Gather asset(s) from storage ──────────────────────────────────────

      const postAssets =
        (post.post_assets as Array<{
          sort_order: number;
          assets: { file_path: string; mime_type: string | null } | null;
        }> | null) ?? [];
      postAssets.sort((a, b) => a.sort_order - b.sort_order);

      if (postAssets.length === 0) {
        throw new Error("TikTok posts require at least one media asset");
      }

      const isVideo = (post.media_type as string) === "video";

      // ── Build source_info based on media type ─────────────────────────────

      let sourceInfo: Record<string, unknown>;
      let tiktokMediaType: "PHOTO" | "VIDEO";

      if (isVideo) {
        // Video: single file via PULL_FROM_URL
        const primaryAsset = postAssets[0]?.assets;
        if (!primaryAsset) throw new Error("No video asset found on post");
        const { data: urlData } = await serviceClient.storage
          .from("assets")
          .createSignedUrl(primaryAsset.file_path, 3_600);
        if (!urlData?.signedUrl) {
          throw new Error(
            `Failed to generate signed URL for video asset: ${primaryAsset.file_path}`,
          );
        }
        sourceInfo = { source: "PULL_FROM_URL", video_url: urlData.signedUrl };
        tiktokMediaType = "VIDEO";
      } else {
        // Photo carousel: up to 35 images
        const photoImages: string[] = [];
        for (const pa of postAssets) {
          if (!pa.assets) continue;
          const { data: urlData } = await serviceClient.storage
            .from("assets")
            .createSignedUrl(pa.assets.file_path, 3_600);
          if (!urlData?.signedUrl) {
            throw new Error(
              `Failed to generate signed URL for asset: ${pa.assets.file_path}`,
            );
          }
          photoImages.push(urlData.signedUrl);
          if (photoImages.length >= 35) break;
        }
        sourceInfo = {
          source: "PULL_FROM_URL",
          photo_images: photoImages,
          photo_cover_index: 0,
        };
        tiktokMediaType = "PHOTO";
      }

      // ── Initiate post via Content Posting API v2 ──────────────────────────

      const initRes = await fetch(`${TIKTOK_BASE}/post/publish/content/init/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
          post_info: {
            title: captionText,
            privacy_level: "PUBLIC_TO_EVERYONE",
            disable_comment: false,
          },
          source_info: sourceInfo,
          post_mode: "DIRECT_POST",
          media_type: tiktokMediaType,
        }),
      });

      const initData = await initRes.json();

      if (!initRes.ok || initData.error?.code !== "ok") {
        throw new Error(
          initData.error?.message ?? "Failed to initiate TikTok post",
        );
      }

      const publishId = initData.data?.publish_id as string | undefined;
      if (!publishId) throw new Error("TikTok did not return a publish_id");

      // ── Poll for publish completion (PULL_FROM_URL is async on TikTok) ────

      let externalPostId: string = publishId; // fallback if polls time out
      for (let i = 0; i < MAX_POLLS; i++) {
        await sleep(POLL_INTERVAL_MS);

        const statusRes = await fetch(
          `${TIKTOK_BASE}/post/publish/status/fetch/`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json; charset=UTF-8",
            },
            body: JSON.stringify({ publish_id: publishId }),
          },
        );
        const statusData = await statusRes.json();

        if (!statusRes.ok) {
          // Non-fatal: log and keep polling
          console.warn(
            "TikTok status poll failed:",
            statusData.error?.message ?? statusRes.status,
          );
          continue;
        }

        const status = statusData.data?.status as string | undefined;

        if (status === "PUBLISH_COMPLETE") {
          // TikTok returns publicaly_available_post_id (their typo, not ours)
          const ids = statusData.data
            ?.publicaly_available_post_id as string[] | undefined;
          externalPostId = ids?.[0] ?? publishId;
          break;
        }

        if (status === "FAILED") {
          throw new Error(
            statusData.data?.fail_reason ?? "TikTok post failed during processing",
          );
        }

        // PROCESSING_DOWNLOAD / PROCESSING_UPLOAD → keep polling
      }

      // ── Success: update records ───────────────────────────────────────────

      const now = new Date().toISOString();
      await Promise.all([
        serviceClient
          .from("posts")
          .update({
            status: "published",
            published_at: now,
            external_post_id: externalPostId,
          })
          .eq("id", post.id as string),
        serviceClient
          .from("publish_jobs")
          .update({ status: "done", updated_at: now })
          .eq("id", job.id),
        serviceClient.from("audit_logs").insert({
          workspace_id: post.workspace_id as string,
          action: "post.published",
          entity_type: "post",
          entity_id: post.id as string,
          metadata: {
            platform: "tiktok",
            media_type: post.media_type as string,
            publish_id: publishId,
            external_post_id: externalPostId,
            publish_job_id: job.id,
          },
        }),
      ]);

      results.push({ job_id: job.id, success: true });
    } catch (err: unknown) {
      // ── Failure: increment attempt or mark permanently failed ─────────────

      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`Job ${job.id} failed:`, message);

      const newAttemptCount = (job.attempt_count ?? 0) + 1;
      const failed = newAttemptCount >= MAX_ATTEMPTS;

      await Promise.all([
        serviceClient
          .from("publish_jobs")
          .update({
            status: failed ? "failed" : "queued",
            attempt_count: newAttemptCount,
            last_error: message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id),
        failed
          ? serviceClient
              .from("posts")
              .update({ status: "failed", failure_reason: message })
              .eq("id", (job.posts as Record<string, unknown>)?.id as string)
          : Promise.resolve(),
        serviceClient.from("audit_logs").insert({
          workspace_id: (job.posts as Record<string, unknown>)
            ?.workspace_id as string,
          action: "post.publish_failed",
          entity_type: "post",
          entity_id: (job.posts as Record<string, unknown>)?.id as string,
          metadata: {
            platform: "tiktok",
            error: message,
            attempt: newAttemptCount,
            publish_job_id: job.id,
          },
        }),
      ]);

      results.push({ job_id: job.id, success: false, error: message });
    }
  }

  return new Response(
    JSON.stringify({ processed: results.length, results }),
    { headers: { "Content-Type": "application/json" } },
  );
});
