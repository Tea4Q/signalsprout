/**
 * publish-instagram — Processes queued Instagram publish jobs.
 *
 * Supports two media types:
 *   image  → standard feed post (IMAGE container)
 *   video  → Instagram Reels    (REELS container)
 *
 * Reels flow:
 *   1. POST /{ig-user-id}/media  (media_type=REELS, video_url=signed-url)
 *   2. Poll GET /{container-id}?fields=status_code every 5 s until FINISHED
 *   3. POST /{ig-user-id}/media_publish
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MAX_ATTEMPTS = 3;
const IG_BASE = "https://graph.facebook.com/v21.0";
/** Polls container status up to this many times (5 s each → 2 min max). */
const MAX_CONTAINER_POLLS = 24;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (_req: Request) => {
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Fetch queued Instagram jobs that are due
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
    .eq("posts.platform", "instagram");

  if (jobsError) {
    console.error("Failed to fetch jobs:", jobsError.message);
    return new Response(JSON.stringify({ error: jobsError.message }), {
      status: 500,
    });
  }

  const results: { job_id: string; success: boolean; error?: string }[] = [];

  for (const job of jobs ?? []) {
    const post = job.posts as Record<string, unknown> | null;
    if (!post) continue;

    // Mark as publishing
    await serviceClient
      .from("publish_jobs")
      .update({ status: "publishing" })
      .eq("id", job.id);

    try {
      // Fetch social account credentials from credential_vault
      const socialAccountId = post.social_account_id as string | null;
      if (!socialAccountId) throw new Error("No social account linked to post");

      const { data: account } = await serviceClient
        .from("social_accounts")
        .select("external_account_id, account_identifier, access_token")
        .eq("id", socialAccountId)
        .single();

      if (!account) throw new Error("Social account not found");
      if (!account.access_token) throw new Error("Instagram access token missing on social account");

      const accessToken = account.access_token;
      const igUserId = account.external_account_id;
      if (!igUserId)
        throw new Error("Instagram user ID not configured on social account");

      // Get primary asset (first by sort_order)
      const postAssets =
        (post.post_assets as Array<{
          sort_order: number;
          assets: { file_path: string; mime_type: string | null } | null;
        }> | null) ?? [];
      postAssets.sort((a, b) => a.sort_order - b.sort_order);
      const primaryAsset = postAssets[0]?.assets;

      if (!primaryAsset) {
        throw new Error("Instagram posts require at least one media asset");
      }

      // Build caption with hashtags
      const hashtags = (post.hashtags as string[] | null) ?? [];
      const captionText = [post.caption as string, hashtags.join(" ")]
        .filter(Boolean)
        .join("\n\n");

      const { data: urlData } = await serviceClient.storage
        .from("assets")
        .createSignedUrl(primaryAsset.file_path, 3600);
      if (!urlData?.signedUrl) {
        throw new Error("Failed to generate signed URL for media asset");
      }
      const signedUrl = urlData.signedUrl;

      const isVideo = (post.media_type as string) === "video";

      // ── Step 1: Create media container ──────────────────────────────────
      const containerParams = new URLSearchParams({
        caption: captionText,
        access_token: accessToken,
      });

      if (isVideo) {
        containerParams.set("media_type", "REELS");
        containerParams.set("video_url", signedUrl);
        containerParams.set("share_to_feed", "true");
      } else {
        containerParams.set("media_type", "IMAGE");
        containerParams.set("image_url", signedUrl);
      }

      const containerRes = await fetch(
        `${IG_BASE}/${igUserId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: containerParams.toString(),
        },
      );
      const containerData = await containerRes.json();
      if (!containerRes.ok || !containerData.id) {
        throw new Error(
          containerData.error?.message ??
            "Failed to create Instagram media container",
        );
      }
      const containerId = containerData.id as string;

      // ── Step 1b: For Reels, poll until container is FINISHED ─────────────
      if (isVideo) {
        let containerReady = false;
        for (let i = 0; i < MAX_CONTAINER_POLLS; i++) {
          await sleep(5_000);
          const statusRes = await fetch(
            `${IG_BASE}/${containerId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`,
          );
          const statusData = await statusRes.json();
          const code = statusData?.status_code as string | undefined;
          if (code === "FINISHED") {
            containerReady = true;
            break;
          }
          if (code === "ERROR") {
            throw new Error(
              `Instagram Reels container processing failed: ${statusData?.status ?? "unknown error"}`,
            );
          }
          // IN_PROGRESS / PUBLISHED — keep polling
        }
        if (!containerReady) {
          throw new Error(
            "Instagram Reels container did not finish processing within 2 minutes",
          );
        }
      }

      // ── Step 2: Publish container ────────────────────────────────────────
      const publishRes = await fetch(
        `${IG_BASE}/${igUserId}/media_publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            creation_id: containerId,
            access_token: accessToken,
          }).toString(),
        },
      );
      const publishData = await publishRes.json();
      if (!publishRes.ok || !publishData.id) {
        throw new Error(
          publishData.error?.message ?? "Failed to publish Instagram post",
        );
      }

      // Success
      const now = new Date().toISOString();
      await Promise.all([
        serviceClient
          .from("posts")
          .update({
            status: "published",
            published_at: now,
            external_post_id: publishData.id,
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
            platform: "instagram",
            media_type: post.media_type as string,
            external_post_id: publishData.id,
            publish_job_id: job.id,
          },
        }),
      ]);

      results.push({ job_id: job.id, success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
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
              .update({
                status: "failed",
                failure_reason: message,
              })
              .eq("id", (job.posts as Record<string, unknown>)?.id as string)
          : Promise.resolve(),
        serviceClient.from("audit_logs").insert({
          workspace_id: (job.posts as Record<string, unknown>)
            ?.workspace_id as string,
          action: "post.publish_failed",
          entity_type: "post",
          entity_id: (job.posts as Record<string, unknown>)?.id as string,
          metadata: {
            platform: "instagram",
            error: message,
            attempt: newAttemptCount,
            publish_job_id: job.id,
          },
        }),
      ]);

      results.push({ job_id: job.id, success: false, error: message });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
