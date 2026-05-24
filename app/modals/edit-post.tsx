import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  Platform
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useWorkspace } from "@/context/workspace-context";
import { CaptionEditor } from "@/components/content/CaptionEditor";
import { CreativePreview } from "@/components/content/CreativePreview";
import { HashtagList } from "@/components/content/HashtagList";
import { ScheduleForm } from "@/components/calendar/ScheduleForm";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { AppBadge, BadgeVariant } from "@/components/ui/AppBadge";
import { AppSelect, SelectOption } from "@/components/ui/AppSelect";
import {
  getPost,
  updatePost,
  deletePost,
  linkPostAsset,
} from "@/services/scheduling/postService";
import {
  schedulePost,
  cancelSchedule,
  publishNow,
} from "@/services/scheduling/schedulerService";
import { generateImage, GeneratedImage } from "@/services/content/imageGenerationService";
import { uploadExternalImage, uploadVideo } from "@/services/content/assetService";
import { AssetPickerSheet } from "@/components/assets/AssetPickerSheet";
import { supabase } from "@/lib/supabase";
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
  const [socialAccounts, setSocialAccounts] = useState<SelectOption[]>([]);

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Image / video state
  const [image, setImage] = useState<GeneratedImage | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");

  const s = styles(colors);

  useEffect(() => {
    if (!postId) {
      setLoadingPost(false);
      return;
    }
    (async () => {
      try {
        const p = await getPost(postId);
        setPost(p);
        setCaption(p.caption ?? "");
        setHashtags((p.hashtags as string[] | null) ?? []);
        setDestinationUrl(p.destination_url ?? "");
        const scheduled = p.status === "scheduled";
        setIsScheduled(scheduled);
        if (p.scheduled_for) setScheduledFor(new Date(p.scheduled_for));
        if (p.social_account_id) setSocialAccountId(p.social_account_id);

        // Load social accounts for the post's platform
        supabase
          .from("social_accounts")
          .select("id, account_name")
          .eq("workspace_id", workspaceId ?? "")
          .eq("platform", p.platform)
          .eq("status", "active")
          .then(({ data }) => {
            const opts = (data ?? []).map((a) => ({ label: a.account_name, value: a.id }));
            setSocialAccounts(opts);
            // Auto-select if there's only one
            if (!p.social_account_id && opts.length === 1) setSocialAccountId(opts[0].value);
          });

        // Load existing post assets
        const { data: assetData } = await supabase
          .from("post_assets")
          .select("assets(id, file_path, mime_type)")
          .eq("post_id", p.id)
          .order("sort_order")
          .limit(1)
          .single();
        if (assetData) {
          const asset = (assetData as { assets: { id: string; file_path: string; mime_type: string | null } | null }).assets;
          if (asset?.file_path) {
            const { data: urlData } = supabase.storage.from("assets").getPublicUrl(asset.file_path);
            setExistingImageUrl(urlData.publicUrl);
          }
        }
      } catch {
        setError("Failed to load post.");
      } finally {
        setLoadingPost(false);
      }
    })();
  }, [postId]);

  const handleAddHashtag = useCallback(() => {
    const tag = newHashtag.trim().replace(/^#+/, "");
    if (!tag) return;
    const formatted = `#${tag}`;
    setHashtags((prev) => (prev.includes(formatted) ? prev : [...prev, formatted]));
    setNewHashtag("");
  }, [newHashtag]);

  const handleGenerateImage = useCallback(async () => {
    if (!workspaceId || !post) return;
    if (!imagePrompt.trim()) {
      setError("Please enter a prompt for the image.");
      return;
    }
    setError(null);
    setGeneratingImage(true);
    try {
      const result = await generateImage(
        imagePrompt.trim(),
        post.platform as "instagram" | "pinterest",
        post.brand_id,
        workspaceId,
      );
      setImage(result);
      setExistingImageUrl(null);
      await linkPostAsset(post.id, result.asset_id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Image generation failed.");
    } finally {
      setGeneratingImage(false);
    }
  }, [workspaceId, post, imagePrompt]);

  const handleUploadImage = useCallback(async () => {
    if (!workspaceId || !post) return;
    setError(null);
    setUploadingImage(true);
    try {
      const result = await uploadExternalImage(workspaceId, post.brand_id);
      setImage(result);
      setExistingImageUrl(null);
      await linkPostAsset(post.id, result.asset_id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload failed.";
      if (msg !== "No image selected.") setError(msg);
    } finally {
      setUploadingImage(false);
    }
  }, [workspaceId, post]);

  const handleUploadVideo = useCallback(async () => {
    if (!workspaceId || !post) return;
    setError(null);
    setUploadingVideo(true);
    try {
      const result = await uploadVideo(workspaceId, post.brand_id);
      setImage(result);
      setExistingImageUrl(null);
      await linkPostAsset(post.id, result.asset_id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload failed.";
      if (msg !== "No video selected.") setError(msg);
    } finally {
      setUploadingVideo(false);
    }
  }, [workspaceId, post]);

  const handleSave = useCallback(async () => {
    if (!postId || !post) return;

    const hasMedia = !!(image || existingImageUrl);
    const isVideoPost = post.media_type === "video";
    if (isVideoPost && (post.platform === "instagram" || post.platform === "tiktok") && !hasMedia) {
      setError("A video file is required for this post. Upload one above.");
      return;
    }
    if (!isVideoPost && (post.platform === "instagram" || post.platform === "pinterest") && !hasMedia) {
      setError("An image is required for Instagram and Pinterest posts. Generate or upload one above.");
      return;
    }

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
      // Treat failed posts the same as scheduled — they had a schedule, user is choosing to unschedule
      const wasScheduled = post.status === "scheduled" || post.status === "failed";

      if (wasScheduled && !isScheduled) {
        // Cancel/clean up publish jobs, then revert to draft
        await cancelSchedule(postId);
        await updatePost(postId, {
          caption,
          hashtags,
          destination_url: destinationUrl.trim() || null,
          social_account_id: socialAccountId,
          status: "draft",
          scheduled_for: null,
          failure_reason: null,
        });
        // Navigate to Content Studio so the user can see the draft
        router.replace("/(tabs)/content");
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
        router.back();
      }
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
    image,
    existingImageUrl,
    router,
  ]);

  const handlePublishNow = useCallback(() => {
  if (!postId || !post) return;

  if (!socialAccountId) {
    setError("Please select a social account before publishing.");
    return;
  }

  const doPublish = async () => {
    setPublishing(true);
    setError(null);
    try {
      await updatePost(postId, {
        caption,
        hashtags,
        destination_url: destinationUrl.trim() || null,
        social_account_id: socialAccountId,
        status: "approved",
      });
      await publishNow(postId);
      router.back();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Publish failed.");
      setPublishing(false);
    }
  };

  if (Platform.OS === "web") {
    if (window.confirm("Publish this post immediately to your connected social account?")) {
      doPublish();
    }
  } else {
    Alert.alert(
      "Publish Now",
      "This will save your current edits and immediately publish the post.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Publish", onPress: doPublish },
      ],
    );
  }
}, [postId, post, caption, hashtags, destinationUrl, socialAccountId, router]);

  const handleDelete = useCallback(() => {
    if (!postId || !post) return;
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
  }, [postId, post, router]);

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
            {/* Post Preview */}
            <View style={s.previewCard}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
                <View style={{
                  width: 8, height: 8, borderRadius: 4,
                  backgroundColor: post.platform === "instagram" ? "#E1306C" : post.platform === "pinterest" ? "#E60023" : colors.primary,
                }} />
                <Text style={{ ...typography.micro, color: colors.textMuted, textTransform: "uppercase", fontWeight: "600", letterSpacing: 0.5 }}>
                  {post.platform} preview
                </Text>
              </View>
              {caption ? (
                <Text style={{ ...typography.body, color: colors.textPrimary, lineHeight: 22 }} numberOfLines={5}>
                  {caption}
                </Text>
              ) : (
                <Text style={{ ...typography.body, color: colors.textMuted }}>No caption yet…</Text>
              )}
              {hashtags.length > 0 && (
                <Text style={{ ...typography.caption, color: colors.secondary, marginTop: spacing.sm }} numberOfLines={2}>
                  {hashtags.join(" ")}
                </Text>
              )}
            </View>

            <View style={{ height: spacing.lg }} />

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
                  label=""
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

            {/* Media section — Image or Video depending on post.media_type */}
            <View style={s.imageSection}>
              {post.media_type === "video" ? (
                <>
                  <Text style={{ ...typography.caption, color: colors.textSecondary, fontWeight: "600", marginBottom: spacing.sm }}>
                    VIDEO
                  </Text>
                  {/* Video placeholder */}
                  <View
                    style={[
                      s.videoPlaceholder,
                      { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                    ]}
                  >
                    {image || existingImageUrl ? (
                      <View style={{ alignItems: "center", gap: spacing.sm }}>
                        <Text style={{ fontSize: 40 }}>🎬</Text>
                        <Text style={{ ...typography.body, color: colors.textPrimary, fontWeight: "600" }} numberOfLines={1}>
                          {(image as (GeneratedImage & { fileName?: string }) | null)?.fileName ?? "Video file"}
                        </Text>
                        <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                          {post.platform === "tiktok" ? "TikTok Video" : "Instagram Reel"}
                        </Text>
                      </View>
                    ) : (
                      <View style={{ alignItems: "center", gap: spacing.sm }}>
                        <Text style={{ fontSize: 40 }}>📹</Text>
                        <Text style={{ ...typography.caption, color: colors.textMuted, textAlign: "center" }}>
                          {post.platform === "tiktok"
                            ? "No video linked. Upload a video file to post on TikTok."
                            : "No video linked. Upload a video file to post as an Instagram Reel."}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={{ height: spacing.md }} />
                  <AppButton
                    label={uploadingVideo ? "Uploading…" : image || existingImageUrl ? "Replace Video" : "Upload Video"}
                    onPress={handleUploadVideo}
                    disabled={uploadingVideo}
                    loading={uploadingVideo}
                    variant={image || existingImageUrl ? "secondary" : "primary"}
                  />
                </>
              ) : (
                <>
                  <Text style={{ ...typography.caption, color: colors.textSecondary, fontWeight: "600", marginBottom: spacing.sm }}>
                    IMAGE
                  </Text>
                  <CreativePreview
                    publicUrl={image?.public_url ?? existingImageUrl}
                    platform={post.platform as "instagram" | "pinterest"}
                    loading={generatingImage}
                    caption={caption}
                    hashtags={hashtags}
                  />
                  <View style={{ height: spacing.md }} />
                  <AppInput
                    label="Image Prompt"
                    value={imagePrompt}
                    onChangeText={setImagePrompt}
                    placeholder="Describe the image to generate…"
                  />
                  <View style={{ height: spacing.sm }} />
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <AppButton
                        label={generatingImage ? "Generating…" : image || existingImageUrl ? "Regenerate" : "Generate"}
                        onPress={handleGenerateImage}
                        disabled={generatingImage || uploadingImage || !imagePrompt.trim()}
                        loading={generatingImage}
                        variant={image || existingImageUrl ? "secondary" : "primary"}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppButton
                        label={uploadingImage ? "Uploading…" : "Upload Image"}
                        onPress={handleUploadImage}
                        disabled={generatingImage || uploadingImage}
                        loading={uploadingImage}
                        variant="secondary"
                      />
                    </View>
                  </View>
                  <View style={{ height: spacing.sm }} />
                  <AppButton
                    label="Use from Library"
                    onPress={() => setShowLibraryPicker(true)}
                    disabled={generatingImage || uploadingImage}
                    variant="secondary"
                  />
                </>
              )}
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

            {/* Social account — always visible so Post Now works without scheduling */}
            <AppSelect
              label={`${post.platform.charAt(0).toUpperCase() + post.platform.slice(1)} Account`}
              value={socialAccountId}
              options={socialAccounts}
              onChange={setSocialAccountId}
              placeholder="Select account"
            />

            <View style={{ height: spacing.xl }} />

            {/* Schedule toggle */}}
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
                  hideAccountSelector
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
              disabled={saving || publishing}
              loading={saving}
            />

            <View style={{ height: spacing.md }} />

            <Pressable
              onPress={handlePublishNow}
              disabled={publishing || saving}
              style={({ pressed }) => [
                s.publishNowButton,
                { opacity: pressed || publishing || saving ? 0.7 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Publish post now"
            >
              <Text style={{ ...typography.body, color: colors.background, fontWeight: "600" }}>
                {publishing ? "Publishing…" : "⚡ Post Now"}
              </Text>
            </Pressable>

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
      {workspaceId && (
        <AssetPickerSheet
          visible={showLibraryPicker}
          workspaceId={workspaceId}
          onClose={() => setShowLibraryPicker(false)}
          onSelect={(picked) => {
            setImage(picked);
            setShowLibraryPicker(false);
          }}
        />
      )}
    </SafeAreaView>
  );
}

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
    imageSection: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    videoPlaceholder: {
      borderRadius: radius.xl,
      borderWidth: 1,
      borderStyle: "dashed",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing["3xl"],
      paddingHorizontal: spacing.xl,
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
    previewCard: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    publishNowButton: {
      height: 48,
      borderRadius: radius.md,
      backgroundColor: colors.accent,
      alignItems: "center" as const,
      justifyContent: "center" as const,
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
