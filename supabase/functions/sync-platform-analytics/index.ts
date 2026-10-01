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

  const postResults: {
    postId: string;
    platform: string;
    success: boolean;
    error?: string;
  }[] = [];

  const accountInsightResults: {
    socialAccountId: string;
    platform: string;
    success: boolean;
    error?: string;
  }[] = [];

  for (const post of posts ?? []) {
    try {
      // Fetch access token from social_accounts (set by oauth-exchange)
      if (!post.social_account_id) {
        postResults.push({
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
        postResults.push({
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

      // Keep each sync as a snapshot; the table has no unique post_id constraint.
      const capturedAt = new Date().toISOString();
      const { error: metricsError } = await supabase
        .from("platform_metrics")
        .insert({
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
        });

      if (metricsError) {
        throw new Error(`Failed to store platform metrics: ${metricsError.message}`);
      }

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

      postResults.push({ postId: post.id, platform: post.platform, success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      postResults.push({
        postId: post.id,
        platform: post.platform,
        success: false,
        error: message,
      });
    }
  }

  // Fetch account-level insights for each supported connected social account.
  let accountQuery = supabase
    .from("social_accounts")
    .select("id, workspace_id, platform, access_token, external_account_id")
    .not("access_token", "is", null)
    .not("external_account_id", "is", null);

  if (workspaceId) {
    accountQuery = accountQuery.eq("workspace_id", workspaceId);
  }

  const { data: socialAccounts, error: accountsError } = await accountQuery;
  if (accountsError) {
    return new Response(JSON.stringify({ error: accountsError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  for (const account of socialAccounts ?? []) {
    try {
      let insight: AccountInsightData;
      if (account.platform === "instagram") {
        insight = await fetchInstagramAccountInsights(
          account.external_account_id!,
          account.access_token!,
        );
      } else if (account.platform === "facebook") {
        insight = await fetchFacebookAccountInsights(
          account.external_account_id!,
          account.access_token!,
        );
      } else if (account.platform === "pinterest") {
        insight = await fetchPinterestAccountInsights(account.access_token!);
      } else {
        continue;
      }

      const capturedAt = new Date().toISOString();
      const capturedDate = capturedAt.slice(0, 10);

      const { data: snapshot, error: snapshotError } = await supabase
        .from("account_insight_snapshots")
        .upsert(
          {
            workspace_id: account.workspace_id,
            social_account_id: account.id,
            platform: account.platform,
            captured_at: capturedAt,
            captured_date: capturedDate,
            views: insight.views,
            accounts_reached: insight.accounts_reached,
            followers_views: insight.followers_views,
            non_followers_views: insight.non_followers_views,
            posts_views: insight.posts_views,
            stories_views: insight.stories_views,
            metadata: insight.metadata,
          },
          { onConflict: "social_account_id,captured_date" },
        )
        .select("id")
        .single();

      if (snapshotError || !snapshot?.id) {
        throw new Error(snapshotError?.message ?? "Failed to upsert account insight snapshot.");
      }

      await supabase
        .from("account_top_content")
        .delete()
        .eq("snapshot_id", snapshot.id);

      if (insight.top_content.length > 0) {
        const payload = insight.top_content.map((item, idx) => ({
          workspace_id: account.workspace_id,
          social_account_id: account.id,
          snapshot_id: snapshot.id,
          platform: account.platform,
          external_media_id: item.external_media_id,
          media_type: item.media_type,
          title: item.title,
          thumbnail_url: item.thumbnail_url,
          permalink: item.permalink,
          posted_at: item.posted_at,
          views: item.views,
          rank: idx + 1,
          metadata: item.metadata,
        }));

        const { error: topContentError } = await supabase
          .from("account_top_content")
          .insert(payload);

        if (topContentError) {
          throw new Error(topContentError.message);
        }
      }

      accountInsightResults.push({
        socialAccountId: account.id,
        platform: account.platform,
        success: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      accountInsightResults.push({
        socialAccountId: account.id,
        platform: account.platform,
        success: false,
        error: message,
      });
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      synced: postResults.length,
      results: postResults,
      account_insights: accountInsightResults,
    }),
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

// ─── Instagram Account Insights ─────────────────────────────────────────────

type AccountTopContentItem = {
  external_media_id: string;
  media_type: string | null;
  title: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  posted_at: string | null;
  views: number;
  metadata: Record<string, unknown>;
};

type AccountInsightData = {
  views: number;
  accounts_reached: number;
  followers_views: number | null;
  non_followers_views: number | null;
  posts_views: number | null;
  stories_views: number | null;
  metadata: Record<string, unknown>;
  top_content: AccountTopContentItem[];
};

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function pickMetricValue(item: any): number {
  const direct = asNumber(item?.value);
  if (direct > 0) return direct;

  const list = Array.isArray(item?.values) ? item.values : [];
  if (list.length > 0) {
    const first = list[0];
    const nested = asNumber(first?.value);
    if (nested > 0) return nested;
  }

  const total = asNumber(item?.total_value?.value);
  if (total > 0) return total;

  return 0;
}

function pickBreakdownValue(item: any, target: string): number | null {
  const breakdowns = item?.total_value?.breakdowns;
  if (!Array.isArray(breakdowns)) return null;

  for (const breakdown of breakdowns) {
    const results = Array.isArray(breakdown?.results) ? breakdown.results : [];
    for (const row of results) {
      const values = Array.isArray(row?.dimension_values)
        ? row.dimension_values
        : [];
      if (values.map((v: unknown) => String(v).toLowerCase()).includes(target.toLowerCase())) {
        return asNumber(row?.value);
      }
    }
  }

  return null;
}

function previousUtcDate(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function readMetric(items: any[], name: string): number {
  const item = items.find((entry) => entry.name === name);
  return item ? pickMetricValue(item) : 0;
}

async function fetchFacebookAccountInsights(
  pageId: string,
  accessToken: string,
): Promise<AccountInsightData> {
  const metricNames = [
    "page_impressions",
    "page_posts_impressions_unique",
    "page_post_engagements",
    "page_follows",
    "page_views_total",
  ];
  const metricDate = previousUtcDate();
  const params = new URLSearchParams({
    metric: metricNames.join(","),
    period: "day",
    since: metricDate,
    until: metricDate,
    access_token: accessToken,
  });
  const url = `https://graph.facebook.com/v26.0/${pageId}/insights?${params}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Facebook Page insights error: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  const data = Array.isArray(json?.data) ? json.data : [];
  const views = readMetric(data, "page_impressions");
  const accountsReached = readMetric(data, "page_posts_impressions_unique");
  const engagements = readMetric(data, "page_post_engagements");
  const follows = readMetric(data, "page_follows");
  const pageViews = readMetric(data, "page_views_total");

  return {
    views,
    accounts_reached: accountsReached,
    followers_views: null,
    non_followers_views: null,
    posts_views: null,
    stories_views: null,
    metadata: {
      fetched_at: new Date().toISOString(),
      metric_date: metricDate,
      source: "facebook_page_insights",
      metrics: {
        page_impressions: views,
        page_posts_impressions_unique: accountsReached,
        page_post_engagements: engagements,
        page_follows: follows,
        page_views_total: pageViews,
      },
      display_metrics: {
        "Post engagements": engagements,
        Follows: follows,
        "Page visits": pageViews,
      },
    },
    top_content: [],
  };
}

async function fetchPinterestAccountInsights(
  accessToken: string,
): Promise<AccountInsightData> {
  const metricDate = previousUtcDate();
  const metricTypes = [
    "IMPRESSION",
    "ENGAGEMENT",
    "PIN_CLICK",
    "OUTBOUND_CLICK",
    "SAVE",
    "PROFILE_VISIT",
  ];
  const params = new URLSearchParams({
    start_date: metricDate,
    end_date: metricDate,
    metric_types: metricTypes.join(","),
  });
  const headers = { Authorization: `Bearer ${accessToken}` };
  const res = await fetch(
    `https://api.pinterest.com/v5/user_account/analytics?${params}`,
    { headers },
  );
  if (!res.ok) {
    throw new Error(`Pinterest account analytics error: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  const metrics = json?.all?.summary_metrics ?? json?.summary_metrics ?? {};
  const views = asNumber(metrics.IMPRESSION);
  const accountsReached = asNumber(metrics.REACH);
  const displayMetrics: Record<string, number> = {
    Engagements: asNumber(metrics.ENGAGEMENT),
    "Pin clicks": asNumber(metrics.PIN_CLICK),
    Saves: asNumber(metrics.SAVE),
    "Outbound clicks": asNumber(metrics.OUTBOUND_CLICK),
    "Profile visits": asNumber(metrics.PROFILE_VISIT),
  };

  const topContent = await fetchPinterestTopPins(
    accessToken,
    metricDate,
    headers,
  );

  return {
    views,
    accounts_reached: accountsReached,
    followers_views: null,
    non_followers_views: null,
    posts_views: null,
    stories_views: null,
    metadata: {
      fetched_at: new Date().toISOString(),
      metric_date: metricDate,
      source: "pinterest_account_analytics",
      reach_available: metrics.REACH != null,
      metrics,
      display_metrics: displayMetrics,
    },
    top_content: topContent,
  };
}

async function fetchPinterestTopPins(
  accessToken: string,
  metricDate: string,
  headers: Record<string, string>,
): Promise<AccountTopContentItem[]> {
  const params = new URLSearchParams({
    start_date: metricDate,
    end_date: metricDate,
    sort_by: "IMPRESSION",
    metric_types: "IMPRESSION,ENGAGEMENT,PIN_CLICK,OUTBOUND_CLICK,SAVE",
    num_of_pins: "8",
  });
  const res = await fetch(
    `https://api.pinterest.com/v5/user_account/analytics/top_pins?${params}`,
    { headers },
  );
  if (!res.ok) return [];

  const json = await res.json();
  const pins = Array.isArray(json?.pins) ? json.pins : [];
  return await Promise.all(
    pins.map(async (item: any, index: number) => {
      const id = String(item?.pin_id ?? "");
      const views = asNumber(item?.metrics?.IMPRESSION);
      let detail: any = {};

      if (id) {
        try {
          const detailRes = await fetch(
            `https://api.pinterest.com/v5/pins/${encodeURIComponent(id)}`,
            { headers },
          );
          if (detailRes.ok) detail = await detailRes.json();
        } catch {
          // Keep the analytics row even if pin presentation details are unavailable.
        }
      }

      const images = detail?.media?.images;
      const thumbnailUrl = images
        ? Object.values(images).map((image: any) => image?.url).find(Boolean) ?? null
        : null;

      return {
        external_media_id: id,
        media_type: "PIN",
        title: detail?.title ?? detail?.description?.slice(0, 96) ?? null,
        thumbnail_url: thumbnailUrl,
        permalink: id ? `https://www.pinterest.com/pin/${encodeURIComponent(id)}/` : null,
        posted_at: detail?.created_at ?? null,
        views,
        metadata: {
          rank: index + 1,
          metrics: item?.metrics ?? {},
        },
      };
    }),
  );
}

async function fetchInstagramAccountInsights(
  igUserId: string,
  accessToken: string,
): Promise<AccountInsightData> {
  const encodedToken = encodeURIComponent(accessToken);
  const metrics: Record<string, any> = {};

  const endpoints = [
    `https://graph.facebook.com/v21.0/${igUserId}/insights?period=day&metric_type=total_value&metric=views,accounts_reached&breakdown=follow_type,media_product_type&access_token=${encodedToken}`,
    `https://graph.facebook.com/v21.0/${igUserId}/insights?period=day&metric=impressions,reach&access_token=${encodedToken}`,
  ];

  for (const url of endpoints) {
    const res = await fetch(url);
    if (!res.ok) continue;
    const json = await res.json();
    for (const item of json?.data ?? []) {
      metrics[item.name] = item;
    }
  }

  const topContent = await fetchInstagramTopContent(igUserId, accessToken);

  let postsViews = pickBreakdownValue(metrics.views, "post");
  let storiesViews = pickBreakdownValue(metrics.views, "story");
  if (postsViews == null || storiesViews == null) {
    const fallbackPosts = topContent
      .filter((row) => (row.media_type ?? "").toUpperCase() !== "STORY")
      .reduce((sum, row) => sum + row.views, 0);
    const fallbackStories = topContent
      .filter((row) => (row.media_type ?? "").toUpperCase() === "STORY")
      .reduce((sum, row) => sum + row.views, 0);
    if (postsViews == null) postsViews = fallbackPosts;
    if (storiesViews == null) storiesViews = fallbackStories;
  }

  return {
    views: pickMetricValue(metrics.views) || pickMetricValue(metrics.impressions),
    accounts_reached:
      pickMetricValue(metrics.accounts_reached) || pickMetricValue(metrics.reach),
    followers_views: pickBreakdownValue(metrics.views, "followers"),
    non_followers_views: pickBreakdownValue(metrics.views, "non_followers"),
    posts_views: postsViews,
    stories_views: storiesViews,
    metadata: {
      fetched_at: new Date().toISOString(),
      source: "instagram_graph",
    },
    top_content: topContent,
  };
}

async function fetchInstagramTopContent(
  igUserId: string,
  accessToken: string,
): Promise<AccountTopContentItem[]> {
  const mediaUrl =
    `https://graph.facebook.com/v21.0/${igUserId}/media` +
    `?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,permalink&limit=12&access_token=${encodeURIComponent(accessToken)}`;

  const mediaRes = await fetch(mediaUrl);
  if (!mediaRes.ok) {
    const body = await mediaRes.text();
    throw new Error(`Instagram media list error: ${mediaRes.status} ${body}`);
  }

  const mediaJson = await mediaRes.json();
  const mediaList = Array.isArray(mediaJson?.data) ? mediaJson.data : [];

  const rows: AccountTopContentItem[] = [];

  for (const media of mediaList) {
    const id = String(media?.id ?? "");
    if (!id) continue;

    const insightsUrl =
      `https://graph.facebook.com/v21.0/${id}/insights` +
      `?metric=views,impressions,reach,saved&access_token=${encodeURIComponent(accessToken)}`;
    const insightsRes = await fetch(insightsUrl);

    let views = 0;
    const insightMap: Record<string, number> = {};
    if (insightsRes.ok) {
      const insightsJson = await insightsRes.json();
      for (const item of insightsJson?.data ?? []) {
        const value = pickMetricValue(item);
        insightMap[item.name] = value;
      }
      views = insightMap.views ?? insightMap.impressions ?? insightMap.reach ?? 0;
    }

    rows.push({
      external_media_id: id,
      media_type: media?.media_type ?? null,
      title: typeof media?.caption === "string" ? media.caption.slice(0, 96) : null,
      thumbnail_url: media?.thumbnail_url ?? media?.media_url ?? null,
      permalink: media?.permalink ?? null,
      posted_at: media?.timestamp ?? null,
      views,
      metadata: {
        insight_metrics: insightMap,
      },
    });
  }

  return rows.sort((a, b) => b.views - a.views).slice(0, 8);
}
