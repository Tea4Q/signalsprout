import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MAX_ATTEMPTS = 3;

Deno.serve(async (_req: Request) => {
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Fetch queued Pinterest jobs that are due
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
        title,
        destination_url,
        social_account_id,
        post_assets ( asset_id, sort_order, assets ( file_path ) )
      )
    `,
    )
    .eq("status", "queued")
    .lte("run_at", new Date().toISOString())
    .eq("posts.platform", "pinterest");

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
      const socialAccountId = post.social_account_id as string | null;
      if (!socialAccountId) throw new Error("No social account linked to post");

      const { data: account } = await serviceClient
        .from("social_accounts")
        .select("external_account_id, account_identifier")
        .eq("id", socialAccountId)
        .single();

      if (!account) throw new Error("Social account not found");

      // account_identifier holds the Pinterest board ID
      const boardId = account.account_identifier;
      if (!boardId)
        throw new Error("Pinterest board ID not configured on social account");

      // Retrieve access token from credential_vault
      const { data: vault } = await serviceClient
        .from("credential_vault")
        .select("encrypted_value")
        .eq("workspace_id", post.workspace_id as string)
        .eq("service", "pinterest")
        .eq("name", "access_token")
        .maybeSingle();

      if (!vault) throw new Error("Pinterest access token not found in vault");

      const accessToken = vault.encrypted_value;

      // Get primary image URL
      const postAssets =
        (post.post_assets as Array<{
          sort_order: number;
          assets: { file_path: string } | null;
        }> | null) ?? [];
      postAssets.sort((a, b) => a.sort_order - b.sort_order);
      const primaryAsset = postAssets[0]?.assets;

      if (!primaryAsset) throw new Error("Pinterest pins require an image");

      const { data: urlData } = await serviceClient.storage
        .from("assets")
        .createSignedUrl(primaryAsset.file_path, 3600);
      if (!urlData?.signedUrl)
        throw new Error("Could not generate signed URL for asset");

      const hashtags = (post.hashtags as string[] | null) ?? [];
      const description = [post.caption as string, hashtags.join(" ")]
        .filter(Boolean)
        .join("\n\n");

      // ── Pinterest API v5 /pins ──
      const pinBody: Record<string, unknown> = {
        board_id: boardId,
        title: (post.title as string | null) ?? undefined,
        description,
        media_source: {
          source_type: "image_url",
          url: urlData.signedUrl,
        },
      };

      if (post.destination_url) {
        pinBody.link = post.destination_url;
      }

      const pinRes = await fetch("https://api.pinterest.com/v5/pins", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pinBody),
      });

      const pinData = await pinRes.json();
      if (!pinRes.ok || !pinData.id) {
        throw new Error(
          pinData.message ?? pinData.code ?? "Failed to create Pinterest pin",
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
            external_post_id: pinData.id,
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
            platform: "pinterest",
            external_post_id: pinData.id,
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
            platform: "pinterest",
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
