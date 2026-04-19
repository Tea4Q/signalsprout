import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useWorkspace } from "@/context/workspace-context";
import { getPosts } from "@/services/scheduling/postService";
import { AppBadge, BadgeVariant } from "@/components/ui/AppBadge";
import type { Database } from "@/types/database";

type PostRow = Database["public"]["Tables"]["posts"]["Row"];
type PostStatus = Database["public"]["Enums"]["post_status"];

const STATUS_BADGE: Record<PostStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: "Draft", variant: "neutral" },
  ready_for_review: { label: "Review", variant: "info" },
  approved: { label: "Approved", variant: "success" },
  scheduled: { label: "Scheduled", variant: "warning" },
  publishing: { label: "Publishing", variant: "info" },
  published: { label: "Published", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
  archived: { label: "Archived", variant: "neutral" },
};

export default function ContentScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { workspaceId, loading: loadingWorkspace } = useWorkspace();
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const s = styles(colors);

  const loadPosts = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getPosts(workspaceId);
      setPosts(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load posts.");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!loadingWorkspace) loadPosts();
  }, [loadingWorkspace, loadPosts]);

  const openCreatePost = () => router.push("/modals/create-post");

  const renderPost = ({ item }: { item: PostRow }) => {
    const badge = STATUS_BADGE[item.status];
    const preview = item.caption
      ? item.caption.length > 80
        ? item.caption.slice(0, 80) + "…"
        : item.caption
      : item.hook ?? "No caption";

    return (
      <View style={s.postCard}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.caption, color: colors.textMuted, textTransform: "uppercase", marginBottom: spacing.xs }}>
              {item.platform}
            </Text>
            <Text style={{ ...typography.body, color: colors.textPrimary }} numberOfLines={3}>
              {preview}
            </Text>
            {item.hashtags && item.hashtags.length > 0 && (
              <Text style={{ ...typography.micro, color: colors.textMuted, marginTop: spacing.xs }}>
                {item.hashtags.length} hashtags
              </Text>
            )}
          </View>
          <AppBadge label={badge.label} variant={badge.variant} />
        </View>
        <Text style={{ ...typography.micro, color: colors.textMuted, marginTop: spacing.sm }}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
    );
  };

  if (loadingWorkspace) {
    return (
      <SafeAreaView style={s.safeArea}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing["3xl"] }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.header}>
        <Text style={{ ...typography.h2, color: colors.textPrimary }}>Content Studio</Text>
        <Pressable
          onPress={openCreatePost}
          style={s.fab}
          accessibilityRole="button"
          accessibilityLabel="Create new post"
        >
          <Text style={{ ...typography.body, color: colors.background, fontWeight: "700" }}>+ New</Text>
        </Pressable>
      </View>

      {loading && posts.length === 0 ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing["3xl"] }} />
      ) : error ? (
        <View style={{ padding: spacing.xl }}>
          <Text style={{ ...typography.body, color: colors.danger }}>{error}</Text>
        </View>
      ) : posts.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 40, marginBottom: spacing.md }}>✍️</Text>
          <Text style={{ ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm }}>
            No posts yet
          </Text>
          <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: "center" }}>
            Tap "New" to generate your first AI-powered post.
          </Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          renderItem={renderPost}
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
          onRefresh={loadPosts}
          refreshing={loading}
        />
      )}
    </SafeAreaView>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function styles(colors: any) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    fab: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.xl,
    },
    postCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
    },
  });
}
