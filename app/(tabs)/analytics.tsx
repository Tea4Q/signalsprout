import { MetricCard } from "@/components/analytics/MetricCard";
import { AccountInsightsSection } from "@/components/analytics/AccountInsightsSection";
import {
  PerformanceTable,
  type SortKey,
} from "@/components/analytics/PerformanceTable";
import { RecommendationPanel } from "@/components/analytics/RecommendationPanel";
import { AppTabs, type TabItem } from "@/components/ui/AppTabs";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { radius, spacing, typography } from "@/constants/theme";
import { useWorkspace } from "@/context/workspace-context";
import { useToast } from "@/context/toast-context";
import { useTheme } from "@/hooks/use-theme";
import { formatUSD } from "@/lib/currency";
import {
  dismissRecommendation,
  generateRecommendations,
  getRecommendations,
  type Recommendation,
} from "@/services/analytics/recommendationService";
import {
  getAccountInsights,
  type AccountInsightCard,
} from "@/services/analytics/accountInsightsService";
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
import { syncMetrics } from "@/services/analytics/analyticsIngestService";
import type { Database } from "@/types/database";
import { router } from "expo-router";
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
  const { showToast } = useToast();

  const [period, setPeriod] = useState<MetricPeriod>("weekly");
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [topPosts, setTopPosts] = useState<PostPerformanceRow[]>([]);
  const [byBrand, setByBrand] = useState<BrandPerformanceRow[]>([]);
  const [byPlatform, setByPlatform] = useState<PlatformPerformanceRow[]>([]);
  const [accountInsights, setAccountInsights] = useState<AccountInsightCard[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("impressions");
  const [loading, setLoading] = useState(false);
  const [generatingRecs, setGeneratingRecs] = useState(false);
  const [costPerPost, setCostPerPost] = useState<CostPerPostResult | null>(null);
  const [costPerAsset, setCostPerAsset] = useState<CostPerAssetResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const loadData = useCallback(
    async (p: MetricPeriod) => {
      if (!workspaceId) return;
      setLoading(true);
      setLoadError(null);
      try {
        const [sum, posts, brands, platforms, recs, cpp, cpa, insightRows] = await Promise.all([
          getPerformanceSummary(workspaceId, p),
          getTopPosts(workspaceId, p, sortKey),
          getPerformanceByBrand(workspaceId, p),
          getPerformanceByPlatform(workspaceId, p),
          getRecommendations(workspaceId, p),
          getCostPerPost(workspaceId, p),
          getCostPerAsset(workspaceId, p),
          getAccountInsights(workspaceId, p),
        ]);
        setSummary(sum);
        setTopPosts(posts);
        setByBrand(brands);
        setByPlatform(platforms);
        setAccountInsights(insightRows);
        setRecommendations(recs);
        setCostPerPost(cpp);
        setCostPerAsset(cpa);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Failed to load analytics data.");
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
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Failed to sort posts.", "error");
      }
    },
    [workspaceId, period, showToast],
  );

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

  const handleSync = useCallback(async () => {
    if (!workspaceId || syncing) return;
    setSyncing(true);
    try {
      const result = await syncMetrics(workspaceId);
      setLastSyncAt(new Date().toISOString());
      showToast(`Analytics sync complete: ${result.synced} post${result.synced === 1 ? "" : "s"} updated.`, "success");
      await loadData(period);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Analytics sync failed.", "error");
    } finally {
      setSyncing(false);
    }
  }, [loadData, period, showToast, syncing, workspaceId]);

  const handleDismiss = useCallback(async (id: string) => {
    try {
      await dismissRecommendation(id);
      setRecommendations((prev) => prev.filter((r) => r.id !== id));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to dismiss recommendation.", "error");
    }
  }, [showToast]);

  if (loadingWorkspace) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (loadError && !loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ErrorState message={loadError} onRetry={() => loadData(period)} />
      </SafeAreaView>
    );
  }

  const hasAnalyticsData =
    summary !== null ||
    topPosts.length > 0 ||
    byBrand.length > 0 ||
    byPlatform.length > 0 ||
    accountInsights.length > 0;

  if (!loading && !hasAnalyticsData) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <EmptyState
          icon="insights"
          title="No analytics yet"
          subtitle="Connect a social account and publish a post to start collecting performance data."
          ctaLabel="Connect an account"
          onCta={() => router.push("/(tabs)/social-accounts" as never)}
        />
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
          <View style={{ alignItems: "flex-end", gap: spacing.xs }}>
            <Text style={{ ...typography.caption, color: colors.textMuted }}>
              {lastSyncAt
                ? `Last synced ${new Date(lastSyncAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : "Daily sync at 00:00 UTC"}
            </Text>
            <Pressable
              onPress={handleSync}
              disabled={syncing}
              accessibilityRole="button"
              accessibilityLabel="Sync analytics now"
              style={{ opacity: syncing ? 0.5 : 1 }}
            >
              <Text style={{ ...typography.caption, color: colors.primary, fontWeight: "700" }}>
                {syncing ? "Syncing…" : "Sync now"}
              </Text>
            </Pressable>
          </View>
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
        <AccountInsightsSection
          insights={accountInsights}
          loading={loading}
        />

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
