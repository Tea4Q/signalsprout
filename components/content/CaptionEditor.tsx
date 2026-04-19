import React, { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { radius, spacing, typography } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";

const CHAR_LIMITS: Record<"instagram" | "pinterest", number> = {
  instagram: 2200,
  pinterest: 500,
};

interface CaptionEditorProps {
  value: string;
  onChange: (text: string) => void;
  platform: "instagram" | "pinterest";
  label?: string;
}

export function CaptionEditor({
  value,
  onChange,
  platform,
  label = "Caption",
}: CaptionEditorProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const limit = CHAR_LIMITS[platform];
  const count = value.length;
  const overLimit = count > limit;

  return (
    <View style={{ gap: spacing.xs }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ ...typography.caption, color: colors.textSecondary }}>
          {label}
        </Text>
        <Text
          style={{
            ...typography.micro,
            color: overLimit ? colors.danger : colors.textMuted,
            fontWeight: overLimit ? "600" : "400",
          }}
        >
          {count}/{limit}
        </Text>
      </View>

      <TextInput
        value={value}
        onChangeText={onChange}
        multiline
        textAlignVertical="top"
        style={[
          {
            minHeight: 140,
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
          overLimit && { borderColor: colors.danger },
        ]}
        placeholderTextColor={colors.textMuted}
        placeholder="Write your caption here…"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={label}
      />

      {overLimit && (
        <Text style={{ ...typography.caption, color: colors.danger }}>
          Caption exceeds {platform} limit of {limit} characters.
        </Text>
      )}
    </View>
  );
}
