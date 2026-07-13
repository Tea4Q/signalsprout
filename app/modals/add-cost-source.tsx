import React, { useCallback, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useWorkspace } from "@/context/workspace-context";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { AppSelect } from "@/components/ui/AppSelect";
import { createCostSource } from "@/services/finance/costService";
import type { Database } from "@/types/database";

type CostCycle = Database["public"]["Enums"]["cost_cycle"];

interface FormValues {
  name: string;
  vendor: string;
  category: string;
  billing_cycle: CostCycle | "";
  min_estimated_cost: string;
  max_estimated_cost: string;
  notes: string;
}

const CATEGORY_OPTIONS = [
  { label: "AI Text", value: "ai_text" },
  { label: "AI Images", value: "ai_images" },
  { label: "Infrastructure", value: "infra" },
  { label: "Other", value: "other" },
];

const BILLING_CYCLE_OPTIONS = [
  { label: "One-time", value: "one_time" },
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Yearly", value: "yearly" },
];

function defaultValues(): FormValues {
  return {
    name: "",
    vendor: "",
    category: "",
    billing_cycle: "",
    min_estimated_cost: "",
    max_estimated_cost: "",
    notes: "",
  };
}

export default function AddCostSourceModal() {
  const { colors } = useTheme();
  const router = useRouter();
  const { workspaceId } = useWorkspace();
  const s = styles(colors);

  const [values, setValues] = useState<FormValues>(defaultValues());
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update(partial: Partial<FormValues>) {
    setValues((prev) => ({ ...prev, ...partial }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormValues, string>> = {};
    if (!values.name.trim()) errs.name = "Name is required.";
    if (!values.vendor.trim()) errs.vendor = "Vendor is required.";
    if (!values.category) errs.category = "Please select a category.";
    if (!values.billing_cycle) errs.billing_cycle = "Please select a billing cycle.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const handleSave = useCallback(async () => {
    if (!workspaceId) return;
    if (!validate()) return;

    setSaving(true);
    setSubmitError(null);
    try {
      await createCostSource({
        workspace_id: workspaceId,
        name: values.name.trim(),
        vendor: values.vendor.trim(),
        category: values.category,
        billing_cycle: values.billing_cycle as CostCycle,
        min_estimated_cost: values.min_estimated_cost
          ? parseFloat(values.min_estimated_cost)
          : null,
        max_estimated_cost: values.max_estimated_cost
          ? parseFloat(values.max_estimated_cost)
          : null,
        notes: values.notes.trim() || null,
      });
      router.back();
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : "Failed to save cost source.",
      );
    } finally {
      setSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, values, router]);

  return (
    <SafeAreaView style={s.safeArea}>
      {/* Header */}
      <View style={s.header}>
        <Pressable
          onPress={() => router.back()}
          style={{ padding: spacing.sm }}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Text style={{ ...typography.body, color: colors.textSecondary }}>
            Cancel
          </Text>
        </Pressable>
        <Text style={{ ...typography.h3, color: colors.textPrimary }}>
          Add Cost Source
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <AppInput
          label="Name"
          value={values.name}
          onChangeText={(v) => update({ name: v })}
          placeholder="e.g. GPT-4o API"
          error={errors.name}
        />

        <AppInput
          label="Vendor"
          value={values.vendor}
          onChangeText={(v) => update({ vendor: v })}
          placeholder="e.g. OpenAI"
          error={errors.vendor}
        />

        <AppSelect
          label="Category"
          value={values.category || null}
          options={CATEGORY_OPTIONS}
          onChange={(v) => update({ category: v })}
          placeholder="Select category"
          error={errors.category}
        />

        <AppSelect
          label="Billing Cycle"
          value={values.billing_cycle || null}
          options={BILLING_CYCLE_OPTIONS}
          onChange={(v) => update({ billing_cycle: v as CostCycle })}
          placeholder="Select billing cycle"
          error={errors.billing_cycle}
        />

        <View style={{ flexDirection: "row", gap: spacing.lg }}>
          <View style={{ flex: 1 }}>
            <AppInput
              label="Min Est. Cost / month (optional)"
              value={values.min_estimated_cost}
              onChangeText={(v) => update({ min_estimated_cost: v })}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />
          </View>
          <View style={{ flex: 1 }}>
            <AppInput
              label="Max Est. Cost / month (optional)"
              value={values.max_estimated_cost}
              onChangeText={(v) => update({ max_estimated_cost: v })}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />
          </View>
        </View>

        <AppInput
          label="Notes (optional)"
          value={values.notes}
          onChangeText={(v) => update({ notes: v })}
          placeholder="e.g. Used for content generation"
        />

        {submitError && (
          <Text style={{ ...typography.caption, color: colors.danger }}>
            {submitError}
          </Text>
        )}

        <AppButton
          label="Save Cost Source"
          onPress={handleSave}
          loading={saving}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

type ThemeColors = ReturnType<typeof import("@/hooks/use-theme").useTheme>["colors"];

function styles(colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    scroll: {
      padding: spacing.xl,
      gap: spacing.xl,
      paddingBottom: spacing["3xl"] * 2,
    },
  });
}
