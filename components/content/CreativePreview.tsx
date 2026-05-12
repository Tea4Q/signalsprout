import React from "react";
import { ActivityIndicator, Image, Text, View } from "react-native";
import { radius, spacing, typography } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";

const ASPECT_RATIOS: Record<"instagram" | "pinterest" | "facebook" | "tiktok", number> = {
  instagram: 1,        // 1:1
  facebook: 1,         // 1:1 (standard square page photo)
  tiktok: 9 / 16,     // 9:16 vertical (portrait photo post)
  pinterest: 2 / 3,   // 2:3 (width/height)
};

interface CreativePreviewProps {
  publicUrl: string | null;
  platform: "instagram" | "pinterest" | "facebook" | "tiktok";
  loading?: boolean;
}

export function CreativePreview({
  publicUrl,
  platform,
  loading = false,
}: CreativePreviewProps) {
  const { colors } = useTheme();
  const aspectRatio = ASPECT_RATIOS[platform];

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ ...typography.caption, color: colors.textSecondary }}>
        Creative Preview
      </Text>

      <View
        style={{
          width: "100%",
          aspectRatio,
          backgroundColor: colors.surfaceAlt,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} size="large" />
        ) : publicUrl ? (
          <Image
            source={{ uri: publicUrl }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
            accessibilityLabel="Generated creative image"
          />
        ) : (
          <View style={{ alignItems: "center", gap: spacing.sm }}>
            <Text style={{ fontSize: 32 }}>🖼️</Text>
            <Text
              style={{ ...typography.caption, color: colors.textMuted }}
            >
              No image generated yet
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
