import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { formatUSD } from "@/lib/currency";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

export interface CostCategoryBreakdown {
  label: string;
  amount: number;
  color: string;
}

export interface CostSummaryData {
  totalThisMonth: number;
  byCategory: CostCategoryBreakdown[];
}

interface CostSummaryCardProps {
  data: CostSummaryData | null;
  loading?: boolean;
  onPress?: () => void;
}

export function CostSummaryCard({
  data,
  loading,
  onPress,
}: CostSummaryCardProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.xl,
        gap: spacing.md,
      })}
      accessibilityRole="button"
      accessibilityLabel="View cost summary"
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ ...typography.caption, color: colors.textSecondary }}>
          Spend This Month
        </Text>
        <Text style={{ ...typography.micro, color: colors.primary }}>
          View Costs →
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} size="small" />
      ) : (
        <>
          <Text style={{ ...typography.h2, color: colors.textPrimary }}>
            {formatUSD(data?.totalThisMonth ?? 0)}
          </Text>

          {data && data.byCategory.length > 0 && (
            <View style={{ gap: spacing.xs }}>
              {data.byCategory.slice(0, 3).map((c) => (
                <View
                  key={c.label}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      backgroundColor: c.color,
                    }}
                  />
                  <Text
                    style={{
                      ...typography.micro,
                      color: colors.textSecondary,
                      flex: 1,
                    }}
                  >
                    {c.label}
                  </Text>
                  <Text
                    style={{ ...typography.micro, color: colors.textPrimary }}
                  >
                    {formatUSD(c.amount)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </Pressable>
  );
}
