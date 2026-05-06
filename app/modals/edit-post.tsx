import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useWorkspace } from "@/context/workspace-context";
import { CaptionEditor } from "@/components/content/CaptionEditor";
import { HashtagList } from "@/components/content/HashtagList";
import { ScheduleForm } from "@/components/calendar/ScheduleForm";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { AppBadge, BadgeVariant } from "@/components/ui/AppBadge";
import {
  getPost,
  updatePost,
  deletePost,
} from "@/services/scheduling/postService";
import {
  schedulePost,
  cancelSchedule,
} from "@/services/scheduling/schedulerService";
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

function defaultScheduleDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d;
}

// Posts in these states cannot be edited
const READ_ONLY_STATUSES: PostStatus[] = ["published", "publishing", "archived"];

export default function EditPostModal() {
  const { colors } = useTheme();
  const router = useRouter();
  const { workspaceId } = useWorkspace();
  const params = useLocalSearchParams<{ postId?: string }>();
  const postId = params.postId;

  const [post, setPost] = useState<PostRow | null>(null);
  const [loadingPost, setLoadingPost] = useState(true);

  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [newHashtag, setNewHashtag] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");

  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledFor, setScheduledFor] = useState<Date>(defaultScheduleDate());
  const [socialAccountId, setSocialAccountId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const s = styles(colors);

  useEffect(() => {
    if (!postId) {
      setLoadingPost(false);
      return;
    }
    getPost(postId)
      .then((p) => {
        setPost(p);
        setCaption(p.caption ?? "");
        setHashtags((p.hashtags as string[] | null) ?? []);
        setDestinationUrl(p.destination_url ?? "");
        const scheduled = p.status === "scheduled";
        setIsScheduled(scheduled);
        if (p.scheduled_for) setScheduledFor(new Date(p.scheduled_for));
        if (p.social_account_id) setSocialAccountId(p.social_account_id);
      })
      .catch(() => setError("Failed to load post."))
      .finally(() => setLoadingPost(false));
  }, [postId]);

  const handleAddHashtag = useCallback(() => {
    const tag = newHashtag.trim().replace(/^#+/, "");
    if (!tag) return;
    const formatted = `#${tag}`;
    setHashtags((prev) => (prev.includes(formatted) ? prev : [...prev, formatted]));
    setNewHashtag("");
  }, [newHashtag]);

  const handleSave = useCallback(async () => {
    if (!postId || !post) return;

    if (isScheduled) {
      if (!socialAccountId) {
        setError("Please select a social account.");
        return;
      }
      if (scheduledFor <= new Date()) {
        setError("Please choose a future date and time.");
        return;
      }
    }

    setError(null);
    setSaving(true);
    try {
      const wasScheduled = post.status === "scheduled";

      if (wasScheduled && !isScheduled) {
        // Cancel queued publish jobs, then set to draft
        await cancelSchedule(postId);
        await updatePost(postId, {
          caption,
          hashtags,
          destination_url: destinationUrl.trim() || null,
          social_account_id: socialAccountId,
          status: "draft",
          scheduled_for: null,
        });
      } else {
        await updatePost(postId, {
          caption,
          hashtags,
          destination_url: destinationUrl.trim() || null,
          social_account_id: socialAccountId,
        });
        if (isScheduled) {
          await schedulePost(postId, scheduledFor.toISOString());
        }
      }

      router.back();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [
    postId,
    post,
    caption,
    hashtags,
    destinationUrl,
    isScheduled,
    scheduledFor,
    socialAccountId,
    router,
  ]);

  const handleDelete = useCallback(() => {
    if (!postId) return;
    Alert.alert(
      "Delete Post",
      "This post will be permanently deleted. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deletePost(postId);
              router.back();
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : "Delete failed.");
              setDeleting(false);
            }
          },
        },
      ],
    );
  }, [postId, router]);

  if (!workspaceId || loadingPost) {
    return (
      <SafeAreaView style={s.safeArea}>
        <ActivityIndicator
          color={colors.primary}
          style={{ marginTop: spacing["3xl"] }}
        />
      </SafeAreaView>
    );
  }

  if (!postId || !post) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={{ padding: spacing.xl }}>
          <Text style={{ ...typography.body, color: colors.danger }}>
            Post not found.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isReadOnly = READ_ONLY_STATUSES.includes(post.status);
  const statusBadge = STATUS_BADGE[post.status];

  return (
    <SafeAreaView style={s.safeArea}>
      {/* Header */}
      <View style={s.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Text style={{ ...typography.body, color: colors.secondary }}>
            Cancel
          </Text>
        </Pressable>
        <Text style={{ ...typography.h3, color: colors.textPrimary }}>
          Edit Post
        </Text>
        {isReadOnly ? (
          <View style={{ width: 52 }} />
        ) : (
          <Pressable
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Save changes"
          >
            <Text
              style={{
                ...typography.body,
                color: saving ? colors.textMuted : colors.primary,
                fontWeight: "600",
              }}
            >
              {saving ? "Saving…" : "Save"}
            </Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {!!error && (
          <View style={s.errorBanner}>
            <Text style={{ ...typography.caption, color: colors.danger }}>
              {error}
            </Text>
          </View>
        )}

        {/* Status & platform badges */}
        <View
          style={{
            flexDirection: "row",
            gap: spacing.sm,
            marginBottom: spacing.xl,
          }}
        >
          <AppBadge label={post.platform} variant="info" />
          <AppBadge label={statusBadge.label} variant={statusBadge.variant} />
        </View>

        {isReadOnly ? (
          <View style={s.readOnlyBanner}>
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>
              This post has been {post.status} and cannot be edited.
            </Text>
          </View>
        ) : (
          <>
            {/* Caption */}
            <CaptionEditor
              value={caption}
              onChange={setCaption}
              platform={post.platform as "instagram" | "pinterest"}
            />

            <View style={{ height: spacing.lg }} />

            {/* Hashtags */}
            <HashtagList
              hashtags={hashtags}
              onRemove={(tag) =>
                setHashtags((prev) => prev.filter((t) => t !== tag))
              }
            />

            {/* Add hashtag */}
            <View style={s.addTagRow}>
              <View style={{ flex: 1 }}>
                <AppInput
                  value={newHashtag}
                  onChangeText={setNewHashtag}
                  placeholder="Add hashtag"
                  onSubmitEditing={handleAddHashtag}
                  returnKeyType="done"
                />
              </View>
              <Pressable
                onPress={handleAddHashtag}
                style={s.addTagButton}
                accessibilityRole="button"
                accessibilityLabel="Add hashtag"
              >
                <Text
                  style={{
                    ...typography.body,
                    color: colors.background,
                    fontWeight: "700",
                  }}
                >
                  +
                </Text>
              </Pressable>
            </View>

            <View style={{ height: spacing.xl }} />

            {/* Destination URL */}
            <AppInput
              label={
                post.platform === "pinterest"
                  ? "Destination URL (optional)"
                  : "Link in Bio URL (optional)"
              }
              value={destinationUrl}
              onChangeText={setDestinationUrl}
              placeholder="https://"
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={{ height: spacing.xl }} />

            {/* Schedule toggle */}
            <View style={s.scheduleRow}>
              <Text style={{ ...typography.body, color: colors.textPrimary }}>
                Schedule for later
              </Text>
              <Switch
                value={isScheduled}
                onValueChange={setIsScheduled}
                trackColor={{ true: colors.primary }}
                thumbColor={colors.background}
              />
            </View>

            {isScheduled && (
              <View style={{ marginTop: spacing.lg }}>
                <ScheduleForm
                  workspaceId={workspaceId}
                  platform={post.platform as "instagram" | "pinterest"}
                  scheduledFor={scheduledFor}
                  socialAccountId={socialAccountId}
                  onChangeDate={setScheduledFor}
                  onChangeSocialAccount={setSocialAccountId}
                />
              </View>
            )}

            <View style={{ height: spacing.lg }} />

            <AppButton
              label={
                saving
                  ? "Saving…"
                  : isScheduled
                  ? "Save & Schedule"
                  : "Save as Draft"
              }
              onPress={handleSave}
              disabled={saving}
              loading={saving}
            />

            <View style={{ height: spacing["3xl"] }} />

            {/* Delete */}
            <Pressable
              onPress={handleDelete}
              disabled={deleting}
              style={({ pressed }) => [
                s.deleteButton,
                { opacity: pressed || deleting ? 0.6 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Delete this post"
            >
              <Text
                style={{
                  ...typography.body,
                  color: colors.danger,
                  fontWeight: "600",
                }}
              >
                {deleting ? "Deleting…" : "Delete Post"}
              </Text>
            </Pressable>
          </>
        )}
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
    readOnlyBanner: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    addTagRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    addTagButton: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    scheduleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    deleteButton: {
      alignItems: "center",
      paddingVertical: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.danger + "40",
      backgroundColor: colors.danger + "10",
    },
  });
}
