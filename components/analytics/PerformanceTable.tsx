import { spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { PostPerformanceRow } from "@/services/analytics/reportingService";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppBadge } from "../ui/AppBadge";

export type SortKey =
  | "impressions"
  | "saves"
  | "outbound_clicks"
  | "engagement_rate";

interface PerformanceTableProps {
  rows: PostPerformanceRow[];
  sortKey: SortKey;
  onSort: (key: SortKey) => void;
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "impressions", label: "Impressions" },
  { key: "saves", label: "Saves" },
  { key: "outbound_clicks", label: "Clicks" },
  { key: "engagement_rate", label: "Eng %" },
];

export function PerformanceTable({
  rows,
  sortKey,
  onSort,
}: PerformanceTableProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.postCell}>
            <Text style={styles.headerText}>Post</Text>
          </View>
          {COLUMNS.map((col) => (
            <Pressable
              key={col.key}
              style={styles.metricCell}
              onPress={() => onSort(col.key)}
              accessibilityRole="button"
              accessibilityLabel={`Sort by ${col.label}`}
            >
              <Text
                style={[
                  styles.headerText,
                  sortKey === col.key && styles.headerTextActive,
                ]}
              >
                {col.label} {sortKey === col.key ? "↓" : ""}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Body */}
        {rows.length === 0 ? (
          <View style={styles.emptyRow}>
            <Text style={styles.emptyText}>
              No published posts with metrics yet.
            </Text>
          </View>
        ) : (
          rows.map((row) => (
            <View key={row.postId} style={styles.dataRow}>
              <View style={styles.postCell}>
                <AppBadge
                  label={row.platform}
                  variant={row.platform === "instagram" ? "info" : "danger"}
                  style={{ marginBottom: spacing.xs }}
                />
                <Text style={styles.postTitle} numberOfLines={2}>
                  {row.title ?? row.hook ?? "—"}
                </Text>
              </View>
              <View style={styles.metricCell}>
                <Text style={styles.metricValue}>
                  {row.impressions.toLocaleString()}
                </Text>
              </View>
              <View style={styles.metricCell}>
                <Text style={styles.metricValue}>
                  {row.saves.toLocaleString()}
                </Text>
              </View>
              <View style={styles.metricCell}>
                <Text style={styles.metricValue}>
                  {row.outbound_clicks.toLocaleString()}
                </Text>
              </View>
              <View style={styles.metricCell}>
                <Text style={styles.metricValue}>
                  {(row.engagement_rate * 100).toFixed(2)}%
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

type ThemeColors = ReturnType<
  typeof import("@/hooks/use-theme").useTheme
>["colors"];

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    headerRow: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderColor: colors.border,
      paddingBottom: spacing.sm,
      marginBottom: spacing.xs,
    },
    dataRow: {
      flexDirection: "row",
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    postCell: {
      width: 180,
      paddingRight: spacing.md,
    },
    metricCell: {
      width: 90,
      alignItems: "flex-end",
      justifyContent: "center",
    },
    headerText: {
      ...typography.micro,
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      textAlign: "right",
    },
    headerTextActive: {
      color: colors.primary,
    },
    postTitle: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    metricValue: {
      ...typography.caption,
      color: colors.textPrimary,
      fontWeight: "500",
    },
    emptyRow: {
      paddingVertical: spacing.xl,
      alignItems: "center",
    },
    emptyText: {
      ...typography.caption,
      color: colors.textMuted,
    },
  });
}
