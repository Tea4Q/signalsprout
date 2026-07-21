/**
 * publish-facebook — Processes queued Facebook Page publish jobs.
 *
 * Called by the Inngest `publish-scheduled-post` function after sleeping
 * until the post's scheduled_for time.  Also called directly by publish-now.
 *
 * Flow per job:
 *  1. Fetch Page access token from social_accounts (stored at OAuth time).
 *  2. If post has an image → POST to /{page_id}/photos  (creates photo post).
 *     If no image        → POST to /{page_id}/feed      (creates text post).
 *  4. Update posts, publish_jobs, and audit_logs.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MAX_ATTEMPTS = 3;
const GRAPH_VERSION = "v21.0";

Deno.serve(async (_req: Request) => {
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── Fetch queued Facebook jobs that are due ───────────────────────────────

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
        social_account_id,
        post_assets ( asset_id, sort_order, assets ( file_path ) )
      )
    `,
    )
    .eq("status", "queued")
    .lte("run_at", new Date().toISOString())
    .eq("posts.platform", "facebook");

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
      if (!account.access_token) throw new Error("Facebook access token missing on social account");

      let pageId = account.external_account_id as string | null;
      if (!pageId) throw new Error("Facebook Page ID not configured on social account");
      let pageAccessToken = account.access_token as string;

      // Self-heal old connections that stored a User Access Token by resolving
      // the correct page token from /me/accounts and persisting it.
      const accountsRes = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/me/accounts?access_token=${encodeURIComponent(pageAccessToken)}`,
      );
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        const pages: { id: string; name: string; access_token: string }[] = accountsData.data ?? [];
        if (pages.length > 0) {
          const matched = pages.find((p) => p.id === pageId);
          if (!matched) {
            throw new Error(
              `Facebook Page ${pageId} not found in the connected user's pages. ` +
              "Ensure the account has admin access to the page and the page ID is correct.",
            );
          }

          pageId = matched.id;
          pageAccessToken = matched.access_token;

          await serviceClient
            .from("social_accounts")
            .update({
              access_token: pageAccessToken,
              external_account_id: pageId,
              account_identifier: pageId,
              account_name: matched.name,
            })
            .eq("id", socialAccountId);
        }
      }

      // ── Build caption text ────────────────────────────────────────────────

      const hashtags = (post.hashtags as string[] | null) ?? [];
      const captionText = [post.caption as string, hashtags.join(" ")]
        .filter(Boolean)
        .join("\n\n");

      // ── Get primary image (if any) ────────────────────────────────────────

      const postAssets =
        (post.post_assets as {
          sort_order: number;
          assets: { file_path: string } | null;
        }[] | null) ?? [];
      postAssets.sort((a, b) => a.sort_order - b.sort_order);
      const primaryAsset = postAssets[0]?.assets;

      let externalPostId: string;

      if (primaryAsset) {
        // ── Photo post: POST /{page_id}/photos ────────────────────────────

        const { data: urlData } = await serviceClient.storage
          .from("assets")
          .createSignedUrl(primaryAsset.file_path, 3600);

        if (!urlData?.signedUrl) {
          throw new Error("Failed to generate signed URL for post asset");
        }

        const photoParams = new URLSearchParams({
          message: captionText,
          url: urlData.signedUrl,
          access_token: pageAccessToken,
        });

        const photoRes = await fetch(
          `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/photos`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: photoParams.toString(),
          },
        );
        const photoData = await photoRes.json();

        if (!photoRes.ok || !photoData.post_id) {
          if (photoData.error?.code === 200) {
            throw new Error(
              "Facebook permissions error: the stored Page access token is missing pages_manage_posts. " +
              "Please disconnect and reconnect Facebook, then approve all permissions.",
            );
          }
          throw new Error(
            photoData.error?.message ?? "Failed to publish photo to Facebook Page",
          );
        }

        // Facebook returns { id: "photo_id", post_id: "post_id" }
        // We store the post_id so it can be linked to insights later.
        externalPostId = photoData.post_id as string;
      } else {
        // ── Text post: POST /{page_id}/feed ───────────────────────────────

        const feedParams = new URLSearchParams({
          message: captionText,
          access_token: pageAccessToken,
        });

        const feedRes = await fetch(
          `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/feed`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: feedParams.toString(),
          },
        );
        const feedData = await feedRes.json();

        if (!feedRes.ok || !feedData.id) {
          if (feedData.error?.code === 200) {
            throw new Error(
              "Facebook permissions error: the stored Page access token is missing pages_manage_posts. " +
              "Please disconnect and reconnect Facebook, then approve all permissions.",
            );
          }
          throw new Error(
            feedData.error?.message ?? "Failed to publish post to Facebook Page feed",
          );
        }

        externalPostId = feedData.id as string;
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
            platform: "facebook",
            external_post_id: externalPostId,
            publish_job_id: job.id,
          },
        }),
      ]);

      results.push({ job_id: job.id, success: true });
    } catch (err: unknown) {
      // ── Failure: increment attempt or mark failed ─────────────────────────

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
            platform: "facebook",
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
