import React from "react";
import { Image } from "expo-image";
import { ActivityIndicator, Text, View } from "react-native";
import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

interface GeneratedImagePreviewProps {
  imageUrl: string | null;
  screenshotUrl?: string | null;
  loading?: boolean;
  emptyLabel?: string;
}

export function GeneratedImagePreview({
  imageUrl,
  screenshotUrl,
  loading = false,
  emptyLabel = "No background generated yet",
}: GeneratedImagePreviewProps) {
  const { colors } = useTheme();

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ ...typography.caption, color: colors.textSecondary }}>Generated Preview</Text>
      <View
        style={{
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceAlt,
          overflow: "hidden",
          aspectRatio: 1,
        }}
      >
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : imageUrl ? (
          <View style={{ flex: 1 }}>
            <Image source={{ uri: imageUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            {screenshotUrl ? (
              <View
                style={{
                  position: "absolute",
                  right: spacing.md,
                  bottom: spacing.md,
                  width: 120,
                  height: 180,
                  borderRadius: radius.md,
                  overflow: "hidden",
                  borderWidth: 2,
                  borderColor: colors.surface,
                  backgroundColor: colors.surface,
                }}
              >
                <Image source={{ uri: screenshotUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              </View>
            ) : null}
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
            <Text style={{ fontSize: 36 }}>🖼️</Text>
            <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.sm, textAlign: "center" }}>
              {emptyLabel}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}