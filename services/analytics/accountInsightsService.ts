import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type MetricPeriod = Database["public"]["Enums"]["metric_period"];

type SnapshotRow = {
  id: string;
  social_account_id: string;
  platform: Database["public"]["Enums"]["platform_type"];
  captured_at: string;
  views: number;
  accounts_reached: number;
  followers_views: number | null;
  non_followers_views: number | null;
  posts_views: number | null;
  stories_views: number | null;
  social_accounts?: { account_name?: string | null } | null;
};

type TopContentRow = {
  id: string;
  snapshot_id: string;
  social_account_id: string;
  external_media_id: string;
  media_type: string | null;
  title: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  posted_at: string | null;
  views: number;
  rank: number | null;
};

export interface AccountInsightCard {
  accountName: string;
  platform: Database["public"]["Enums"]["platform_type"];
  views: number;
  accountsReached: number;
  followersShare: number | null;
  nonFollowersShare: number | null;
  postsShare: number | null;
  storiesShare: number | null;
  capturedAt: string;
  topContent: Array<{
    id: string;
    externalMediaId: string;
    mediaType: string | null;
    title: string | null;
    thumbnailUrl: string | null;
    permalink: string | null;
    postedAt: string | null;
    views: number;
    rank: number | null;
  }>;
}

type UntypedSupabase = {
  from: (table: string) => {
    select: (columns: string) => any;
  };
};

const sb = supabase as unknown as UntypedSupabase;

function periodDateRange(period: MetricPeriod): { from: string; to: string } {
  const now = new Date();
  let from: Date;

  switch (period) {
    case "daily":
      from = new Date(now);
      from.setHours(0, 0, 0, 0);
      break;
    case "weekly":
      from = new Date(now);
      from.setDate(now.getDate() - 7);
      from.setHours(0, 0, 0, 0);
      break;
    case "monthly":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "yearly":
      from = new Date(now.getFullYear(), 0, 1);
      break;
  }

  return {
    from: from.toISOString(),
    to: now.toISOString(),
  };
}

function safePercent(part: number | null, total: number): number | null {
  if (part == null || total <= 0) return null;
  return (part / total) * 100;
}

export async function getAccountInsights(
  workspaceId: string,
  period: MetricPeriod,
): Promise<AccountInsightCard[]> {
  const { from, to } = periodDateRange(period);

  let query = sb
    .from("account_insight_snapshots")
    .select(
      "id, social_account_id, platform, captured_at, views, accounts_reached, followers_views, non_followers_views, posts_views, stories_views, social_accounts(account_name)",
    )
    .eq("workspace_id", workspaceId)
    .gte("captured_at", from)
    .lte("captured_at", to)
    .order("captured_at", { ascending: false });

  let { data, error } = await query;

  if (error) {
    throw error;
  }

  let rows = (data ?? []) as unknown as SnapshotRow[];

  // Fallback to latest snapshots if current period has no data yet.
  if (rows.length === 0) {
    const fallback = await sb
      .from("account_insight_snapshots")
      .select(
        "id, social_account_id, platform, captured_at, views, accounts_reached, followers_views, non_followers_views, posts_views, stories_views, social_accounts(account_name)",
      )
      .eq("workspace_id", workspaceId)
      .order("captured_at", { ascending: false })
      .limit(20);

    if (fallback.error) {
      throw fallback.error;
    }

    rows = (fallback.data ?? []) as unknown as SnapshotRow[];
  }

  // Keep only latest snapshot per social account.
  const latestByAccount = new Map<string, SnapshotRow>();
  for (const row of rows) {
    if (!latestByAccount.has(row.social_account_id)) {
      latestByAccount.set(row.social_account_id, row);
    }
  }

  const latestRows = Array.from(latestByAccount.values());
  if (latestRows.length === 0) return [];

  const snapshotIds = latestRows.map((row) => row.id);

  const topContentRes = await sb
    .from("account_top_content")
    .select(
      "id, snapshot_id, social_account_id, external_media_id, media_type, title, thumbnail_url, permalink, posted_at, views, rank",
    )
    .eq("workspace_id", workspaceId)
    .in("snapshot_id", snapshotIds)
    .order("views", { ascending: false });

  if (topContentRes.error) {
    throw topContentRes.error;
  }

  const topRows = (topContentRes.data ?? []) as unknown as TopContentRow[];

  const topBySnapshot = new Map<string, TopContentRow[]>();
  for (const row of topRows) {
    const arr = topBySnapshot.get(row.snapshot_id) ?? [];
    arr.push(row);
    topBySnapshot.set(row.snapshot_id, arr);
  }

  return latestRows.map((row) => {
    const top = (topBySnapshot.get(row.id) ?? []).slice(0, 8);
    return {
      accountName: row.social_accounts?.account_name ?? "Connected account",
      platform: row.platform,
      views: row.views ?? 0,
      accountsReached: row.accounts_reached ?? 0,
      followersShare: safePercent(row.followers_views, row.views ?? 0),
      nonFollowersShare: safePercent(row.non_followers_views, row.views ?? 0),
      postsShare: safePercent(row.posts_views, row.views ?? 0),
      storiesShare: safePercent(row.stories_views, row.views ?? 0),
      capturedAt: row.captured_at,
      topContent: top.map((item) => ({
        id: item.id,
        externalMediaId: item.external_media_id,
        mediaType: item.media_type,
        title: item.title,
        thumbnailUrl: item.thumbnail_url,
        permalink: item.permalink,
        postedAt: item.posted_at,
        views: item.views ?? 0,
        rank: item.rank,
      })),
    };
  });
}
