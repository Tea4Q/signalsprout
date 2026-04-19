import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useWorkspace } from "@/context/workspace-context";
import { ScheduleForm } from "@/components/calendar/ScheduleForm";
import { schedulePost } from "@/services/scheduling/schedulerService";
import { getPost } from "@/services/scheduling/postService";
import { AppButton } from "@/components/ui/AppButton";
import { AppBadge } from "@/components/ui/AppBadge";
import type { Database } from "@/types/database";

type PostRow = Database["public"]["Tables"]["posts"]["Row"];

// Default schedule = tomorrow at 10:00
function defaultScheduleDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d;
}

export default function SchedulePostModal() {
  const { colors } = useTheme();
  const router = useRouter();
  const { workspaceId } = useWorkspace();
  const params = useLocalSearchParams<{ postId?: string }>();

  const [post, setPost] = useState<PostRow | null>(null);
  const [loadingPost, setLoadingPost] = useState(true);
  const [scheduledFor, setScheduledFor] = useState<Date>(defaultScheduleDate());
  const [socialAccountId, setSocialAccountId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const s = styles(colors);
  const postId = params.postId;

  useEffect(() => {
    if (!postId) {
      setLoadingPost(false);
      return;
    }
    getPost(postId)
      .then((p) => {
        setPost(p);
        if (p.social_account_id) setSocialAccountId(p.social_account_id);
        if (p.scheduled_for) setScheduledFor(new Date(p.scheduled_for));
      })
      .catch(() => setError("Failed to load post."))
      .finally(() => setLoadingPost(false));
  }, [postId]);

  const handleConfirm = useCallback(async () => {
    if (!postId) return;
    if (!socialAccountId) {
      setError("Please select a social account.");
      return;
    }
    if (scheduledFor <= new Date()) {
      setError("Please choose a future date and time.");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      // Patch social_account_id onto the post first if changed
      if (post?.social_account_id !== socialAccountId) {
        await import("@/services/scheduling/postService").then(({ updatePost }) =>
          updatePost(postId, { social_account_id: socialAccountId }),
        );
      }
      await schedulePost(postId, scheduledFor.toISOString());
      router.back();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Scheduling failed.");
    } finally {
      setSaving(false);
    }
  }, [postId, socialAccountId, scheduledFor, post, router]);

  if (!workspaceId || loadingPost) {
    return (
      <SafeAreaView style={s.safeArea}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing["3xl"] }} />
      </SafeAreaView>
    );
  }

  if (!postId || !post) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={{ padding: spacing.xl }}>
          <Text style={{ ...typography.body, color: colors.danger }}>Post not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const platform = post.platform;
  const preview = post.caption
    ? post.caption.length > 80
      ? post.caption.slice(0, 80) + "…"
      : post.caption
    : post.hook ?? "No caption";

  return (
    <SafeAreaView style={s.safeArea}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cancel">
          <Text style={{ ...typography.body, color: colors.secondary }}>Cancel</Text>
        </Pressable>
        <Text style={{ ...typography.h3, color: colors.textPrimary }}>Schedule Post</Text>
        <View style={{ width: 52 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {!!error && (
          <View style={s.errorBanner}>
            <Text style={{ ...typography.caption, color: colors.danger }}>{error}</Text>
          </View>
        )}

        {/* Post preview card */}
        <View style={s.previewCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
            <AppBadge label={platform} variant="info" />
          </View>
          <Text style={{ ...typography.body, color: colors.textPrimary }} numberOfLines={3}>
            {preview}
          </Text>
          {post.hashtags && post.hashtags.length > 0 && (
            <Text style={{ ...typography.micro, color: colors.textMuted, marginTop: spacing.xs }}>
              {post.hashtags.length} hashtags
            </Text>
          )}
        </View>

        <ScheduleForm
          workspaceId={workspaceId}
          platform={platform}
          scheduledFor={scheduledFor}
          socialAccountId={socialAccountId}
          onChangeDate={setScheduledFor}
          onChangeSocialAccount={setSocialAccountId}
        />

        <View style={{ height: spacing.xl }} />

        <AppButton
          label={saving ? "Scheduling…" : "Confirm Schedule"}
          onPress={handleConfirm}
          disabled={saving}
          loading={saving}
        />
      </ScrollView>
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
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    scrollContent: {
      padding: spacing.xl,
      paddingBottom: spacing["3xl"],
    },
    errorBanner: {
      backgroundColor: colors.accentSoft,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    previewCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.xl,
    },
  });
}
