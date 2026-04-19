import React from "react";
import { Text, View, ViewStyle } from "react-native";
import { spacing, typography } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";
import { AppCard } from "./AppCard";

export type TrendDirection = "up" | "down" | "neutral";

interface StatCardProps {
  label: string;
  value: string | number;
  subLabel?: string;
  trend?: TrendDirection;
  style?: ViewStyle;
}

export function StatCard({
  label,
  value,
  subLabel,
  trend,
  style,
}: StatCardProps) {
  const { colors } = useTheme();

  const trendColor: Record<TrendDirection, string> = {
    up: colors.success,
    down: colors.danger,
    neutral: colors.textMuted,
  };

  const trendIcon: Record<TrendDirection, string> = {
    up: "↑",
    down: "↓",
    neutral: "—",
  };

  return (
    <AppCard style={style}>
      <Text
        style={{
          ...typography.caption,
          color: colors.textSecondary,
          marginBottom: spacing.xs,
        }}
      >
        {label}
      </Text>
      <Text style={{ ...typography.h2, color: colors.textPrimary }}>
        {value}
      </Text>
      {(!!subLabel || !!trend) && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            marginTop: spacing.xs,
          }}
        >
          {!!trend && (
            <Text
              style={{
                ...typography.caption,
                color: trendColor[trend],
                fontWeight: "600",
              }}
            >
              {trendIcon[trend]}
            </Text>
          )}
          {!!subLabel && (
            <Text
              style={{
                ...typography.caption,
                color: trend ? trendColor[trend] : colors.textMuted,
              }}
            >
              {subLabel}
            </Text>
          )}
        </View>
      )}
    </AppCard>
  );
}
