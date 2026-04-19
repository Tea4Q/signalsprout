import { spacing, radius, typography } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";
import React, { useState } from "react";
import {
    Text,
    TextInput,
    TextInputProps,
    View,
} from "react-native";

interface AppInputProps extends Omit<TextInputProps, "style"> {
  label: string;
  error?: string;
}

export function AppInput({ label, error, ...inputProps }: AppInputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ ...typography.caption, color: colors.textSecondary }}>
        {label}
      </Text>
      <TextInput
        {...inputProps}
        style={[
          {
            height: 48,
            backgroundColor: colors.surfaceAlt,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.lg,
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
