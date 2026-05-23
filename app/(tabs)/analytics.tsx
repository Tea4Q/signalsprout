import { MetricCard } from "@/components/analytics/MetricCard";
import {
  PerformanceTable,
  type SortKey,
} from "@/components/analytics/PerformanceTable";
import { RecommendationPanel } from "@/components/analytics/RecommendationPanel";
import { AppTabs, type TabItem } from "@/components/ui/AppTabs";
import { radius, spacing, typography } from "@/constants/theme";
import { useWorkspace } from "@/context/workspace-context";
import { useTheme } from "@/hooks/use-theme";
import { formatUSD } from "@/lib/currency";
import { syncMetrics } from "@/services/analytics/analyticsIngestService";
import {
  dismissRecommendation,
  generateRecommendations,
  getRecommendations,
  type Recommendation,
} from "@/services/analytics/recommendationService";
import {
  getPerformanceByBrand,
  getPerformanceByPlatform,
  getPerformanceSummary,
  getTopPosts,
  type BrandPerformanceRow,
  type PerformanceSummary,
  type PlatformPerformanceRow,
  type PostPerformanceRow,
} from "@/services/analytics/reportingService";
import {
  getCostPerAsset,
  getCostPerPost,
  type CostPerAssetResult,
  type CostPerPostResult,
} from "@/services/finance/roiService";
import type { Database } from "@/types/database";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type MetricPeriod = Database["public"]["Enums"]["metric_period"];

const PERIOD_TABS: TabItem[] = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
];

