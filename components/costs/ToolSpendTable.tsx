import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { formatCostRange, formatUSD } from "@/lib/currency";
import type { Database } from "@/types/database";
import { Text, View } from "react-native";

type CostSourceRow = Database["public"]["Tables"]["cost_sources"]["Row"];

export interface ToolSpendRow {
  source: CostSourceRow;
  actualSpend: number;
}

interface ToolSpendTableProps {
  rows: ToolSpendRow[];
}

export function ToolSpendTable({ rows }: ToolSpendTableProps) {
  const { colors } = useTheme();

  if (rows.length === 0) {
    return (
      <Text style={{ ...typography.caption, color: colors.textMuted }}>
        No tool spend data for this period.
      </Text>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {rows.map((row) => {
        const min = row.source.min_estimated_cost ?? 0;
        const max = row.source.max_estimated_cost ?? 0;
        const hasEstimate = max > 0;
        const isOver = hasEstimate && row.actualSpend > max;
        const isUnder = hasEstimate && row.actualSpend <= min;
        const statusColor = isOver
          ? colors.danger
          : isUnder
            ? colors.success
            : colors.warning;
        const statusLabel = isOver ? "Over" : isUnder ? "Under" : "On track";

        return (
          <View
            key={row.source.id}
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.lg,
              gap: spacing.sm,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{
                    ...typography.body,
                    color: colors.textPrimary,
                    fontWeight: "600",
                  }}
                >
                  {row.source.name}
                </Text>
                <Text
                  style={{ ...typography.caption, color: colors.textSecondary }}
                >
                  {row.source.vendor} · {row.source.billing_cycle}
                </Text>
              </View>

              {hasEstimate && (
                <View
                  style={{
                    backgroundColor: `${statusColor}22`,
                    borderRadius: radius.sm,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 3,
                    marginLeft: spacing.sm,
                  }}
                >
                  <Text
                    style={{
                      ...typography.micro,
                      color: statusColor,
                      fontWeight: "600",
                    }}
                  >
                    {statusLabel}
                  </Text>
                </View>
              )}
            </View>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{ ...typography.caption, color: colors.textSecondary }}
              >
                Actual:{" "}
                <Text style={{ color: colors.textPrimary, fontWeight: "500" }}>
                  {formatUSD(row.actualSpend)}
                </Text>
              </Text>
              {hasEstimate && (
                <Text
                  style={{ ...typography.caption, color: colors.textSecondary }}
                >
                  Est: {formatCostRange(min, max)}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}
