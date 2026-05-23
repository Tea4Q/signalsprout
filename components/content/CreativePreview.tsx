import React from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { radius, spacing, typography } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";

const ASPECT_RATIOS: Record<"instagram" | "pinterest" | "facebook" | "tiktok", number> = {
  instagram: 4 / 5,   // 4:5 portrait — most-used IG feed format
  facebook: 1,         // 1:1 square
  tiktok: 9 / 16,     // 9:16 vertical
  pinterest: 2 / 3,   // 2:3
};

interface CreativePreviewProps {
  publicUrl: string | null;
  platform: "instagram" | "pinterest" | "facebook" | "tiktok";
  loading?: boolean;
  caption?: string;
  hashtags?: string[];
}

export function CreativePreview({
  publicUrl,
  platform,
  loading = false,
  caption,
  hashtags,
}: CreativePreviewProps) {
  const { colors } = useTheme();
  const aspectRatio = ASPECT_RATIOS[platform];

  if (platform === "instagram") {
    return (
      <View style={[igStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Header row */}
        <View style={igStyles.header}>
          <View style={[igStyles.avatar, { backgroundColor: colors.primarySoft }]}>
            <Text style={{ fontSize: 14 }}>👤</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[igStyles.username, { color: colors.textPrimary }]}>your_brand</Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 18, lineHeight: 18 }}>•••</Text>
        </View>

        {/* Image */}
        <View style={{ width: "100%", aspectRatio, backgroundColor: colors.surfaceAlt, overflow: "hidden" }}>
          {loading ? (
            <View style={igStyles.imagePlaceholder}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : publicUrl ? (
            <Image
              source={{ uri: publicUrl }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
              accessibilityLabel="Post image preview"
            />
          ) : (
            <View style={igStyles.imagePlaceholder}>
              <Text style={{ fontSize: 36 }}>🖼️</Text>
              <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.sm }}>
                No image yet
              </Text>
            </View>
          )}
        </View>

        {/* Action bar */}
        <View style={igStyles.actionBar}>
          <View style={igStyles.actionLeft}>
            <Text style={igStyles.actionIcon}>♡</Text>
            <Text style={igStyles.actionIcon}>💬</Text>
            <Text style={igStyles.actionIcon}>↗</Text>
          </View>
          <Text style={igStyles.actionIcon}>🔖</Text>
        </View>

        {/* Caption */}
        {(caption || (hashtags && hashtags.length > 0)) && (
          <View style={igStyles.captionArea}>
            {caption ? (
              <Text style={[igStyles.captionText, { color: colors.textPrimary }]} numberOfLines={3}>
                <Text style={{ fontWeight: "700" }}>your_brand </Text>
                {caption}
              </Text>
            ) : null}
            {hashtags && hashtags.length > 0 && (
              <Text style={[igStyles.hashtagText, { color: colors.secondary }]} numberOfLines={2}>
                {hashtags.join(" ")}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  }

  // Non-Instagram: simple labelled box
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
            accessibilityLabel="Post image preview"
          />
        ) : (
          <View style={{ alignItems: "center", gap: spacing.sm }}>
            <Text style={{ fontSize: 32 }}>🖼️</Text>
            <Text style={{ ...typography.caption, color: colors.textMuted }}>
              No image generated yet
            </Text>
          </View>
        )}
      </View>
      {(caption || (hashtags && hashtags.length > 0)) && (
        <View style={{ gap: spacing.xs, paddingHorizontal: spacing.xs }}>
          {caption ? (
            <Text style={{ ...typography.caption, color: colors.textPrimary }} numberOfLines={3}>
              {caption}
            </Text>
          ) : null}
          {hashtags && hashtags.length > 0 && (
            <Text style={{ ...typography.caption, color: colors.secondary }} numberOfLines={2}>
              {hashtags.join(" ")}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const igStyles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  username: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 16,
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionLeft: {
    flexDirection: "row",
    gap: 14,
  },
  actionIcon: {
    fontSize: 22,
    lineHeight: 26,
  },
  captionArea: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 4,
  },
  captionText: {
    fontSize: 13,
    lineHeight: 18,
  },
  hashtagText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
