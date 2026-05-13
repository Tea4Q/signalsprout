import {
  ChartDataPoint,
  CostTrendChart,
} from "@/components/costs/CostTrendChart";
import {
  ToolSpendRow,
  ToolSpendTable,
} from "@/components/costs/ToolSpendTable";
import { AppTabs, TabItem } from "@/components/ui/AppTabs";
import { radius, spacing, typography } from "@/constants/theme";
import { useWorkspace } from "@/context/workspace-context";
import { useTheme } from "@/hooks/use-theme";
import { formatUSD } from "@/lib/currency";
import {
  BudgetStatus,
  checkBudgetStatus,
} from "@/services/finance/budgetService";
import {
  CostEntryWithSource,
  CostSource,
  getCostEntries,
  getCostSources,
} from "@/services/finance/costService";
import {
  VendorCreditSummary,
  getVendorCreditSummaries,
} from "@/services/finance/creditService";
import type { Database } from "@/types/database";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type MetricPeriod = Database["public"]["Enums"]["metric_period"];

// ─── Period helpers ──────────────────────────────────────────────────────────

const PERIOD_TABS: TabItem[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
];

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

function chartHistoryRange(period: MetricPeriod): { from: string; to: string } {
  const now = new Date();
  let from: Date;
  switch (period) {
    case "daily":
      from = new Date(now);
      from.setDate(now.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      break;
    case "weekly":
      from = new Date(now);
      from.setDate(now.getDate() - 27);
      from.setHours(0, 0, 0, 0);
      break;
    case "monthly":
      from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      break;
    case "yearly":
      from = new Date(now.getFullYear() - 3, 0, 1);
      break;
  }
  return {
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}

// ─── Series key mapping ──────────────────────────────────────────────────────

type SeriesKey = "ai_text" | "ai_images" | "infra" | "other";

const CAT_MAP: Record<string, SeriesKey> = {
  ai_text: "ai_text",
  ai_images: "ai_images",
  infra: "infra",
};

function getSeriesKey(category: string | undefined): SeriesKey {
  return CAT_MAP[category ?? ""] ?? "other";
}

function sumToPoint(
  label: string,
  rows: CostEntryWithSource[],
): ChartDataPoint {
  const pt: ChartDataPoint = {
    label,
    ai_text: 0,
    ai_images: 0,
    infra: 0,
    other: 0,
  };
  for (const e of rows) {
    const key = getSeriesKey(e.cost_sources?.category ?? undefined);
    pt[key] += e.amount;
  }
  return pt;
}

function buildChartData(
  allEntries: CostEntryWithSource[],
  period: MetricPeriod,
): ChartDataPoint[] {
  const now = new Date();
  const points: ChartDataPoint[] = [];

  switch (period) {
    case "daily": {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString("en-US", { weekday: "short" });
        points.push(
          sumToPoint(
            label,
            allEntries.filter((e) => e.entry_date.slice(0, 10) === key),
          ),
        );
      }
      break;
    }
    case "weekly": {
      for (let i = 3; i >= 0; i--) {
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay() - i * 7);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        const fromKey = start.toISOString().slice(0, 10);
        const toKey = end.toISOString().slice(0, 10);
        points.push(
          sumToPoint(
            `W${4 - i}`,
            allEntries.filter(
              (e) => e.entry_date >= fromKey && e.entry_date <= toKey,
            ),
          ),
        );
      }
      break;
    }
    case "monthly": {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const fromKey = d.toISOString().slice(0, 10);
        const toKey = last.toISOString().slice(0, 10);
        const label = d.toLocaleDateString("en-US", { month: "short" });
        points.push(
          sumToPoint(
            label,
            allEntries.filter(
              (e) => e.entry_date >= fromKey && e.entry_date <= toKey,
            ),
          ),
        );
      }
      break;
    }
    case "yearly": {
      for (let i = 3; i >= 0; i--) {
        const yr = now.getFullYear() - i;
        const fromKey = `${yr}-01-01`;
        const toKey = `${yr}-12-31`;
        points.push(
          sumToPoint(
            `${yr}`,
            allEntries.filter(
              (e) => e.entry_date >= fromKey && e.entry_date <= toKey,
            ),
          ),
        );
      }
      break;
    }
  }
  return points;
}

