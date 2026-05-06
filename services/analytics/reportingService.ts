import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type MetricPeriod = Database["public"]["Enums"]["metric_period"];
type PlatformType = Database["public"]["Enums"]["platform_type"];

export interface PerformanceSummary {
  impressions: number;
  likes: number;
  saves: number;
  comments: number;
  shares: number;
  outbound_clicks: number;
  avgEngagementRate: number;
  postCount: number;
}

export interface PostPerformanceRow {
  postId: string;
  platform: PlatformType;
  title: string | null;
  hook: string | null;
  impressions: number;
  saves: number;
  outbound_clicks: number;
  engagement_rate: number;
}

export interface BrandPerformanceRow {
  brandId: string;
  brandName: string;
  impressions: number;
  saves: number;
  avgEngagementRate: number;
  postCount: number;
}

export interface PlatformPerformanceRow {
  platform: PlatformType;
  impressions: number;
  saves: number;
  avgEngagementRate: number;
  postCount: number;
}

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
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}

// Fetch all metric snapshots for a workspace's published posts in a period
async function fetchWorkspaceMetrics(
  workspaceId: string,
  from: string,
  to: string,
) {
  const { data: posts, error: postsError } = await supabase
    .from("posts")
    .select("id, platform, title, hook, brand_id")
    .eq("workspace_id", workspaceId)
    .eq("status", "published")
    .gte("published_at", `${from}T00:00:00`)
    .lte("published_at", `${to}T23:59:59`);

  if (postsError) throw postsError;
  if (!posts || posts.length === 0) return { posts: [], metrics: [] };

  const postIds = posts.map((p) => p.id);
  const { data: metrics, error: metricsError } = await supabase
    .from("platform_metrics")
    .select("*")
    .in("post_id", postIds)
    .gte("captured_at", `${from}T00:00:00`);

  if (metricsError) throw metricsError;
  return { posts: posts ?? [], metrics: metrics ?? [] };
}

export async function getPerformanceSummary(
  workspaceId: string,
  period: MetricPeriod,
): Promise<PerformanceSummary> {
  const { from, to } = periodDateRange(period);
  const { metrics, posts } = await fetchWorkspaceMetrics(workspaceId, from, to);

  const sum: PerformanceSummary = {
    impressions: 0,
    likes: 0,
    saves: 0,
    comments: 0,
    shares: 0,
    outbound_clicks: 0,
    avgEngagementRate: 0,
    postCount: posts.length,
  };

  let engSum = 0;
  for (const m of metrics) {
    sum.impressions += m.impressions ?? 0;
    sum.likes += m.likes ?? 0;
    sum.saves += m.saves ?? 0;
    sum.comments += m.comments ?? 0;
    sum.shares += m.shares ?? 0;
    sum.outbound_clicks += m.outbound_clicks ?? 0;
    engSum += m.engagement_rate ?? 0;
  }
  sum.avgEngagementRate = metrics.length > 0 ? engSum / metrics.length : 0;

  return sum;
}

export async function getTopPosts(
  workspaceId: string,
  period: MetricPeriod,
  metric:
    | "impressions"
    | "saves"
    | "outbound_clicks"
    | "engagement_rate" = "impressions",
  limit = 10,
): Promise<PostPerformanceRow[]> {
  const { from, to } = periodDateRange(period);
  const { posts, metrics } = await fetchWorkspaceMetrics(workspaceId, from, to);

  const postMap = new Map(posts.map((p) => [p.id, p]));

  const rows: PostPerformanceRow[] = metrics.map((m) => {
    const p = postMap.get(m.post_id);
    return {
      postId: m.post_id,
      platform: m.platform,
      title: p?.title ?? null,
      hook: p?.hook ?? null,
      impressions: m.impressions ?? 0,
      saves: m.saves ?? 0,
      outbound_clicks: m.outbound_clicks ?? 0,
      engagement_rate: m.engagement_rate ?? 0,
    };
  });

  return rows
    .sort((a, b) => (b[metric] as number) - (a[metric] as number))
    .slice(0, limit);
}

