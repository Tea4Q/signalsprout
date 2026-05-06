import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { Text, View, ViewStyle } from "react-native";
import { spacing, typography } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";
import { AppButton } from "./AppButton";

interface EmptyStateProps {
  icon?: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
  style?: ViewStyle;
}

export function EmptyState({
  icon = "inbox",
  title,
  subtitle,
  ctaLabel,
  onCta,
  style,
}: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: spacing["2xl"],
          paddingVertical: spacing["3xl"],
          gap: spacing.md,
        },
        style,
      ]}
    >
      <MaterialIcons name={icon} size={52} color={colors.textMuted} />

      <Text
        style={{
          ...typography.h3,
          color: colors.textPrimary,
          textAlign: "center",
          marginTop: spacing.sm,
        }}
      >
        {title}
      </Text>

      {!!subtitle && (
        <Text
          style={{
            ...typography.body,
            color: colors.textSecondary,
            textAlign: "center",
          }}
        >
          {subtitle}
        </Text>
      )}

      {!!ctaLabel && !!onCta && (
        <View style={{ marginTop: spacing.md, alignSelf: "stretch" }}>
          <AppButton label={ctaLabel} onPress={onCta} />
        </View>
      )}
    </View>
  );
}
