import React from "react";
import { Pressable, Text, View } from "react-native";
import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { MarketingImageFormat } from "@/services/content/marketingImagePromptBuilder";

const FORMATS: Array<{
  value: MarketingImageFormat;
  label: string;
  description: string;
}> = [
  { value: "instagram-square", label: "Instagram Square", description: "1080 x 1080" },
  { value: "instagram-story", label: "Instagram Story", description: "1080 x 1920" },
  { value: "pinterest-pin", label: "Pinterest Pin", description: "1000 x 1500" },
  { value: "facebook-post", label: "Facebook Post", description: "1200 x 630" },
  { value: "linkedin-post", label: "LinkedIn Post", description: "1200 x 627" },
];

interface SocialFormatSelectorProps {
  value: MarketingImageFormat;
  onChange: (value: MarketingImageFormat) => void;
  disabled?: boolean;
}

export function SocialFormatSelector({ value, onChange, disabled = false }: SocialFormatSelectorProps) {
  const { colors } = useTheme();

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ ...typography.caption, color: colors.textSecondary }}>Platform Format</Text>
      <View style={{ gap: spacing.sm }}>
        {FORMATS.map((format) => {
          const active = value === format.value;
          return (
            <Pressable
              key={format.value}
              disabled={disabled}
              onPress={() => onChange(format.value)}
              style={{
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.primarySoft : colors.surface,
                padding: spacing.md,
                opacity: disabled ? 0.6 : 1,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md }}>
                <Text style={{ ...typography.body, color: colors.textPrimary, fontWeight: "600" }}>
                  {format.label}
                </Text>
                <Text style={{ ...typography.caption, color: colors.textMuted }}>
                  {format.description}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}