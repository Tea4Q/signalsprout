import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { Text, View, ViewStyle } from "react-native";
import { spacing, typography } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";
import { AppButton } from "./AppButton";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  style?: ViewStyle;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  style,
}: ErrorStateProps) {
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
      <MaterialIcons name="error-outline" size={52} color={colors.danger} />
      <Text style={{ ...typography.h3, color: colors.textPrimary, textAlign: "center" }}>
        {title}
      </Text>
      <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: "center" }}>
        {message}
      </Text>
      {onRetry && (
        <View style={{ marginTop: spacing.md, alignSelf: "stretch" }}>
          <AppButton label="Try again" onPress={onRetry} variant="secondary" />
        </View>
      )}
    </View>
  );
}