export async function getPerformanceByBrand(
  workspaceId: string,
  period: MetricPeriod,
): Promise<BrandPerformanceRow[]> {
  const { from, to } = periodDateRange(period);
  const { posts, metrics } = await fetchWorkspaceMetrics(workspaceId, from, to);

  // Fetch brand names
  const { data: brands } = await supabase
    .from("brands")
    .select("id, name")
    .eq("workspace_id", workspaceId);

  const brandNames = new Map((brands ?? []).map((b) => [b.id, b.name]));
  const postBrand = new Map(posts.map((p) => [p.id, p.brand_id]));

  const agg = new Map<
    string,
    { impressions: number; saves: number; engSum: number; count: number }
  >();

  for (const m of metrics) {
    const brandId = postBrand.get(m.post_id);
    if (!brandId) continue;
    const cur = agg.get(brandId) ?? {
      impressions: 0,
      saves: 0,
      engSum: 0,
      count: 0,
    };
    cur.impressions += m.impressions ?? 0;
    cur.saves += m.saves ?? 0;
    cur.engSum += m.engagement_rate ?? 0;
    cur.count += 1;
    agg.set(brandId, cur);
  }

  // Count posts per brand
  const postCountByBrand = new Map<string, number>();
  for (const p of posts) {
    postCountByBrand.set(
      p.brand_id,
      (postCountByBrand.get(p.brand_id) ?? 0) + 1,
    );
  }

  return Array.from(agg.entries()).map(([brandId, v]) => ({
    brandId,
    brandName: brandNames.get(brandId) ?? "Unknown",
    impressions: v.impressions,
    saves: v.saves,
    avgEngagementRate: v.count > 0 ? v.engSum / v.count : 0,
    postCount: postCountByBrand.get(brandId) ?? 0,
  }));
}

export async function getPerformanceByPlatform(
  workspaceId: string,
  period: MetricPeriod,
): Promise<PlatformPerformanceRow[]> {
  const { from, to } = periodDateRange(period);
  const { metrics, posts } = await fetchWorkspaceMetrics(workspaceId, from, to);

  const agg = new Map<
    string,
    { impressions: number; saves: number; engSum: number; count: number }
  >();
  for (const m of metrics) {
    const cur = agg.get(m.platform) ?? {
      impressions: 0,
      saves: 0,
      engSum: 0,
      count: 0,
    };
    cur.impressions += m.impressions ?? 0;
    cur.saves += m.saves ?? 0;
    cur.engSum += m.engagement_rate ?? 0;
    cur.count += 1;
    agg.set(m.platform, cur);
  }

  const postCountByPlatform = new Map<string, number>();
  for (const p of posts) {
    postCountByPlatform.set(
      p.platform,
      (postCountByPlatform.get(p.platform) ?? 0) + 1,
    );
  }

  return Array.from(agg.entries()).map(([platform, v]) => ({
    platform: platform as PlatformType,
    impressions: v.impressions,
    saves: v.saves,
    avgEngagementRate: v.count > 0 ? v.engSum / v.count : 0,
    postCount: postCountByPlatform.get(platform) ?? 0,
  }));
}

export async function getPerformanceByContentType(
  workspaceId: string,
  period: MetricPeriod,
): Promise<
  {
    type: string;
    impressions: number;
    avgEngagementRate: number;
    postCount: number;
  }[]
> {
  const { from, to } = periodDateRange(period);
  const { posts, metrics } = await fetchWorkspaceMetrics(workspaceId, from, to);

  const metricByPost = new Map(metrics.map((m) => [m.post_id, m]));

  // Classify by whether post has a hook (short-form) or caption-only (long-form)
  const agg = new Map<
    string,
    { impressions: number; engSum: number; count: number }
  >();

  for (const p of posts) {
    const type = p.hook ? "short_form" : "long_form";
    const m = metricByPost.get(p.id);
    const cur = agg.get(type) ?? { impressions: 0, engSum: 0, count: 0 };
    cur.impressions += m?.impressions ?? 0;
    cur.engSum += m?.engagement_rate ?? 0;
    cur.count += 1;
    agg.set(type, cur);
  }

  return Array.from(agg.entries()).map(([type, v]) => ({
    type,
    impressions: v.impressions,
    avgEngagementRate: v.count > 0 ? v.engSum / v.count : 0,
    postCount: v.count,
  }));
}
