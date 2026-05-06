import React, { useState } from "react";
import { Text, TextInput, TextInputProps, View } from "react-native";
import { radius, spacing, typography } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";

interface AppTextareaProps extends Omit<TextInputProps, "style" | "multiline"> {
  label: string;
  error?: string;
  numberOfLines?: number;
}

export function AppTextarea({
  label,
  error,
  numberOfLines = 4,
  ...inputProps
}: AppTextareaProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const minHeight = numberOfLines * 22 + spacing.lg * 2;

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ ...typography.caption, color: colors.textSecondary }}>
        {label}
      </Text>
      <TextInput
        {...inputProps}
        multiline
        numberOfLines={numberOfLines}
        textAlignVertical="top"
        style={[
          {
            minHeight,
            backgroundColor: colors.surfaceAlt,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            ...typography.body,
            color: colors.textPrimary,
          },
          focused && { borderColor: colors.secondary },
          !!error && { borderColor: colors.danger },
        ]}
        placeholderTextColor={colors.textMuted}
        onFocus={(e) => {
          setFocused(true);
          inputProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          inputProps.onBlur?.(e);
        }}
        accessibilityLabel={label}
        accessibilityHint={error}
      />
      {!!error && (
        <Text style={{ ...typography.caption, color: colors.danger }}>
          {error}
        </Text>
      )}
    </View>
  );
}
