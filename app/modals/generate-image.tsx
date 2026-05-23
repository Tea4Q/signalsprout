import React, { useCallback, useState } from "react";
import {
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
import { CreativePreview } from "@/components/content/CreativePreview";
import { generateImage, GeneratedImage } from "@/services/content/imageGenerationService";
import { AppButton } from "@/components/ui/AppButton";
import { AppTextarea } from "@/components/ui/AppTextarea";
import { AppSelect, SelectOption } from "@/components/ui/AppSelect";

const PLATFORM_OPTIONS: SelectOption[] = [
  { label: "Instagram (Square)", value: "instagram" },
  { label: "Pinterest (Portrait)", value: "pinterest" },
];

export default function GenerateImageModal() {
  const { colors } = useTheme();
  const router = useRouter();
  const { workspaceId } = useWorkspace();
  const params = useLocalSearchParams<{
    brandId?: string;
    platform?: string;
    prompt?: string;
  }>();

  const [prompt, setPrompt] = useState(params.prompt ?? "");
  const [platform, setPlatform] = useState<"instagram" | "pinterest">(
    params.platform === "pinterest" ? "pinterest" : "instagram",
  );
  const [brandId] = useState(params.brandId ?? "");
  const [image, setImage] = useState<GeneratedImage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const s = styles(colors);

  const handleGenerate = useCallback(async () => {
    if (!workspaceId || !prompt.trim()) {
      setError("Please enter a prompt.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await generateImage(prompt.trim(), platform, brandId, workspaceId);
      setImage(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Image generation failed.");
    } finally {
      setLoading(false);
    }
  }, [prompt, platform, brandId, workspaceId]);

  const handleUse = useCallback(() => {
    // Return the generated image data to the caller via navigation
    // The caller can read from the route or re-open with different params.
    // For now we just go back; the asset is already persisted in Supabase Storage.
    router.back();
  }, [router]);

  return (
    <SafeAreaView style={s.safeArea}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cancel">
          <Text style={{ ...typography.body, color: colors.secondary }}>Cancel</Text>
        </Pressable>
        <Text style={{ ...typography.h3, color: colors.textPrimary }}>Generate Image</Text>
        <View style={{ width: 52 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="always"
      >
        {!!error && (
          <View style={s.errorBanner}>
            <Text style={{ ...typography.caption, color: colors.danger }}>{error}</Text>
          </View>
        )}

        <AppSelect
          label="Platform"
          value={platform}
          options={PLATFORM_OPTIONS}
          onChange={(v) => setPlatform(v as "instagram" | "pinterest")}
          disabled={loading}
        />

        <View style={{ height: spacing.lg }} />

        <AppTextarea
          label="Image Prompt"
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Describe the image you want to generate…"
          numberOfLines={5}
          editable={!loading}
        />

        <View style={{ height: spacing.md }} />

        <View style={s.sizeNotice}>
          <Text style={{ ...typography.caption, color: colors.textSecondary }}>
            📐{"  "}
            <Text style={{ fontWeight: "600" }}>Output sizes: </Text>
            Instagram 1024 × 1024 px · Pinterest 1024 × 1536 px
            {"  "}· JPEG · ~200–400 KB
          </Text>
        </View>

        <View style={{ height: spacing.xl }} />

        <CreativePreview
          publicUrl={image?.public_url ?? null}
          platform={platform}
          loading={loading}
        />

        <View style={{ height: spacing.xl }} />

        {!image ? (
          <AppButton
            label={loading ? "Generating…" : "Generate"}
            onPress={handleGenerate}
            disabled={loading || !prompt.trim()}
            loading={loading}
          />
        ) : (
          <View style={{ gap: spacing.md }}>
            <AppButton label="Use This Image" onPress={handleUse} />
            <AppButton
              label={loading ? "Regenerating…" : "Regenerate"}
              onPress={handleGenerate}
              disabled={loading}
              loading={loading}
              variant="secondary"
            />
          </View>
        )}

        {/* Revised prompt */}
        {image?.revised_prompt && (
          <View style={{ marginTop: spacing.lg, gap: spacing.xs }}>
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>
              Revised Prompt
            </Text>
            <View style={s.infoBox}>
              <Text style={{ ...typography.caption, color: colors.textMuted, fontStyle: "italic" }}>
                {image.revised_prompt}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function styles(colors: ReturnType<typeof useTheme>["colors"]) {
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
    infoBox: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sizeNotice: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
  });
}
