import { CostSummaryCard } from "@/components/dashboard/CostSummaryCard";
import type { CostSummaryData } from "@/components/dashboard/CostSummaryCard";
import { InsightCard } from "@/components/dashboard/InsightCard";
import { PlatformBreakdownCard } from "@/components/dashboard/PlatformBreakdownCard";
import { UpcomingPostsCard } from "@/components/dashboard/UpcomingPostsCard";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { radius, spacing, typography } from "@/constants/theme";
import { useWorkspace } from "@/context/workspace-context";
import { useTheme } from "@/hooks/use-theme";
import {
  getRecommendations,
  type Recommendation,
} from "@/services/analytics/recommendationService";
import {
  getPerformanceByPlatform,
  getPerformanceSummary,
  type PlatformPerformanceRow,
} from "@/services/analytics/reportingService";
import { getCostSources, getCostSummary } from "@/services/finance/costService";
import {
  getQueue,
  type QueueItem,
} from "@/services/scheduling/publishQueueService";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Category colour palette ─────────────────────────────────────────────────
const CATEGORY_COLORS = [
  "#5BCF8E",
  "#4FC3F7",
  "#FF8A65",
  "#F4B740",
  "#EF6B6B",
  "#A78BFA",
];

// ─── Stat chip ───────────────────────────────────────────────────────────────
function StatChip({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        gap: spacing.xs,
        alignItems: "center",
      }}
    >
      {loading ? (
        <SkeletonBox height={22} width={48} />
      ) : (
        <Text style={{ ...typography.h3, color: colors.textPrimary }}>
          {value}
        </Text>
      )}
      <Text
        style={{
          ...typography.micro,
          color: colors.textSecondary,
          textAlign: "center",
        }}
        numberOfLines={2}
      >
        {label}
      </Text>
    </View>
  );
}

// ─── Nav tiles data ───────────────────────────────────────────────────────────
type NavRoute = "brands" | "campaigns" | "social-accounts" | "assets";
const NAV_TILES: {
  label: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  route: NavRoute;
}[] = [
  {
    label: "Brands",
    description: "Manage your brands and identity.",
    icon: "storefront",
    route: "brands",
  },
  {
    label: "Campaigns",
    description: "Plan and track campaigns.",
    icon: "campaign",
    route: "campaigns",
  },
  {
    label: "Social Accounts",
    description: "Connect social profiles.",
    icon: "link",
    route: "social-accounts",
  },
  {
    label: "Assets",
    description: "Images and generated media.",
    icon: "perm-media",
    route: "assets",
  },
];

