import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { radius, spacing, typography } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";

interface HashtagListProps {
  hashtags: string[];
  onRemove?: (tag: string) => void;
  label?: string;
}

export function HashtagList({
  hashtags,
  onRemove,
  label = "Hashtags",
}: HashtagListProps) {
  const { colors } = useTheme();

  if (hashtags.length === 0) return null;

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
        <Text style={{ ...typography.micro, color: colors.textMuted }}>
          {hashtags.length} tags
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexDirection: "row", gap: spacing.sm, paddingVertical: 2 }}
      >
        {hashtags.map((tag) => (
          <Pressable
            key={tag}
            onPress={() => onRemove?.(tag)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
              backgroundColor: colors.secondarySoft,
              borderRadius: radius.sm,
              paddingHorizontal: spacing.sm,
              paddingVertical: 5,
              opacity: pressed ? 0.7 : 1,
            })}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${tag}`}
          >
            <Text
              style={{
                ...typography.micro,
                color: colors.secondary,
                fontWeight: "600",
              }}
            >
              {tag.startsWith("#") ? tag : `#${tag}`}
            </Text>
            {onRemove && (
              <Text
                style={{
                  ...typography.micro,
                  color: colors.secondary,
                  fontWeight: "600",
                }}
              >
                ×
              </Text>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
