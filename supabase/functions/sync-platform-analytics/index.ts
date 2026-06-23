/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let workspaceId: string | null = null;
  try {
    const body = await req.clone().json() as { workspace_id?: string };
    workspaceId = body.workspace_id ?? null;
  } catch {
    workspaceId = null;
  }

  // Fetch all published posts that have an external_post_id (needed for API calls)
  let postsQuery = supabase
    .from("posts")
    .select(
      "id, workspace_id, platform, external_post_id, social_account_id, published_at",
    )
    .eq("status", "published")
    .not("external_post_id", "is", null);

  if (workspaceId) {
    postsQuery = postsQuery.eq("workspace_id", workspaceId);
  }

  const { data: posts, error: postsError } = await postsQuery;

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
      // Fetch access token from social_accounts (set by oauth-exchange)
      if (!post.social_account_id) {
        results.push({
          postId: post.id,
          platform: post.platform,
          success: false,
          error: "No social account linked to post",
        });
        continue;
      }

      const { data: account } = await supabase
        .from("social_accounts")
        .select("access_token")
        .eq("id", post.social_account_id)
        .single();

      if (!account?.access_token) {
        results.push({
          postId: post.id,
          platform: post.platform,
          success: false,
          error: "No access token on social account",
        });
        continue;
      }

      const accessToken = account.access_token;
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
      } else if (post.platform === "facebook") {
        metrics = await fetchFacebookMetrics(
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
  const out: Record<string, number> = {};

  // Insights endpoint supports impressions/reach/saved.
  const insightsUrl = `https://graph.facebook.com/v20.0/${mediaId}/insights?metric=impressions,reach,saved&access_token=${accessToken}`;
  const insightsRes = await fetch(insightsUrl);
  if (!insightsRes.ok) {
    const body = await insightsRes.text();
    throw new Error(`Instagram insights error: ${insightsRes.status} ${body}`);
  }
  const insightsJson = await insightsRes.json();

  for (const item of insightsJson?.data ?? []) {
    switch (item.name) {
      case "impressions":
        out.impressions = item.values?.[0]?.value ?? item.value ?? 0;
        break;
      case "reach":
        out.reach = item.values?.[0]?.value ?? item.value ?? 0;
        break;
      case "saved":
        out.saves = item.values?.[0]?.value ?? item.value ?? 0;
        break;
    }
  }

  // like_count/comments_count are fetched from the media object, not insights.
  const mediaUrl = `https://graph.facebook.com/v20.0/${mediaId}?fields=like_count,comments_count&access_token=${accessToken}`;
  const mediaRes = await fetch(mediaUrl);
  if (!mediaRes.ok) {
    const body = await mediaRes.text();
    throw new Error(`Instagram media error: ${mediaRes.status} ${body}`);
  }
  const mediaJson = await mediaRes.json();
  out.likes = mediaJson?.like_count ?? 0;
  out.comments = mediaJson?.comments_count ?? 0;

  return out;
}

// ─── Facebook Graph API ─────────────────────────────────────────────────────

async function fetchFacebookMetrics(
  postId: string,
  accessToken: string,
): Promise<Record<string, number>> {
  const metric = [
    "post_impressions",
    "post_impressions_unique",
    "post_engaged_users",
    "post_reactions_by_type_total",
    "post_clicks",
    "post_shares",
  ].join(",");
  const url =
    `https://graph.facebook.com/v21.0/${postId}/insights` +
    `?metric=${metric}&access_token=${encodeURIComponent(accessToken)}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Facebook API error: ${res.status} ${body}`);
  }
  const json = await res.json();

  const out: Record<string, number> = {};
  for (const item of json?.data ?? []) {
    switch (item.name) {
      case "post_impressions":
        out.impressions = item.values?.[0]?.value ?? 0;
        break;
      case "post_impressions_unique":
        out.reach = item.values?.[0]?.value ?? 0;
        break;
      case "post_engaged_users":
        out.likes = item.values?.[0]?.value ?? 0;
        break;
      case "post_reactions_by_type_total": {
        // Sum all reaction types (LIKE, LOVE, WOW, HAHA, SAD, ANGRY)
        const reactions = item.values?.[0]?.value ?? {};
        out.likes = Object.values(reactions as Record<string, number>).reduce(
          (sum, v) => sum + (v ?? 0),
          0,
        );
        break;
      }
      case "post_clicks":
        out.outbound_clicks = item.values?.[0]?.value ?? 0;
        break;
      case "post_shares":
        out.shares = item.values?.[0]?.value ?? 0;
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