export default function DashboardScreen() {
  const { colors } = useTheme();
  const { workspace, workspaceId, loading: wsLoading } = useWorkspace();

  const [costData, setCostData] = useState<CostSummaryData | null>(null);
  const [upcomingJobs, setUpcomingJobs] = useState<QueueItem[]>([]);
  const [topRec, setTopRec] = useState<Recommendation | null>(null);
  const [platforms, setPlatforms] = useState<PlatformPerformanceRow[]>([]);
  const [publishedThisMonth, setPublishedThisMonth] = useState(0);
  const [totalImpressions, setTotalImpressions] = useState(0);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = useCallback(
    async (silent = false) => {
      if (!workspaceId) return;
      if (!silent) setLoading(true);

      const now = new Date();
      const farFuture = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      try {
        const [
          costSummary,
          costSources,
          jobs,
          recs,
          plats,
          perfSummary,
          scheduledResult,
        ] = await Promise.all([
          getCostSummary(workspaceId, "monthly"),
          getCostSources(workspaceId),
          getQueue(workspaceId, {
            from: now.toISOString().slice(0, 10),
            to: farFuture.toISOString().slice(0, 10),
          }),
          getRecommendations(workspaceId, "weekly"),
          getPerformanceByPlatform(workspaceId, "weekly"),
          getPerformanceSummary(workspaceId, "monthly"),
          supabase
            .from("posts")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .eq("status", "scheduled"),
        ]);

        // Cost breakdown by source
        const sourceMap = new Map(costSources.map((s) => [s.id, s.name]));
        const bySourceMap = new Map<string, number>();
        for (const entry of costSummary.entries) {
          const srcId = entry.cost_source_id ?? "other";
          const label = sourceMap.get(srcId) ?? "Other";
          bySourceMap.set(label, (bySourceMap.get(label) ?? 0) + entry.amount);
        }
        const byCategory = Array.from(bySourceMap.entries()).map(
          ([label, amount], i) => ({
            label,
            amount,
            color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
          }),
        );
        setCostData({ totalThisMonth: costSummary.total, byCategory });

        setUpcomingJobs(
          jobs.filter((j) => j.status === "queued").slice(0, 5),
        );

        const priority: Recommendation["action"][] = [
          "scale",
          "keep_testing",
          "rewrite",
          "pause",
          "remove",
        ];
        const sorted = [...recs].sort(
          (a, b) =>
            priority.indexOf(a.action as never) -
            priority.indexOf(b.action as never),
        );
        setTopRec(sorted[0] ?? null);
        setPlatforms(plats);
        setPublishedThisMonth(perfSummary.postCount);
        setTotalImpressions(perfSummary.impressions);
        setScheduledCount(scheduledResult.count ?? 0);
      } catch {
        // non-fatal – empty for new workspaces
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [workspaceId],
  );

  useEffect(() => {
    if (!wsLoading) loadDashboard();
  }, [wsLoading, loadDashboard]);

  function navigate(route: NavRoute) {
    if (!workspaceId) return;
    router.push(`/workspace/${workspaceId}/${route}` as never);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadDashboard(true);
            }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={{ gap: spacing.xs }}>
          <Text style={{ ...typography.display, color: colors.primary }}>
            {workspace?.name ?? "SignalSprout"}
          </Text>
          <Text style={{ ...typography.body, color: colors.textSecondary }}>
            Here's what's happening
          </Text>
        </View>

        {/* Stat row */}
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <StatChip
            label={`Posts Published\nThis Month`}
            value={publishedThisMonth.toString()}
            loading={loading}
          />
          <StatChip
            label={`Total Impressions\nThis Month`}
            value={
              totalImpressions >= 1000
                ? `${(totalImpressions / 1000).toFixed(1)}k`
                : totalImpressions.toString()
            }
            loading={loading}
          />
          <StatChip
            label={`Scheduled\nPosts`}
            value={scheduledCount.toString()}
            loading={loading}
          />
        </View>

        {/* Cost Summary */}
        <CostSummaryCard
          data={costData}
          loading={loading}
          onPress={() => router.push("/(tabs)/costs" as never)}
        />

        {/* Upcoming Posts */}
        <UpcomingPostsCard items={upcomingJobs} loading={loading} />

        {/* AI Insight */}
        <InsightCard
          recommendation={topRec}
          loading={loading}
          onPress={() => router.push("/(tabs)/analytics" as never)}
        />

        {/* Platform Breakdown */}
        <PlatformBreakdownCard platforms={platforms} loading={loading} />

        {/* Workspace nav tiles */}
        <View style={{ gap: spacing.md }}>
          <Text
            style={{
              ...typography.caption,
              color: colors.textSecondary,
              textTransform: "uppercase",
              letterSpacing: 0.6,
              fontWeight: "700",
            }}
          >
            Workspace
          </Text>
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.lg }}
          >
            {NAV_TILES.map((tile) => (
              <Pressable
                key={tile.route}
                onPress={() => navigate(tile.route)}
                style={({ pressed }) => ({
                  width: "47%",
                  backgroundColor: pressed
                    ? colors.surfaceAlt
                    : colors.surface,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing.xl,
                  gap: spacing.sm,
                })}
                accessibilityRole="button"
                accessibilityLabel={tile.label}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.md,
                    backgroundColor: colors.primarySoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialIcons
                    name={tile.icon}
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <Text style={{ ...typography.h3, color: colors.textPrimary }}>
                  {tile.label}
                </Text>
                <Text
                  style={{
                    ...typography.caption,
                    color: colors.textSecondary,
                  }}
                >
                  {tile.description}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
