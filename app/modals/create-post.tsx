import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
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

  const s = styles(colors);

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
    setStep(4);
  }, []);

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
        title: form.platform === "pinterest" ? (content?.pin_title ?? null) : null,
        destination_url: destinationUrl.trim() || null,
        status: schedule ? "scheduled" : "draft",
        scheduled_for: scheduledAt,
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
  }, [form, workspaceId, content, caption, hashtags, destinationUrl, image, isCharacterRef, scheduledFor, router]);

  // ── Step 4: publish immediately ───────────────────────────────────────────
  const handlePublishNow = useCallback(async () => {
    if (!workspaceId) return;
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
        title: form.platform === "pinterest" ? (content?.pin_title ?? null) : null,
        destination_url: destinationUrl.trim() || null,
        status: "approved",
        scheduled_for: null,
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
  }, [form, workspaceId, content, caption, hashtags, destinationUrl, image, isCharacterRef, router]);

  const handleBack = () => {
    if (step > 1) setStep((s) => s - 1);
    else router.back();
  };

  const removeHashtag = (tag: string) =>
    setHashtags((prev) => prev.filter((t) => t !== tag));

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

        {/* ── Step 4: Review & Save ── */}
        {step === 4 && (
          <View style={{ gap: spacing.xl }}>
            {/* Summary */}
            <View style={s.summaryCard}>
              <SummaryRow label="Platform" value={form.platform} />
              <SummaryRow label="Caption length" value={`${caption.length} characters`} />
              <SummaryRow label="Hashtags" value={`${hashtags.length} tags`} />
              {image && <SummaryRow label="Image" value="Attached" />}
            </View>

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
                disabled={publishing || saving}
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
  });
}
