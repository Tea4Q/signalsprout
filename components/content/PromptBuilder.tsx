import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { spacing } from "../../constants/theme";
import { useWorkspace } from "../../context/workspace-context";
import { getBrands } from "../../services/workspace/brandService";
import { getContentTypes, getToneOptions } from "../../services/content/promptTemplateService";
import { AppSelect, SelectOption } from "../ui/AppSelect";
import { AppInput } from "../ui/AppInput";
import { AppTextarea } from "../ui/AppTextarea";

const PLATFORM_OPTIONS: SelectOption[] = [
  { label: "Instagram", value: "instagram" },
  { label: "Pinterest", value: "pinterest" },
];

export interface PromptBuilderValues {
  brand_id: string;
  platform: "instagram" | "pinterest";
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
  const { workspaceId } = useWorkspace();
  const [brandOptions, setBrandOptions] = useState<SelectOption[]>([]);

  useEffect(() => {
    if (!workspaceId) return;
    getBrands(workspaceId)
      .then((brands) =>
        setBrandOptions(brands.map((b) => ({ label: b.name, value: b.id })))
      )
      .catch(() => {});
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
        placeholder="Select a brand"
      />
      <AppSelect
        label="Platform"
        value={values.platform}
        options={PLATFORM_OPTIONS}
        onChange={(v) => set("platform", v as "instagram" | "pinterest")}
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
