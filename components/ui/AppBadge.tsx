import React from "react";
import { Text, View, ViewStyle } from "react-native";
import { radius, spacing, typography } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";

export type BadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

interface AppBadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

export function AppBadge({ label, variant = "neutral", style }: AppBadgeProps) {
  const { colors } = useTheme();

  const variantMap: Record<BadgeVariant, { bg: string; text: string }> = {
    success: { bg: colors.primarySoft, text: colors.primary },
    warning: { bg: colors.accentSoft, text: colors.warning },
    danger: { bg: colors.accentSoft, text: colors.danger },
    info: { bg: colors.secondarySoft, text: colors.info },
    neutral: { bg: colors.borderSoft, text: colors.textSecondary },
  };

  const { bg, text } = variantMap[variant];

  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: radius.sm,
          paddingHorizontal: spacing.sm,
          paddingVertical: 3,
          alignSelf: "flex-start",
        },
        style,
      ]}
    >
      <Text
        style={{
          ...typography.micro,
          color: text,
          fontWeight: "600",
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
