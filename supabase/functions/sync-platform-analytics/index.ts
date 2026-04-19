/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Fetch all published posts that have an external_post_id (needed for API calls)
  const { data: posts, error: postsError } = await supabase
    .from("posts")
    .select(
      "id, workspace_id, platform, external_post_id, social_account_id, published_at",
    )
    .eq("status", "published")
    .not("external_post_id", "is", null);

  if (postsError) {
    return new Response(JSON.stringify({ error: postsError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const results: {
    postId: string;
    platform: string;
    success: boolean;
    error?: string;
  }[] = [];

  for (const post of posts ?? []) {
    try {
      // Fetch access token from credential_vault
      const { data: vault } = await supabase
        .from("credential_vault")
        .select("encrypted_value")
        .eq("workspace_id", post.workspace_id)
        .eq("service", post.platform)
        .eq("name", "access_token")
        .maybeSingle();

      if (!vault) {
        results.push({
          postId: post.id,
          platform: post.platform,
          success: false,
          error: "No access token in vault",
        });
        continue;
      }

      const accessToken = vault.encrypted_value;
      let metrics: Record<string, number> = {};

      if (post.platform === "instagram") {
        metrics = await fetchInstagramMetrics(
          post.external_post_id!,
          accessToken,
        );
      } else if (post.platform === "pinterest") {
        metrics = await fetchPinterestMetrics(
          post.external_post_id!,
          accessToken,
        );
      }

      const impressions = metrics.impressions ?? 0;
      const likes = metrics.likes ?? 0;
      const comments = metrics.comments ?? 0;
      const saves = metrics.saves ?? 0;
      const shares = metrics.shares ?? 0;
      const outbound_clicks = metrics.outbound_clicks ?? 0;

      const engagement =
        impressions > 0 ? (likes + comments + saves + shares) / impressions : 0;

      // Upsert — one row per post+date snapshot
      const capturedAt = new Date().toISOString();
      await supabase.from("platform_metrics").upsert(
        {
          post_id: post.id,
          platform: post.platform,
          captured_at: capturedAt,
          impressions,
          likes,
          comments,
          saves,
          shares,
          outbound_clicks,
          reach: metrics.reach ?? null,
          engagement_rate: engagement,
        },
        { onConflict: "post_id" },
      );

      await supabase.from("audit_logs").insert({
        workspace_id: post.workspace_id,
        entity_type: "platform_metrics",
        entity_id: post.id,
        action: "metrics.synced",
        metadata: {
          platform: post.platform,
          impressions,
          engagement_rate: engagement,
        },
      });

      results.push({ postId: post.id, platform: post.platform, success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        postId: post.id,
        platform: post.platform,
        success: false,
        error: message,
      });
    }
  }

  return new Response(
    JSON.stringify({ ok: true, synced: results.length, results }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
});

// ─── Instagram Graph API ──────────────────────────────────────────────────────

async function fetchInstagramMetrics(
  mediaId: string,
  accessToken: string,
): Promise<Record<string, number>> {
  const fields =
    "impressions,reach,likes_count,comments_count,saves,shares,total_interactions";
  const url = `https://graph.instagram.com/v19.0/${mediaId}/insights?metric=${fields}&access_token=${accessToken}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Instagram API error: ${res.status} ${body}`);
  }
  const json = await res.json();

  const out: Record<string, number> = {};
  for (const item of json?.data ?? []) {
    switch (item.name) {
      case "impressions":
        out.impressions = item.values?.[0]?.value ?? item.value ?? 0;
        break;
      case "reach":
        out.reach = item.values?.[0]?.value ?? item.value ?? 0;
        break;
      case "likes_count":
        out.likes = item.values?.[0]?.value ?? item.value ?? 0;
        break;
      case "comments_count":
        out.comments = item.values?.[0]?.value ?? item.value ?? 0;
        break;
      case "saves":
        out.saves = item.values?.[0]?.value ?? item.value ?? 0;
        break;
      case "shares":
        out.shares = item.values?.[0]?.value ?? item.value ?? 0;
        break;
    }
  }
  return out;
}

// ─── Pinterest Analytics API ──────────────────────────────────────────────────

async function fetchPinterestMetrics(
  pinId: string,
  accessToken: string,
): Promise<Record<string, number>> {
  const url = `https://api.pinterest.com/v5/pins/${pinId}/analytics?metric_types=IMPRESSION,SAVE,PIN_CLICK,OUTBOUND_CLICK,ENGAGEMENT`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Pinterest API error: ${res.status} ${body}`);
  }
  const json = await res.json();

  const summary = json?.all?.summary_metrics ?? {};
  return {
    impressions: summary.IMPRESSION ?? 0,
    saves: summary.SAVE ?? 0,
    outbound_clicks: summary.OUTBOUND_CLICK ?? 0,
    likes: summary.PIN_CLICK ?? 0, // Pinterest doesn't have likes; use pin clicks
    comments: 0,
    shares: 0,
    reach: summary.IMPRESSION ?? 0,
  };
}
