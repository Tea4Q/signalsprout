import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { spacing, typography } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";
import { useWorkspace } from "../../context/workspace-context";
import { getBrands } from "../../services/workspace/brandService";
import { getContentTypes, getToneOptions } from "../../services/content/promptTemplateService";
import { AppSelect, SelectOption } from "../ui/AppSelect";
import { AppInput } from "../ui/AppInput";
import { AppTextarea } from "../ui/AppTextarea";

const PLATFORM_OPTIONS: SelectOption[] = [
  { label: "Instagram", value: "instagram" },
  { label: "Facebook", value: "facebook" },
  { label: "TikTok", value: "tiktok" },
  { label: "Pinterest", value: "pinterest" },
];

export interface PromptBuilderValues {
  brand_id: string;
  platform: "instagram" | "pinterest" | "facebook" | "tiktok";
  content_type: string;
  tone: string;
  cta: string;
  source_material: string;
}

interface PromptBuilderProps {
  values: PromptBuilderValues;
  onChange: (values: PromptBuilderValues) => void;
}

export function PromptBuilder({ values, onChange }: PromptBuilderProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const { workspaceId } = useWorkspace();
  const [brandOptions, setBrandOptions] = useState<SelectOption[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [brandsError, setBrandsError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    setBrandsLoading(true);
    setBrandsError(null);
    getBrands(workspaceId)
      .then((brands) =>
        setBrandOptions(brands.map((b) => ({ label: b.name, value: b.id })))
      )
      .catch((e: unknown) => {
        setBrandsError(e instanceof Error ? e.message : "Failed to load brands.");
      })
      .finally(() => setBrandsLoading(false));
  }, [workspaceId]);

  const set = <K extends keyof PromptBuilderValues>(
    key: K,
    value: PromptBuilderValues[K],
  ) => onChange({ ...values, [key]: value });

  const contentTypeOptions: SelectOption[] = getContentTypes().map((t) => ({
    label: t.label,
    value: t.value,
  }));

  const toneOptions: SelectOption[] = getToneOptions().map((t) => ({
    label: t.label,
    value: t.value,
  }));

  return (
    <View style={{ gap: spacing.lg }}>
      <AppSelect
        label="Brand"
        value={values.brand_id}
        options={brandOptions}
        onChange={(v) => set("brand_id", v)}
        placeholder={brandsLoading ? "Loading brands…" : "Select a brand"}
        error={brandsError ?? undefined}
      />
      {!brandsLoading && !brandsError && brandOptions.length === 0 && (
        <View style={{ marginTop: -spacing.sm, paddingHorizontal: spacing.xs }}>
          <Text style={{ ...typography.caption, color: colors.textMuted }}>
            No brands found.{" "}
            <Pressable
              onPress={() => router.push(`/workspace/${workspaceId}/brands`)}
              accessibilityRole="link"
              style={{ display: "flex" }}
            >
              <Text style={{ ...typography.caption, color: colors.primary, textDecorationLine: "underline" }}>
                Create one in Workspace Settings.
              </Text>
            </Pressable>
          </Text>
        </View>
      )}
      <AppSelect
        label="Platform"
        value={values.platform}
        options={PLATFORM_OPTIONS}
        onChange={(v) => set("platform", v as PromptBuilderValues["platform"])}

      />
      <AppSelect
        label="Content Type"
        value={values.content_type}
        options={contentTypeOptions}
        onChange={(v) => set("content_type", v)}
        placeholder="Select content type"
      />
      <AppSelect
        label="Tone"
        value={values.tone}
        options={toneOptions}
        onChange={(v) => set("tone", v)}
        placeholder="Select tone"
      />
      <AppInput
        label="Call to Action (optional)"
        value={values.cta}
        onChangeText={(v) => set("cta", v)}
        placeholder="e.g. Shop now at our link in bio"
      />
      <AppTextarea
        label="Source Material (optional)"
        value={values.source_material}
        onChangeText={(v) => set("source_material", v)}
        placeholder="Paste product info, brief, or key points…"
        numberOfLines={4}
      />
    </View>
  );
}
