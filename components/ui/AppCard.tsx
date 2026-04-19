import { radius, spacing } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";
import React from "react";
import { View, ViewStyle } from "react-native";

interface AppCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: "md" | "lg" | "xl";
}

export function AppCard({ children, style, padding = "lg" }: AppCardProps) {
  const { colors } = useTheme();
  const paddingMap = { md: spacing.md, lg: spacing.lg, xl: spacing.xl };

  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          elevation: 2,
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
          padding: paddingMap[padding],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
