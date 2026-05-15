/**
 * publish-now — Immediately publishes a single post to its platform.
 *
 * POST { post_id: string }
 * Returns { success: true, external_post_id: string }
 *       | { error: string }
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // User-scoped client for ownership check (RLS)
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    // Service-role client for credential vault, storage, and writes
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { post_id } = await req.json() as { post_id: string };
    if (!post_id) {
      return new Response(JSON.stringify({ error: "post_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller can access this post (RLS)
    const { data: post, error: postErr } = await userClient
      .from("posts")
      .select(
        `id, workspace_id, brand_id, platform, caption, hashtags, hook, title,
         destination_url, social_account_id,
         post_assets ( asset_id, sort_order, assets ( file_path ) )`,
      )
      .eq("id", post_id)
      .single();

    if (postErr || !post) {
      return new Response(
        JSON.stringify({ error: "Post not found or access denied" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!post.social_account_id) {
      return new Response(
        JSON.stringify({ error: "No social account linked to this post. Link one in Social Accounts first." }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: account } = await svc
      .from("social_accounts")
      .select("external_account_id, account_identifier")
      .eq("id", post.social_account_id)
      .single();

    if (!account) {
      return new Response(JSON.stringify({ error: "Social account not found" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve primary image
    const postAssets = (
      post.post_assets as Array<{
        sort_order: number;
        assets: { file_path: string } | null;
      }> | null
    ) ?? [];
    postAssets.sort((a, b) => a.sort_order - b.sort_order);
    const primaryAsset = postAssets[0]?.assets ?? null;

    // Build caption text
    const hashtags = (post.hashtags as string[] | null) ?? [];
    const captionText = [post.caption, hashtags.join(" ")]
      .filter(Boolean)
      .join("\n\n");

    const now = new Date().toISOString();
    let externalPostId: string;

    // ── Instagram ─────────────────────────────────────────────────────────────
    if (post.platform === "instagram") {
      const { data: vault } = await svc
        .from("credential_vault")
        .select("encrypted_value")
        .eq("workspace_id", post.workspace_id)
        .eq("service", "instagram")
        .eq("name", "access_token")
        .maybeSingle();

      if (!vault) {
        return new Response(
          JSON.stringify({ error: "Instagram access token not found in vault" }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const accessToken = vault.encrypted_value;
      const igUserId = account.external_account_id;
      if (!igUserId) {
        return new Response(
          JSON.stringify({ error: "Instagram user ID not configured on social account" }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!primaryAsset) {
        return new Response(
          JSON.stringify({ error: "Instagram posts require an image" }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: urlData } = await svc.storage
        .from("assets")
        .createSignedUrl(primaryAsset.file_path, 3600);

      if (!urlData?.signedUrl) {
        return new Response(
          JSON.stringify({ error: "Could not generate signed URL for asset" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const containerParams = new URLSearchParams({
        caption: captionText,
        image_url: urlData.signedUrl,
        media_type: "IMAGE",
        access_token: accessToken,
      });

      const containerRes = await fetch(
        `https://graph.instagram.com/v19.0/${igUserId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: containerParams.toString(),
        },
      );
      const containerData = await containerRes.json();
      if (!containerRes.ok || !containerData.id) {
        throw new Error(
          containerData.error?.message ?? "Failed to create Instagram media container",
        );
      }

      const publishRes = await fetch(
        `https://graph.instagram.com/v19.0/${igUserId}/media_publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            creation_id: containerData.id,
            access_token: accessToken,
          }).toString(),
        },
      );
      const publishData = await publishRes.json();
      if (!publishRes.ok || !publishData.id) {
        throw new Error(publishData.error?.message ?? "Failed to publish Instagram post");
      }

      externalPostId = publishData.id;

    // ── Pinterest ─────────────────────────────────────────────────────────────
    } else if (post.platform === "pinterest") {
      const { data: vault } = await svc
        .from("credential_vault")
        .select("encrypted_value")
        .eq("workspace_id", post.workspace_id)
        .eq("service", "pinterest")
        .eq("name", "access_token")
        .maybeSingle();

      if (!vault) {
        return new Response(
          JSON.stringify({ error: "Pinterest access token not found in vault" }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const accessToken = vault.encrypted_value;
      const boardId = account.account_identifier;
      if (!boardId) {
        return new Response(
          JSON.stringify({ error: "Pinterest board ID not configured on social account" }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!primaryAsset) {
        return new Response(
          JSON.stringify({ error: "Pinterest pins require an image" }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: urlData } = await svc.storage
        .from("assets")
        .createSignedUrl(primaryAsset.file_path, 3600);

      if (!urlData?.signedUrl) {
        return new Response(
          JSON.stringify({ error: "Could not generate signed URL for asset" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const pinBody: Record<string, unknown> = {
        board_id: boardId,
        description: captionText,
        media_source: { source_type: "image_url", url: urlData.signedUrl },
      };
      if (post.title) pinBody.title = post.title;
      if (post.destination_url) pinBody.link = post.destination_url;

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
        throw new Error(pinData.message ?? pinData.code ?? "Failed to create Pinterest pin");
      }

      externalPostId = pinData.id;

    } else {
      return new Response(
        JSON.stringify({ error: `Platform "${post.platform}" does not support Publish Now yet` }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Mark published & audit ────────────────────────────────────────────────
    await Promise.all([
      svc
        .from("posts")
        .update({ status: "published", published_at: now, external_post_id: externalPostId })
        .eq("id", post_id),
      svc.from("audit_logs").insert({
        workspace_id: post.workspace_id,
        action: "post.published",
        entity_type: "post",
        entity_id: post_id,
        metadata: { platform: post.platform, external_post_id: externalPostId, mode: "publish_now" },
      }),
    ]);

    // Fire post/published Inngest event for observability and downstream processing.
    // Non-blocking: a delivery failure does not fail the publish operation.
    const inngestEventKey = Deno.env.get("INNGEST_EVENT_KEY");
    if (inngestEventKey) {
      fetch(`https://inn.gs/e/${inngestEventKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "post/published",
          data: {
            post_id,
            platform: post.platform,
            external_post_id: externalPostId,
            mode: "publish_now",
          },
        }),
      }).catch((err) =>
        console.warn("Inngest post/published event failed (non-fatal):", err),
      );
    }

    return new Response(
      JSON.stringify({ success: true, external_post_id: externalPostId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
