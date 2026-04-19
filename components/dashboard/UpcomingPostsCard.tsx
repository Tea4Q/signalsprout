import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { formatScheduledTime } from "@/lib/date";
import type { QueueItem } from "@/services/scheduling/publishQueueService";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SkeletonBox } from "../ui/SkeletonBox";

interface UpcomingPostsCardProps {
  items: QueueItem[];
  loading: boolean;
}

const PLATFORM_ICON: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  instagram: "photo-camera",
  pinterest: "push-pin",
};

const PLATFORM_COLOR: Record<string, string> = {
  instagram: "#E1306C",
  pinterest: "#E60023",
};

export function UpcomingPostsCard({ items, loading }: UpcomingPostsCardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.xl,
        gap: spacing.md,
      }}
    >
      {/* Header row */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ ...typography.caption, color: colors.textSecondary }}>
          Upcoming Posts
        </Text>
        <Pressable
          onPress={() => router.push("/(tabs)/calendar" as never)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="View full calendar"
        >
          <Text style={{ ...typography.micro, color: colors.primary }}>
            View Calendar →
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={{ gap: spacing.sm }}>
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
            >
              <SkeletonBox width={32} height={32} borderRadius={8} />
              <View style={{ flex: 1, gap: 4 }}>
                <SkeletonBox height={12} width="70%" />
                <SkeletonBox height={10} width="40%" />
              </View>
            </View>
          ))}
        </View>
      ) : items.length === 0 ? (
        <View
          style={{
            alignItems: "center",
            paddingVertical: spacing.xl,
            gap: spacing.sm,
          }}
        >
          <MaterialIcons
            name="calendar-today"
            size={28}
            color={colors.textMuted}
          />
          <Text style={{ ...typography.caption, color: colors.textMuted }}>
            No posts scheduled
          </Text>
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {items.map((item) => {
            const platform = item.post?.platform ?? "instagram";
            const platformIcon = PLATFORM_ICON[platform] ?? "photo-camera";
            const platformColor =
              PLATFORM_COLOR[platform] ?? colors.textMuted;
            const label =
              item.post?.title ??
              item.post?.hook ??
              item.post?.caption?.slice(0, 50) ??
              "Untitled post";
            const runAt = formatScheduledTime(item.run_at);

            return (
              <View
                key={item.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  paddingVertical: spacing.xs,
                }}
              >
                {/* Platform icon */}
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: radius.sm,
                    backgroundColor: colors.surfaceAlt,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialIcons
                    name={platformIcon}
                    size={16}
                    color={platformColor}
                  />
                </View>

                {/* Label + time */}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={{
                      ...typography.caption,
                      color: colors.textPrimary,
                      fontWeight: "500",
                    }}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                  <Text
                    style={{ ...typography.micro, color: colors.textMuted }}
                  >
                    {runAt}
                  </Text>
                </View>

                {/* Failed indicator */}
                {item.status === "failed" && (
                  <MaterialIcons
                    name="error-outline"
                    size={16}
                    color={colors.danger}
                  />
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
