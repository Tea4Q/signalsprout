import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useWorkspace } from "@/context/workspace-context";
import { PromptBuilder, PromptBuilderValues } from "@/components/content/PromptBuilder";
import { CaptionEditor } from "@/components/content/CaptionEditor";
import { HashtagList } from "@/components/content/HashtagList";
import { CreativePreview } from "@/components/content/CreativePreview";
import { generateContent, GeneratedContent } from "@/services/content/contentGenerationService";
import { generateImage, GeneratedImage } from "@/services/content/imageGenerationService";
import { createPost, linkPostAsset } from "@/services/scheduling/postService";
import { publishNow, schedulePost } from "@/services/scheduling/schedulerService";
import { uploadExternalImage,
  setAsCharacterReference,
  getCharacterReference,
} from "@/services/content/assetService";
import { AssetPickerSheet } from "@/components/assets/AssetPickerSheet";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { AppSelect, SelectOption } from "@/components/ui/AppSelect";
import { supabase } from "@/lib/supabase";

const TOTAL_STEPS = 4;

const DEFAULT_FORM: PromptBuilderValues = {
  brand_id: "",
  platform: "instagram",
  content_type: "",
  tone: "",
  cta: "",
  source_material: "",
};

export default function CreatePostModal() {
  const { colors } = useTheme();
  const router = useRouter();
  const { workspaceId } = useWorkspace();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<PromptBuilderValues>(DEFAULT_FORM);
  const [content, setContent] = useState<GeneratedContent | null>(null);
  const [image, setImage] = useState<GeneratedImage | null>(null);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [destinationUrl, setDestinationUrl] = useState("");
  const [isCharacterRef, setIsCharacterRef] = useState(false);
  const [existingCharRef, setExistingCharRef] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [socialAccountId, setSocialAccountId] = useState<string | null>(null);
  const [socialAccounts, setSocialAccounts] = useState<SelectOption[]>([]);
  const [pinTitle, setPinTitle] = useState("");
  const [newHashtag, setNewHashtag] = useState("");

  const s = styles(colors);

  // ── Step 4: load social accounts for the selected platform ───────────────
  useEffect(() => {
    if (step !== 4 || !workspaceId) return;
    supabase
      .from("social_accounts")
      .select("id, account_name, platform")
      .eq("workspace_id", workspaceId)
      .eq("platform", form.platform)
      .eq("status", "active")
      .then(({ data }) => {
        const opts = (data ?? []).map((a) => ({ label: a.account_name, value: a.id }));
        setSocialAccounts(opts);
        if (opts.length === 1) setSocialAccountId(opts[0].value);
      });
  }, [step, workspaceId, form.platform]);

  // ── Step 1 → Step 2: generate content ──────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!workspaceId) return;
    if (!form.brand_id || !form.content_type || !form.tone) {
      setError("Please select a brand, content type, and tone.");
      return;
    }
    setError(null);
    setGenerating(true);
    try {
      const result = await generateContent({
        brand_id: form.brand_id,
        workspace_id: workspaceId,
        platform: form.platform,
        content_type: form.content_type,
        tone: form.tone,
        cta: form.cta || undefined,
        source_material: form.source_material || undefined,
      });
      setContent(result);
      setCaption(result.caption);
      setHashtags(result.hashtags);
      setStep(2);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }, [form, workspaceId]);

  // ── Step 2 → Step 3: go to image step ────────────────────────────────────
  const handleToImageStep = useCallback(() => {
    setStep(3);
  }, []);

  // ── Step 3: check for existing character reference ────────────────────────
  React.useEffect(() => {
    if (step === 3 && form.brand_id) {
      getCharacterReference(form.brand_id).then((ref) => {
        setExistingCharRef(ref !== null);
      });
    }
  }, [step, form.brand_id]);

  // ── Step 3: generate image ────────────────────────────────────────────────
  const handleGenerateImage = useCallback(async () => {
    if (!workspaceId || !content) return;
    setError(null);
    setGeneratingImage(true);
    try {
      const result = await generateImage(
        content.image_prompt,
        form.platform,
        form.brand_id,
        workspaceId,
      );
      setImage(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Image generation failed.");
    } finally {
      setGeneratingImage(false);
    }
  }, [content, form.platform, form.brand_id, workspaceId]);

  const handleRegenerateImage = useCallback(async () => {
    if (!workspaceId || !content) return;
    setError(null);
    setGeneratingImage(true);
    try {
      const result = await generateImage(
        content.image_prompt,
        form.platform,
        form.brand_id,
        workspaceId,
      );
      setImage(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Image regeneration failed.");
    } finally {
      setGeneratingImage(false);
    }
  }, [content, form.platform, form.brand_id, workspaceId]);

  // ── Step 3: upload image from device ────────────────────────────────────
  const handleUploadImage = useCallback(async () => {
    if (!workspaceId || !form.brand_id) return;
    setError(null);
    setUploadingImage(true);
    try {
      const result = await uploadExternalImage(workspaceId, form.brand_id);
      setImage(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload failed.";
      if (msg !== "No image selected.") setError(msg);
    } finally {
      setUploadingImage(false);
    }
  }, [workspaceId, form.brand_id]);

  // ── Step 3 → Step 4: review ───────────────────────────────────────────────
  const handleToReview = useCallback(() => {
    setPinTitle(content?.pin_title ?? "");
    setStep(4);
  }, [content]);

  // ── Step 4: save (draft or scheduled) ────────────────────────────────────
  const handleSave = useCallback(async (schedule: boolean) => {
    if (!workspaceId) return;

    let scheduledAt: string | null = null;
    if (schedule) {
      if (!scheduledFor.trim()) {
        setError("Please enter a scheduled date and time.");
        return;
      }
      const parsed = new Date(scheduledFor.trim());
      if (isNaN(parsed.getTime())) {
        setError("Invalid date — use format YYYY-MM-DD HH:MM.");
        return;
      }
      if (parsed <= new Date()) {
        setError("Scheduled time must be in the future.");
        return;
      }
      scheduledAt = parsed.toISOString();
    }

    setError(null);
    setSaving(true);
    try {
      const post = await createPost({
        brand_id: form.brand_id,
        workspace_id: workspaceId,
        platform: form.platform,
        hook: content?.hook ?? null,
        caption,
        hashtags,
        title: form.platform === "pinterest" ? (pinTitle.trim() || null) : null,
        destination_url: destinationUrl.trim() || null,
        status: schedule ? "scheduled" : "draft",
        scheduled_for: scheduledAt,
        social_account_id: socialAccountId ?? null,
      });
      if (image) {
        await linkPostAsset(post.id, image.asset_id);
        if (isCharacterRef) {
          await setAsCharacterReference(image.asset_id, form.brand_id);
        }
      }
      if (scheduledAt) {
        await schedulePost(post.id, scheduledAt);
      }
      router.back();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [form, workspaceId, content, caption, hashtags, pinTitle, destinationUrl, image, isCharacterRef, scheduledFor, socialAccountId, router]);

  // ── Step 4: publish immediately ───────────────────────────────────────────
  const handlePublishNow = useCallback(async () => {
    if (!workspaceId) return;
    if (!socialAccountId) {
      setError("Please select a social account before publishing.");
      return;
    }
    setError(null);
    setPublishing(true);
    try {
      const post = await createPost({
        brand_id: form.brand_id,
        workspace_id: workspaceId,
        platform: form.platform,
        hook: content?.hook ?? null,
        caption,
        hashtags,
        title: form.platform === "pinterest" ? (pinTitle.trim() || null) : null,
        destination_url: destinationUrl.trim() || null,
        status: "approved",
        scheduled_for: null,
        social_account_id: socialAccountId,
      });
      if (image) {
        await linkPostAsset(post.id, image.asset_id);
        if (isCharacterRef) {
          await setAsCharacterReference(image.asset_id, form.brand_id);
        }
      }
      await publishNow(post.id);
      router.back();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Publish failed.");
    } finally {
      setPublishing(false);
    }
  }, [form, workspaceId, content, caption, hashtags, pinTitle, destinationUrl, image, isCharacterRef, socialAccountId, router]);

  const handleBack = () => {
    if (step > 1) setStep((s) => s - 1);
    else router.back();
  };

  const removeHashtag = (tag: string) =>
    setHashtags((prev) => prev.filter((t) => t !== tag));

  const handleAddHashtag = useCallback(() => {
    const tag = newHashtag.trim().replace(/^#+/, "");
    if (!tag) return;
    const formatted = `#${tag}`;
    setHashtags((prev) => (prev.includes(formatted) ? prev : [...prev, formatted]));
    setNewHashtag("");
  }, [newHashtag]);

  return (
    <SafeAreaView style={s.safeArea}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={handleBack} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={{ ...typography.body, color: colors.secondary }}>
            {step === 1 ? "Cancel" : "Back"}
          </Text>
        </Pressable>
        <Text style={{ ...typography.h3, color: colors.textPrimary }}>
          {step === 1
            ? "New Post"
            : step === 2
            ? "Review Content"
            : step === 3
            ? "Add Creative"
            : "Review & Save"}
        </Text>
        <Text style={{ ...typography.caption, color: colors.textMuted }}>
          {step}/{TOTAL_STEPS}
        </Text>
      </View>

      {/* Step indicator */}
      <View style={s.stepIndicator}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <View
            key={i}
            style={[
              s.stepDot,
              { backgroundColor: i + 1 <= step ? colors.primary : colors.border },
            ]}
          />
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Error banner */}
        {!!error && (
          <View style={s.errorBanner}>
            <Text style={{ ...typography.caption, color: colors.danger }}>{error}</Text>
          </View>
        )}

        {/* ── Step 1: Build Prompt ── */}
        {step === 1 && (
          <View style={{ gap: spacing.xl }}>
            <PromptBuilder values={form} onChange={setForm} />
            <AppButton
              label={generating ? "Generating…" : "Generate Content"}
              onPress={handleGenerate}
              disabled={generating}
              loading={generating}
            />
          </View>
        )}

        {/* ── Step 2: Review Caption & Hashtags ── */}
        {step === 2 && content && (
          <View style={{ gap: spacing.xl }}>
            {/* Hook */}
            <View style={{ gap: spacing.xs }}>
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                Hook
              </Text>
              <View style={s.infoBox}>
                <Text style={{ ...typography.body, color: colors.textPrimary }}>
                  {content.hook}
                </Text>
              </View>
            </View>

            <CaptionEditor
              value={caption}
              onChange={setCaption}
              platform={form.platform}
            />

            <HashtagList
              hashtags={hashtags}
              onRemove={removeHashtag}
            />

            {/* Pinterest extras */}
            {form.platform === "pinterest" && (
              <>
                <View style={{ gap: spacing.xs }}>
                  <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                    Pin Title
                  </Text>
                  <View style={s.infoBox}>
                    <Text style={{ ...typography.body, color: colors.textPrimary }}>
                      {content.pin_title}
                    </Text>
                  </View>
                </View>
                <View style={{ gap: spacing.xs }}>
                  <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                    Pin Description
                  </Text>
                  <View style={s.infoBox}>
                    <Text style={{ ...typography.body, color: colors.textPrimary }}>
                      {content.pin_description}
                    </Text>
                  </View>
                </View>
              </>
            )}

            {/* Destination URL */}
            <AppInput
              label={
                form.platform === "pinterest"
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

            {/* Image prompt preview */}
            <View style={{ gap: spacing.xs }}>
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                Suggested Image Prompt
              </Text>
              <View style={s.infoBox}>
                <Text style={{ ...typography.caption, color: colors.textSecondary, fontStyle: "italic" }}>
                  {content.image_prompt}
                </Text>
              </View>
            </View>

            <AppButton label="Continue to Image" onPress={handleToImageStep} />
          </View>
        )}

        {/* ── Step 3: Generate Image ── */}
        {step === 3 && content && (
          <View style={{ gap: spacing.xl }}>
            <CreativePreview
              publicUrl={image?.public_url ?? null}
              platform={form.platform}
              loading={generatingImage}
            />

            {!image ? (
              <View style={{ gap: spacing.md }}>
                <AppButton
                  label={generatingImage ? "Generating Image…" : "Generate Image"}
                  onPress={handleGenerateImage}
                  disabled={generatingImage || uploadingImage}
                  loading={generatingImage}
                />
                <AppButton
                  label={uploadingImage ? "Uploading…" : "Upload from Device"}
                  onPress={handleUploadImage}
                  disabled={uploadingImage || generatingImage}
                  loading={uploadingImage}
                  variant="secondary"
                />
              </View>
            ) : (
              <View style={{ gap: spacing.md }}>
                <AppButton
                  label="Continue to Review"
                  onPress={handleToReview}
                />
                <AppButton
                  label={generatingImage ? "Regenerating…" : "Regenerate"}
                  onPress={handleRegenerateImage}
                  disabled={generatingImage || uploadingImage}
                  loading={generatingImage}
                  variant="secondary"
                />
                <AppButton
                  label={uploadingImage ? "Uploading…" : "Upload Different Image"}
                  onPress={handleUploadImage}
                  disabled={uploadingImage || generatingImage}
                  loading={uploadingImage}
                  variant="secondary"
                />
              </View>
            )}

            {image && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  paddingVertical: spacing.xs,
                }}
              >
                <Switch
                  value={isCharacterRef}
                  onValueChange={setIsCharacterRef}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                  accessibilityLabel="Set as brand character"
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.body, color: colors.textPrimary }}>
                    Set as brand character
                  </Text>
                  <Text style={{ ...typography.caption, color: colors.textMuted }}>
                    {existingCharRef
                      ? "Replaces existing character for this brand"
                      : "This image will be used in future AI generations"}
                  </Text>
                </View>
              </View>
            )}

            {!image && (
              <Pressable onPress={handleToReview} accessibilityRole="button">
                <Text style={{ ...typography.caption, color: colors.textMuted, textAlign: "center" }}>
                  Skip — save without image
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* ── Step 4: Review & Edit ── */}
        {step === 4 && (
          <View style={{ gap: spacing.xl }}>
            {/* Platform card preview with inline editing */}
            <View style={s.pinCard}>
              {/* Card header */}
              <View style={s.pinCardHeader}>
                <View style={[s.platformDot, {
                  backgroundColor: form.platform === "pinterest" ? "#E60023"
                    : form.platform === "instagram" ? "#C13584"
                    : colors.primary,
                }]} />
                <Text style={{ ...typography.micro, color: colors.textMuted, textTransform: "uppercase", fontWeight: "600", letterSpacing: 0.8 }}>
                  {form.platform === "pinterest" ? "Pinterest Pin Preview"
                    : form.platform === "instagram" ? "Instagram Post Preview"
                    : `${form.platform.charAt(0).toUpperCase()}${form.platform.slice(1)} Post Preview`}
                </Text>
                {(generatingImage || uploadingImage) && (
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: "auto" }} />
                )}
              </View>

              {/* Image area */}
              <View style={[s.pinImageArea, {
                aspectRatio: form.platform === "pinterest" ? 2 / 3 : 4 / 5,
              }]}>
                {image?.public_url ? (
                  <Image
                    source={{ uri: image.public_url }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                    accessibilityLabel="Post image preview"
                  />
                ) : (
                  <View style={s.pinImagePlaceholder}>
                    <Text style={{ fontSize: 36 }}>🖼️</Text>
                    <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xs }}>
                      No image
                    </Text>
                  </View>
                )}
                <View style={s.imageOverlay}>
                  <Pressable
                    style={s.imageOverlayBtn}
                    onPress={handleRegenerateImage}
                    disabled={generatingImage || uploadingImage}
                    accessibilityLabel="Regenerate image"
                  >
                    <Text style={{ ...typography.micro, color: "#fff", fontWeight: "600" }}>
                      {generatingImage ? "…" : "↺ Regen"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={s.imageOverlayBtn}
                    onPress={handleUploadImage}
                    disabled={generatingImage || uploadingImage}
                    accessibilityLabel="Upload different image"
                  >
                    <Text style={{ ...typography.micro, color: "#fff", fontWeight: "600" }}>↑ Upload</Text>
                  </Pressable>
                </View>
              </View>

              {/* Editable content area */}
              <View style={s.pinContent}>
                {/* Pin Title — Pinterest only */}
                {form.platform === "pinterest" && (
                  <View style={s.pinFieldGroup}>
                    <Text style={{ ...typography.micro, color: colors.textMuted, textTransform: "uppercase", fontWeight: "600", letterSpacing: 0.6, marginBottom: spacing.xs }}>
                      Pin Title
                    </Text>
                    <TextInput
                      style={[s.pinTitleInput, { color: colors.textPrimary, borderColor: colors.border }]}
                      value={pinTitle}
                      onChangeText={setPinTitle}
                      placeholder="Enter pin title…"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                )}

                {/* Caption */}
                <View style={s.pinFieldGroup}>
                  <Text style={{ ...typography.micro, color: colors.textMuted, textTransform: "uppercase", fontWeight: "600", letterSpacing: 0.6, marginBottom: spacing.xs }}>
                    Caption
                  </Text>
                  <TextInput
                    style={[s.pinCaptionInput, { color: colors.textPrimary, borderColor: colors.border }]}
                    value={caption}
                    onChangeText={setCaption}
                    multiline
                    placeholder="Write a caption…"
                    placeholderTextColor={colors.textMuted}
                    textAlignVertical="top"
                  />
                </View>

                {/* Hashtags */}
                <View style={s.pinFieldGroup}>
                  <Text style={{ ...typography.micro, color: colors.textMuted, textTransform: "uppercase", fontWeight: "600", letterSpacing: 0.6, marginBottom: spacing.xs }}>
                    Hashtags
                  </Text>
                  {hashtags.length > 0 && (
                    <View style={s.hashtagRow}>
                      {hashtags.map((tag) => (
                        <Pressable key={tag} onPress={() => removeHashtag(tag)} style={[s.hashtagPill, { backgroundColor: colors.secondarySoft }]} accessibilityLabel={`Remove ${tag}`}>
                          <Text style={{ ...typography.micro, color: colors.secondary }}>{tag} ×</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  <View style={s.addHashtagRow}>
                    <View style={{ flex: 1 }}>
                      <AppInput
                        label=""
                        value={newHashtag}
                        onChangeText={setNewHashtag}
                        placeholder="Add hashtag…"
                        autoCapitalize="none"
                        returnKeyType="done"
                        onSubmitEditing={handleAddHashtag}
                      />
                    </View>
                    <Pressable
                      style={[s.addHashtagBtn, { backgroundColor: colors.primarySoft }]}
                      onPress={handleAddHashtag}
                      accessibilityLabel="Add hashtag"
                    >
                      <Text style={{ ...typography.h3, color: colors.primary, lineHeight: 24 }}>+</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Destination URL */}
                <AppInput
                  label={form.platform === "pinterest" ? "Destination URL (optional)" : "Link in Bio URL (optional)"}
                  value={destinationUrl}
                  onChangeText={setDestinationUrl}
                  placeholder="https://"
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Social account picker */}
            {socialAccounts.length > 0 ? (
              <AppSelect
                label={`${form.platform.charAt(0).toUpperCase()}${form.platform.slice(1)} Account`}
                value={socialAccountId}
                options={socialAccounts}
                onChange={setSocialAccountId}
                placeholder="Select account to publish to"
              />
            ) : (
              <View style={[s.infoBox, { borderColor: colors.warning + "66", backgroundColor: colors.accentSoft }]}>
                <Text style={{ ...typography.caption, color: colors.warning }}>
                  No {form.platform} account connected. Go to Social Accounts to connect one.
                </Text>
              </View>
            )}

            {/* Schedule toggle */}
            <View style={s.scheduleRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.body, color: colors.textPrimary }}>Schedule for later</Text>
                <Text style={{ ...typography.caption, color: colors.textMuted }}>
                  Pick a future date and time to publish
                </Text>
              </View>
              <Switch
                value={isScheduled}
                onValueChange={setIsScheduled}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.background}
                accessibilityLabel="Schedule post"
              />
            </View>

            {isScheduled && (
              <AppInput
                label="Publish at (YYYY-MM-DD HH:MM)"
                value={scheduledFor}
                onChangeText={setScheduledFor}
                placeholder="2026-05-01 09:00"
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
              />
            )}

            <View style={{ gap: spacing.md }}>
              <AppButton
                label={publishing ? "Publishing…" : "Publish Now"}
                onPress={handlePublishNow}
                disabled={publishing || saving || !socialAccountId}
                loading={publishing}
              />
              {isScheduled ? (
                <AppButton
                  label={saving ? "Scheduling…" : "Schedule Post"}
                  onPress={() => handleSave(true)}
                  disabled={saving || publishing}
                  loading={saving}
                  variant="secondary"
                />
              ) : (
                <AppButton
                  label={saving ? "Saving…" : "Save as Draft"}
                  onPress={() => handleSave(false)}
                  disabled={saving || publishing}
                  loading={saving}
                  variant="secondary"
                />
              )}
            </View>
          </View>
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.xs }}>
      <Text style={{ ...typography.caption, color: colors.textSecondary }}>{label}</Text>
      <Text style={{ ...typography.caption, color: colors.textPrimary, fontWeight: "600" }}>{value}</Text>
    </View>
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
    stepIndicator: {
      flexDirection: "row",
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
    },
    stepDot: {
      flex: 1,
      height: 3,
      borderRadius: 2,
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
    infoBox: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.xs,
    },
    scheduleRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.md,
    },
    // ── Pin card styles ──────────────────────────────────────────────────────
    pinCard: {
      backgroundColor: colors.surface,
      borderRadius: radius["2xl"],
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    pinCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    platformDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    pinImageArea: {
      width: "100%",
      backgroundColor: colors.surfaceAlt,
      position: "relative",
    },
    pinImagePlaceholder: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing["3xl"],
    },
    imageOverlay: {
      position: "absolute",
      bottom: spacing.sm,
      right: spacing.sm,
      flexDirection: "row",
      gap: spacing.xs,
    },
    imageOverlayBtn: {
      backgroundColor: "rgba(0,0,0,0.55)",
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    pinContent: {
      padding: spacing.lg,
      gap: spacing.lg,
    },
    pinFieldGroup: {
      gap: spacing.xs,
    },
    pinTitleInput: {
      fontSize: 20,
      fontWeight: "700" as const,
      borderBottomWidth: 1,
      paddingVertical: spacing.xs,
      paddingHorizontal: 0,
    },
    pinCaptionInput: {
      fontSize: 14,
      lineHeight: 20,
      borderWidth: 1,
      borderRadius: radius.md,
      padding: spacing.sm,
      minHeight: 80,
    },
    hashtagRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    hashtagPill: {
      borderRadius: 100,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
    },
    addHashtagRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    addHashtagBtn: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
  });
}