export default function AnalyticsScreen() {
  const { colors } = useTheme();
  const { workspaceId, loading: loadingWorkspace } = useWorkspace();

  const [period, setPeriod] = useState<MetricPeriod>("weekly");
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [topPosts, setTopPosts] = useState<PostPerformanceRow[]>([]);
  const [byBrand, setByBrand] = useState<BrandPerformanceRow[]>([]);
  const [byPlatform, setByPlatform] = useState<PlatformPerformanceRow[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("impressions");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [generatingRecs, setGeneratingRecs] = useState(false);
  const [costPerPost, setCostPerPost] = useState<CostPerPostResult | null>(null);
  const [costPerAsset, setCostPerAsset] = useState<CostPerAssetResult | null>(null);

  const loadData = useCallback(
    async (p: MetricPeriod) => {
      if (!workspaceId) return;
      setLoading(true);
      try {
        const [sum, posts, brands, platforms, recs, cpp, cpa] = await Promise.all([
          getPerformanceSummary(workspaceId, p),
          getTopPosts(workspaceId, p, sortKey),
          getPerformanceByBrand(workspaceId, p),
          getPerformanceByPlatform(workspaceId, p),
          getRecommendations(workspaceId, p),
          getCostPerPost(workspaceId, p),
          getCostPerAsset(workspaceId, p),
        ]);
        setSummary(sum);
        setTopPosts(posts);
        setByBrand(brands);
        setByPlatform(platforms);
        setRecommendations(recs);
        setCostPerPost(cpp);
        setCostPerAsset(cpa);
      } catch {
        // data unavailable — show empty state
      } finally {
        setLoading(false);
      }
    },
    [workspaceId, sortKey],
  );

  useEffect(() => {
    if (!loadingWorkspace) loadData(period);
  }, [loadingWorkspace, period, loadData]);

  const handleSort = useCallback(
    async (key: SortKey) => {
      if (!workspaceId) return;
      setSortKey(key);
      try {
        const posts = await getTopPosts(workspaceId, period, key);
        setTopPosts(posts);
      } catch {
        // ignore
      }
    },
    [workspaceId, period],
  );

  const handleSync = useCallback(async () => {
    if (!workspaceId) return;
    setSyncing(true);
    try {
      await syncMetrics(workspaceId);
      await loadData(period);
    } catch {
      Alert.alert("Sync failed", "Could not sync platform metrics.");
    } finally {
      setSyncing(false);
    }
  }, [workspaceId, period, loadData]);

  const handleGenerate = useCallback(async () => {
    if (!workspaceId) return;
    setGeneratingRecs(true);
    try {
      await generateRecommendations(workspaceId, period);
      const recs = await getRecommendations(workspaceId, period);
      setRecommendations(recs);
    } catch {
      Alert.alert("Error", "Could not generate recommendations.");
    } finally {
      setGeneratingRecs(false);
    }
  }, [workspaceId, period]);

  const handleDismiss = useCallback(async (id: string) => {
    try {
      await dismissRecommendation(id);
      setRecommendations((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // ignore
    }
  }, []);

  if (loadingWorkspace) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing["2xl"] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={{ ...typography.h2, color: colors.textPrimary }}>
            Analytics
          </Text>
          <Pressable
            onPress={handleSync}
            disabled={syncing}
            style={({ pressed }) => ({
              backgroundColor: pressed ? colors.surfaceAlt : colors.primarySoft,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
              opacity: syncing ? 0.6 : 1,
            })}
            accessibilityRole="button"
            accessibilityLabel="Sync platform metrics"
          >
            {syncing && (
              <ActivityIndicator size="small" color={colors.primary} />
            )}
            <Text
              style={{
                ...typography.caption,
                color: colors.primary,
                fontWeight: "600",
              }}
            >
              {syncing ? "Syncing…" : "Sync Metrics"}
            </Text>
          </Pressable>
        </View>

        {/* Period tabs */}
        <AppTabs
          tabs={PERIOD_TABS}
          activeKey={period}
          onChange={(key) => setPeriod(key as MetricPeriod)}
        />

        {/* Summary metric cards */}
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}
          >
            <MetricCard
              label="Impressions"
              value={summary?.impressions ?? 0}
              style={{ minWidth: "45%" }}
            />
            <MetricCard
              label="Saves"
              value={summary?.saves ?? 0}
              style={{ minWidth: "45%" }}
            />
            <MetricCard
              label="Clicks"
              value={summary?.outbound_clicks ?? 0}
              style={{ minWidth: "45%" }}
            />
            <MetricCard
              label="Avg Eng Rate"
              value={`${((summary?.avgEngagementRate ?? 0) * 100).toFixed(2)}%`}
              style={{ minWidth: "45%" }}
            />
            <MetricCard
              label="Cost / Post"
              value={
                costPerPost?.costPerPost != null
                  ? formatUSD(costPerPost.costPerPost)
                  : "—"
              }
              style={{ minWidth: "45%" }}
            />
            <MetricCard
              label="Cost / Asset"
              value={
                costPerAsset?.costPerAsset != null
                  ? formatUSD(costPerAsset.costPerAsset)
                  : "—"
              }
              style={{ minWidth: "45%" }}
            />
          </View>
        )}

        {/* Top Posts */}
        <View style={{ gap: spacing.md }}>
          <Text style={{ ...typography.h3, color: colors.textPrimary }}>
            Top Posts
          </Text>
          <PerformanceTable
            rows={topPosts}
            sortKey={sortKey}
            onSort={handleSort}
          />
        </View>

        {/* Brand Performance */}
        {byBrand.length > 0 && (
          <View style={{ gap: spacing.md }}>
            <Text style={{ ...typography.h3, color: colors.textPrimary }}>
              By Brand
            </Text>
            {byBrand.map((b) => (
              <View
                key={b.brandId}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing.lg,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View>
                  <Text
                    style={{
                      ...typography.body,
                      color: colors.textPrimary,
                      fontWeight: "600",
                    }}
                  >
                    {b.brandName}
                  </Text>
                  <Text
                    style={{ ...typography.micro, color: colors.textMuted }}
                  >
                    {b.postCount} posts
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: spacing.xs }}>
                  <Text
                    style={{ ...typography.caption, color: colors.textPrimary }}
                  >
                    {b.impressions.toLocaleString()} impr
                  </Text>
                  <Text
                    style={{
                      ...typography.micro,
                      color: colors.textSecondary,
                    }}
                  >
                    {(b.avgEngagementRate * 100).toFixed(1)}% eng
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Platform Breakdown */}
        {byPlatform.length > 0 && (
          <View style={{ gap: spacing.md }}>
            <Text style={{ ...typography.h3, color: colors.textPrimary }}>
              By Platform
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              {byPlatform.map((p) => (
                <View
                  key={p.platform}
                  style={{
                    flex: 1,
                    backgroundColor: colors.surface,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: spacing.lg,
                    gap: spacing.xs,
                  }}
                >
                  <Text
                    style={{
                      ...typography.micro,
                      color: colors.textSecondary,
                      textTransform: "capitalize",
                    }}
                  >
                    {p.platform}
                  </Text>
                  <Text style={{ ...typography.h3, color: colors.textPrimary }}>
                    {p.impressions.toLocaleString()}
                  </Text>
                  <Text
                    style={{ ...typography.micro, color: colors.textMuted }}
                  >
                    {(p.avgEngagementRate * 100).toFixed(1)}% eng
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Recommendations */}
        <RecommendationPanel
          recommendations={recommendations}
          loading={generatingRecs}
          onDismiss={handleDismiss}
          onGenerate={handleGenerate}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
