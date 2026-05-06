import { spacing, radius, typography } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";
import React from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text
} from "react-native";

export type AppButtonVariant = "primary" | "secondary" | "destructive";

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: AppButtonVariant;
  loading?: boolean;
  disabled?: boolean;
}

export function AppButton({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
}: AppButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const variantStyle = {
    primary: { backgroundColor: colors.primary },
    secondary: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
    destructive: { backgroundColor: colors.danger },
  }[variant];

  const labelColor = variant === "secondary" ? colors.textPrimary : colors.background;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyle,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator size="small" color={labelColor} />
      ) : (
        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },

  // Label base
  label: {
    ...typography.body,
    fontWeight: "600",
  },

  // States
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.82,
  },
});
