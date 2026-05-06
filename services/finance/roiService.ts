import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";
import { CostEntryWithSource, getCostEntries } from "./costService";

type MetricPeriod = Database["public"]["Enums"]["metric_period"];

export interface CostPerPostResult {
  totalCost: number;
  publishedPosts: number;
  costPerPost: number | null;
}

export interface CostPerAssetResult {
  totalAICost: number;
  generatedAssets: number;
  costPerAsset: number | null;
}

export interface CostByBrandItem {
  brandId: string;
  brandName: string;
  total: number;
}

export interface CostByPlatformItem {
  platform: string;
  total: number;
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
      from.setDate(now.getDate() - now.getDay());
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

export async function getCostPerPost(
  workspaceId: string,
  period: MetricPeriod,
): Promise<CostPerPostResult> {
  const { from, to } = periodDateRange(period);

  const [entries, postsResult] = await Promise.all([
    getCostEntries(workspaceId, { from, to }),
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "published")
      .gte("published_at", `${from}T00:00:00`)
      .lte("published_at", `${to}T23:59:59`),
  ]);

  const totalCost = entries.reduce((s, e) => s + e.amount, 0);
  const publishedPosts = postsResult.count ?? 0;

  return {
    totalCost,
    publishedPosts,
    costPerPost: publishedPosts > 0 ? totalCost / publishedPosts : null,
  };
}

export async function getCostPerAsset(
  workspaceId: string,
  period: MetricPeriod,
): Promise<CostPerAssetResult> {
  const { from, to } = periodDateRange(period);

  const [entries, assetsResult] = await Promise.all([
    getCostEntries(workspaceId, { from, to }),
    supabase
      .from("assets")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("type", "generated_image")
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59`),
  ]);

  const totalAICost = entries
    .filter((e: CostEntryWithSource) => {
      const cat = e.cost_sources?.category;
      return cat === "ai_text" || cat === "ai_images";
    })
    .reduce((s, e) => s + e.amount, 0);

  const generatedAssets = assetsResult.count ?? 0;

  return {
    totalAICost,
    generatedAssets,
    costPerAsset: generatedAssets > 0 ? totalAICost / generatedAssets : null,
  };
}

export async function getCostByBrand(
  workspaceId: string,
  period: MetricPeriod,
): Promise<CostByBrandItem[]> {
  const { from, to } = periodDateRange(period);

  const [entries, brandsResult] = await Promise.all([
    getCostEntries(workspaceId, { from, to }),
    supabase.from("brands").select("id, name").eq("workspace_id", workspaceId),
  ]);

  const brandNames = new Map<string, string>(
    (brandsResult.data ?? []).map((b) => [b.id, b.name]),
  );

  const totals = new Map<string, number>();
  for (const e of entries) {
    if (!e.brand_id) continue;
    totals.set(e.brand_id, (totals.get(e.brand_id) ?? 0) + e.amount);
  }

  return Array.from(totals.entries()).map(([brandId, total]) => ({
    brandId,
    brandName: brandNames.get(brandId) ?? "Unknown",
    total,
  }));
}

export async function getCostByPlatform(
  workspaceId: string,
  period: MetricPeriod,
): Promise<CostByPlatformItem[]> {
  const { from, to } = periodDateRange(period);

  const [entries, postsResult] = await Promise.all([
    getCostEntries(workspaceId, { from, to }),
    supabase
      .from("posts")
      .select("platform, brand_id")
      .eq("workspace_id", workspaceId)
      .eq("status", "published")
      .gte("published_at", `${from}T00:00:00`)
      .lte("published_at", `${to}T23:59:59`),
  ]);

  // Brand costs from entries
  const brandTotals = new Map<string, number>();
  for (const e of entries) {
    if (!e.brand_id) continue;
    brandTotals.set(e.brand_id, (brandTotals.get(e.brand_id) ?? 0) + e.amount);
  }

  // Count posts per platform per brand to proportionally distribute brand spend
  const platformBrandPosts = new Map<string, Map<string, number>>();
  for (const p of postsResult.data ?? []) {
    if (!p.brand_id) continue;
    if (!platformBrandPosts.has(p.platform)) {
      platformBrandPosts.set(p.platform, new Map());
    }
    const bMap = platformBrandPosts.get(p.platform)!;
    bMap.set(p.brand_id, (bMap.get(p.brand_id) ?? 0) + 1);
  }

  const platformTotals = new Map<string, number>();
  for (const [platform, brandPostMap] of platformBrandPosts.entries()) {
    const totalPosts = Array.from(brandPostMap.values()).reduce(
      (a, b) => a + b,
      0,
    );
    let platformCost = 0;
    for (const [brandId, postCount] of brandPostMap.entries()) {
      const brandCost = brandTotals.get(brandId) ?? 0;
      const share = totalPosts > 0 ? postCount / totalPosts : 0;
      platformCost += brandCost * share;
    }
    platformTotals.set(platform, platformCost);
  }

  return Array.from(platformTotals.entries()).map(([platform, total]) => ({
    platform,
    total,
  }));
}