// ─── Budget progress bar ─────────────────────────────────────────────────────

type ThemeColors = ReturnType<
  typeof import("@/hooks/use-theme").useTheme
>["colors"];

function BudgetBar({
  status,
  colors,
}: {
  status: BudgetStatus;
  colors: ThemeColors;
}) {
  const clampedPct = Math.min(status.percent, 100);
  const barColor =
    status.percent >= 100
      ? colors.danger
      : status.percent >= status.threshold
        ? colors.warning
        : colors.primary;

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ ...typography.caption, color: colors.textSecondary }}>
          Budget Used
        </Text>
        <Text
          style={{
            ...typography.caption,
            color: barColor,
            fontWeight: "600",
          }}
        >
          {formatUSD(status.spent)} / {formatUSD(status.limit)} (
          {Math.round(status.percent)}%)
        </Text>
      </View>
      <View
        style={{
          height: 8,
          borderRadius: 999,
          backgroundColor: colors.borderSoft,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: 8,
            width: `${clampedPct}%`,
            borderRadius: 999,
            backgroundColor: barColor,
          }}
        />
      </View>
      {status.percent >= status.threshold && (
        <Text style={{ ...typography.micro, color: barColor }}>
          {status.percent >= 100
            ? "⚠ Budget limit reached"
            : `⚠ Over ${status.threshold}% alert threshold`}
        </Text>
      )}
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function CostsScreen() {
  const { colors } = useTheme();
  const { workspaceId, loading: loadingWorkspace } = useWorkspace();
  const s = styles(colors);

  const [activePeriod, setActivePeriod] = useState<MetricPeriod>("monthly");
  const [sources, setSources] = useState<CostSource[]>([]);
  const [allEntries, setAllEntries] = useState<CostEntryWithSource[]>([]);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null);
  const [creditSummaries, setCreditSummaries] = useState<VendorCreditSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const loadData = useCallback(
    async (period: MetricPeriod) => {
      if (!workspaceId) return;
      setLoading(true);
      setLoadError(null);
      try {
        const histRange = chartHistoryRange(period);
        const periodRange = periodDateRange(period);

        const [src, hist, credits] = await Promise.all([
          getCostSources(workspaceId),
          getCostEntries(workspaceId, {
            from: histRange.from,
            to: histRange.to,
          }),
          getVendorCreditSummaries(workspaceId),
        ]);

        setSources(src);
        setAllEntries(hist);
        setCreditSummaries(credits);

        const periodEntries = hist.filter(
          (e) =>
            e.entry_date >= periodRange.from && e.entry_date <= periodRange.to,
        );
        const spent = periodEntries.reduce((sum, e) => sum + e.amount, 0);
        const bs = await checkBudgetStatus(workspaceId, period, spent);
        setBudgetStatus(bs);
      } catch {
        setLoadError("Failed to load cost data.");
      } finally {
        setLoading(false);
      }
    },
    [workspaceId],
  );

  useEffect(() => {
    if (!loadingWorkspace) loadData(activePeriod);
  }, [loadingWorkspace, activePeriod, loadData]);

  // Filter entries to active period
  const periodEntries = useMemo(() => {
    const { from, to } = periodDateRange(activePeriod);
    return allEntries.filter((e) => e.entry_date >= from && e.entry_date <= to);
  }, [allEntries, activePeriod]);

  const totalSpend = useMemo(
    () => periodEntries.reduce((s, e) => s + e.amount, 0),
    [periodEntries],
  );

  const { minEstimated, maxEstimated } = useMemo(() => {
    const min = sources.reduce(
      (s, src) => s + (src.min_estimated_cost ?? 0),
      0,
    );
    const max = sources.reduce(
      (s, src) => s + (src.max_estimated_cost ?? 0),
      0,
    );
    return { minEstimated: min, maxEstimated: max };
  }, [sources]);

  const toolRows = useMemo<ToolSpendRow[]>(() => {
    const spend = new Map<string, number>();
    for (const e of periodEntries) {
      if (!e.cost_source_id) continue;
      spend.set(
        e.cost_source_id,
        (spend.get(e.cost_source_id) ?? 0) + e.amount,
      );
    }
    return sources
      .filter((s) => spend.has(s.id))
      .map((s) => ({ source: s, actualSpend: spend.get(s.id) ?? 0 }))
      .sort((a, b) => b.actualSpend - a.actualSpend);
  }, [sources, periodEntries]);

  const brandRows = useMemo(() => {
    const spend = new Map<string, number>();
    for (const e of periodEntries) {
      if (!e.brand_id) continue;
      spend.set(e.brand_id, (spend.get(e.brand_id) ?? 0) + e.amount);
    }
    return Array.from(spend.entries())
      .map(([brandId, total]) => ({ brandId, total }))
      .sort((a, b) => b.total - a.total);
  }, [periodEntries]);

  const chartData = useMemo<ChartDataPoint[]>(
    () => buildChartData(allEntries, activePeriod),
    [allEntries, activePeriod],
  );

  if (loadingWorkspace) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safeArea} edges={["bottom", "left", "right"]}>
      <AppTabs
        tabs={PERIOD_TABS}
        activeKey={activePeriod}
        onChange={(k) => setActivePeriod(k as MetricPeriod)}
      />

      <ScrollView contentContainerStyle={s.scroll}>
        {loading ? (
          <ActivityIndicator
            color={colors.primary}
            style={{ marginTop: spacing["3xl"] }}
          />
        ) : loadError ? (
          <Text style={{ ...typography.body, color: colors.danger }}>
            {loadError}
          </Text>
        ) : (
          <>
            {/* What-to-track guidance banner */}
            {!bannerDismissed && (
              <View
                style={[
                  s.card,
                  {
                    borderColor: colors.primarySoft,
                    backgroundColor: colors.primarySoft,
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: spacing.md,
                  },
                ]}
              >
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text
                    style={{
                      ...typography.body,
                      color: colors.primary,
                      fontWeight: "700",
                    }}
                  >
                    What to track here
                  </Text>
                  <Text
                    style={{ ...typography.caption, color: colors.primary }}
                  >
                    Log every expense that relates to your content operation:
                    AI generation (OpenAI, Runway), hosting (Vercel, Supabase),
                    ad spend, subscriptions, and campaign budgets. SignalSprout
                    uses these figures to calculate Cost / Post and
                    Cost / Asset on the Analytics screen.
                  </Text>
                  <Text
                    style={{ ...typography.micro, color: colors.primary }}
                  >
                    General business expenses (payroll, rent, accounting) belong
                    in a dedicated tool like QuickBooks or Wave.
                  </Text>
                </View>
                <Pressable
                  onPress={() => setBannerDismissed(true)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss guidance banner"
                >
                  <Text
                    style={{
                      ...typography.body,
                      color: colors.primary,
                      fontWeight: "700",
                      lineHeight: 18,
                    }}
                  >
                    ×
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Total spend card */}
            <View style={s.card}>
              <Text
                style={{ ...typography.caption, color: colors.textSecondary }}
              >
                Total Spend
              </Text>
              <Text
                style={{ ...typography.display, color: colors.textPrimary }}
              >
                {formatUSD(totalSpend)}
              </Text>
              {maxEstimated > 0 && (
                <Text
                  style={{ ...typography.caption, color: colors.textSecondary }}
                >
                  Estimated range:{" "}
                  <Text style={{ color: colors.textPrimary }}>
                    {formatUSD(minEstimated)} – {formatUSD(maxEstimated)}
                  </Text>
                </Text>
              )}
            </View>

            {/* Budget progress */}
            {budgetStatus?.hasRule && (
              <View style={s.card}>
                <Text style={s.sectionTitle}>Budget</Text>
                <BudgetBar status={budgetStatus} colors={colors} />
              </View>
            )}

            {/* Trend chart */}
            <View style={s.card}>
              <Text style={s.sectionTitle}>Spending Trend</Text>
              <CostTrendChart data={chartData} />
            </View>

            {/* By tool / vendor */}
            <View style={s.card}>
              <Text style={s.sectionTitle}>By Tool / Vendor</Text>
              <ToolSpendTable rows={toolRows} />
            </View>

            {/* Credits / balance */}
            {creditSummaries.length > 0 && (
              <View style={s.card}>
                <Text style={s.sectionTitle}>AI Credits</Text>
                <View style={{ gap: spacing.md }}>
                  {creditSummaries.map((cs) => {
                    const usedPct = cs.totalPurchased > 0
                      ? Math.min((cs.totalSpentUSD / cs.totalPurchased) * 100, 100)
                      : 0;
                    const barColor =
                      usedPct >= 100
                        ? colors.danger
                        : usedPct >= 80
                          ? colors.warning
                          : colors.primary;
                    return (
                      <View key={cs.vendor} style={{ gap: spacing.xs }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={{ ...typography.body, color: colors.textPrimary, fontWeight: "600" }}>
                            {cs.vendor}
                          </Text>
                          <Text style={{ ...typography.caption, color: barColor, fontWeight: "600" }}>
                            {formatUSD(cs.remainingCredits)} left
                          </Text>
                        </View>
                        {/* Progress bar */}
                        <View style={{ height: 6, borderRadius: 999, backgroundColor: colors.borderSoft, overflow: "hidden" }}>
                          <View style={{ height: 6, width: `${usedPct}%`, borderRadius: 999, backgroundColor: barColor }} />
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={{ ...typography.micro, color: colors.textSecondary }}>
                            Spent: {formatUSD(cs.totalSpentUSD)}
                          </Text>
                          <Text style={{ ...typography.micro, color: colors.textSecondary }}>
                            Purchased: {formatUSD(cs.totalPurchased)}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* By brand */}
            {brandRows.length > 0 && (
              <View style={s.card}>
                <Text style={s.sectionTitle}>By Brand</Text>
                <View style={{ gap: spacing.xs }}>
                  {brandRows.map((row) => (
                    <View
                      key={row.brandId}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        paddingVertical: spacing.sm,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.borderSoft,
                      }}
                    >
                      <Text
                        style={{
                          ...typography.body,
                          color: colors.textSecondary,
                        }}
                      >
                        {row.brandId}
                      </Text>
                      <Text
                        style={{
                          ...typography.body,
                          color: colors.textPrimary,
                          fontWeight: "600",
                        }}
                      >
                        {formatUSD(row.total)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* FABs */}
      <View style={s.fabRow}>
        <Pressable
          onPress={() => router.push("/modals/add-credit" as never)}
          style={({ pressed }) => [s.fabSecondary, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel="Add credit purchase"
        >
          <Text style={s.fabSecondaryText}>+ Credits</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/modals/add-cost" as never)}
          style={({ pressed }) => [s.fab, { flex: 1 }, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel="Add cost entry"
        >
          <Text style={s.fabText}>+ Add Cost Entry</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function styles(colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    center: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
    },
    scroll: {
      padding: spacing.xl,
      gap: spacing.lg,
      paddingBottom: spacing["3xl"] * 3,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      gap: spacing.lg,
    },
    sectionTitle: {
      ...typography.h3,
      color: colors.textPrimary,
    },
    fabRow: {
      position: "absolute",
      bottom: spacing["2xl"],
      right: spacing.xl,
      left: spacing.xl,
      flexDirection: "row",
      gap: spacing.sm,
    },
    fab: {
      backgroundColor: colors.primary,
      borderRadius: radius.xl,
      paddingVertical: spacing.lg,
      alignItems: "center",
    },
    fabText: {
      ...typography.body,
      color: colors.background,
      fontWeight: "600",
    },
    fabSecondary: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.primary,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
      alignItems: "center",
      justifyContent: "center",
    },
    fabSecondaryText: {
      ...typography.body,
      color: colors.primary,
      fontWeight: "600",
    },
  });
}
