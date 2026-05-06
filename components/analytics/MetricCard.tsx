import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { Text, View, ViewStyle } from "react-native";

interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: number;
  trendLabel?: string;
  style?: ViewStyle;
}

export function MetricCard({
  label,
  value,
  trend,
  trendLabel,
  style,
}: MetricCardProps) {
  const { colors } = useTheme();

  const trendColor =
    trend === undefined
      ? colors.textMuted
      : trend > 0
        ? colors.success
        : trend < 0
          ? colors.danger
          : colors.textMuted;

  const trendArrow =
    trend === undefined ? "" : trend > 0 ? "↑" : trend < 0 ? "↓" : "—";

  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.lg,
          flex: 1,
          minWidth: 120,
        },
        style,
      ]}
    >
      <Text
        style={{
          ...typography.micro,
          color: colors.textSecondary,
          marginBottom: spacing.xs,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>

      <Text
        style={{
          ...typography.h2,
          color: colors.textPrimary,
        }}
        numberOfLines={1}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </Text>

      {trend !== undefined && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 3,
            marginTop: spacing.xs,
          }}
        >
          <Text style={{ fontSize: 12, color: trendColor, fontWeight: "600" }}>
            {trendArrow} {Math.abs(trend).toFixed(1)}%
          </Text>
          {trendLabel && (
            <Text
              style={{ ...typography.micro, color: colors.textMuted }}
              numberOfLines={1}
            >
              {trendLabel}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
