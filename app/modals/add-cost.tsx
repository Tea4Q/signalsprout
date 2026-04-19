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
import { useRouter } from "expo-router";
import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useWorkspace } from "@/context/workspace-context";
import { CostEntryForm, CostEntryFormValues } from "@/components/costs/CostEntryForm";
import { AppButton } from "@/components/ui/AppButton";
import { createCostEntry } from "@/services/finance/costService";
import { supabase } from "@/lib/supabase";
import type { SelectOption } from "@/components/ui/AppSelect";

function defaultFormValues(): CostEntryFormValues {
  return {
    costSourceId: null,
    amount: "",
    entryDate: new Date(),
    quantity: "",
    unit: "",
    notes: "",
    brandId: null,
  };
}

export default function AddCostModal() {
  const { colors } = useTheme();
  const router = useRouter();
  const { workspaceId } = useWorkspace();
  const s = styles(colors);

  const [values, setValues] = useState<CostEntryFormValues>(defaultFormValues());
  const [brandOptions, setBrandOptions] = useState<SelectOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<keyof CostEntryFormValues, string>>
  >({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    supabase
      .from("brands")
      .select("id, name")
      .eq("workspace_id", workspaceId)
      .order("name")
      .then(({ data }) => {
        setBrandOptions(
          (data ?? []).map((b) => ({ label: b.name, value: b.id })),
        );
      });
  }, [workspaceId]);

  function validate(): boolean {
    const errs: Partial<Record<keyof CostEntryFormValues, string>> = {};

    if (!values.costSourceId) {
      errs.costSourceId = "Please select a cost source.";
    }

    const amt = parseFloat(values.amount);
    if (!values.amount || isNaN(amt) || amt <= 0) {
      errs.amount = "Enter a valid amount greater than 0.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const handleSave = useCallback(async () => {
    if (!workspaceId) return;
    if (!validate()) return;

    setSaving(true);
    setSubmitError(null);
    try {
      await createCostEntry({
        workspace_id: workspaceId,
        cost_source_id: values.costSourceId,
        amount: parseFloat(values.amount),
        entry_date: values.entryDate.toISOString().slice(0, 10),
        quantity: values.quantity ? parseFloat(values.quantity) : null,
        unit: values.unit || null,
        notes: values.notes || null,
        brand_id: values.brandId,
        metadata: {},
      });
      router.back();
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : "Failed to save cost entry.",
      );
    } finally {
      setSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, values, router]);

  if (!workspaceId) {
    return (
      <SafeAreaView style={s.safeArea}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing["3xl"] }} />
      </SafeAreaView>
    );
  }

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
          Add Cost Entry
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <CostEntryForm
          workspaceId={workspaceId}
          values={values}
          onChange={setValues}
          brandOptions={brandOptions}
          errors={errors}
        />

        {submitError && (
          <Text style={{ ...typography.caption, color: colors.danger }}>
            {submitError}
          </Text>
        )}

        <AppButton
          label="Save Cost Entry"
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
