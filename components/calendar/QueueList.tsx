import { FlatList, Pressable, Text, View } from "react-native";
import { radius, spacing, typography } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";
import type { QueueItem } from "../../services/scheduling/publishQueueService";
import { AppBadge, BadgeVariant } from "../ui/AppBadge";

type PostStatus =
  | "draft"
  | "ready_for_review"
  | "approved"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "archived";

const STATUS_BADGE: Record<
  PostStatus,
  { label: string; variant: BadgeVariant }
> = {
  draft: { label: "Draft", variant: "neutral" },
  ready_for_review: { label: "Review", variant: "info" },
  approved: { label: "Approved", variant: "success" },
  scheduled: { label: "Scheduled", variant: "warning" },
  publishing: { label: "Publishing", variant: "info" },
  published: { label: "Published", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
  archived: { label: "Archived", variant: "neutral" },
};

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  pinterest: "Pinterest",
};

interface QueueListProps {
  items: QueueItem[];
  onRetry?: (postId: string) => void;
  onPress?: (postId: string) => void;
  emptyLabel?: string;
}

export function QueueList({
  items,
  onRetry,
  onPress,
  emptyLabel = "No posts in queue.",
}: QueueListProps) {
  const { colors } = useTheme();

  if (items.length === 0) {
    return (
      <View style={{ padding: spacing.xl, alignItems: "center" }}>
        <Text style={{ ...typography.body, color: colors.textMuted }}>
          {emptyLabel}
        </Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: QueueItem }) => {
    const post = item.post;
    const status = (post?.status ?? "draft") as PostStatus;
    const badge = STATUS_BADGE[status];
    const platform = post?.platform ?? "instagram";
    const scheduledTime = item.run_at
      ? new Date(item.run_at).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

    const preview = post?.caption
      ? post.caption.length > 60
        ? post.caption.slice(0, 60) + "…"
        : post.caption
      : (post?.hook ?? "No caption");

    const isFailed = status === "failed";

    return (
      <Pressable
        onPress={() => post?.id && onPress?.(post.id)}
        style={({ pressed }) => ({
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.lg,
          borderWidth: 1,
          borderColor: isFailed ? colors.danger : colors.border,
          marginBottom: spacing.md,
          opacity: pressed ? 0.85 : 1,
        })}
        accessibilityRole="button"
        accessibilityLabel={`Edit post: ${preview}`}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: spacing.sm,
          }}
        >
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text
              style={{
                ...typography.micro,
                color: colors.textMuted,
                textTransform: "uppercase",
              }}
            >
              {PLATFORM_LABEL[platform] ?? platform} · {scheduledTime}
            </Text>
            <Text
              style={{ ...typography.body, color: colors.textPrimary }}
              numberOfLines={2}
            >
              {preview}
            </Text>
            {item.last_error && (
              <Text
                style={{ ...typography.micro, color: colors.danger }}
                numberOfLines={2}
              >
                Error: {item.last_error}
              </Text>
            )}
          </View>
          <AppBadge label={badge.label} variant={badge.variant} />
        </View>

        {isFailed && onRetry && post?.id && (
          <Pressable
            onPress={() => onRetry(post.id)}
            style={({ pressed }) => ({
              marginTop: spacing.md,
              paddingVertical: spacing.xs,
              paddingHorizontal: spacing.md,
              backgroundColor: colors.accentSoft,
              borderRadius: radius.sm,
              alignSelf: "flex-start",
              opacity: pressed ? 0.7 : 1,
            })}
            accessibilityRole="button"
            accessibilityLabel="Retry publishing this post"
          >
            <Text
              style={{
                ...typography.caption,
                color: colors.accent,
                fontWeight: "600",
              }}
            >
              Retry
            </Text>
          </Pressable>
        )}
      </Pressable>
    );
  };

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.id}
      renderItem={renderItem}
      scrollEnabled={false}
      contentContainerStyle={{ paddingVertical: spacing.sm }}
    />
  );
}


