import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useWorkspace } from "@/context/workspace-context";
import { addCreditPurchase } from "@/services/finance/creditService";
import { AppButton } from "@/components/ui/AppButton";

// Common AI/tool vendors (user can also type their own)
const VENDOR_SUGGESTIONS = [
  "Runway",
  "OpenAI",
  "Anthropic",
  "Google AI",
  "Stability AI",
  "Midjourney",
  "AWS",
  "Other",
];

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AddCreditModal() {
  const { colors } = useTheme();
  const router = useRouter();
  const { workspaceId } = useWorkspace();
  const s = styles(colors);

  const [vendor, setVendor] = useState("");
  const [amountUSD, setAmountUSD] = useState("");
  const [credits, setCredits] = useState("");
  const [purchasedAt, setPurchasedAt] = useState<Date>(new Date());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!vendor.trim()) errs.vendor = "Vendor is required.";
    const amt = parseFloat(amountUSD);
    if (!amountUSD || isNaN(amt) || amt <= 0)
      errs.amountUSD = "Enter a valid USD amount greater than 0.";
    const cr = parseFloat(credits);
    if (!credits || isNaN(cr) || cr <= 0)
      errs.credits = "Enter the number of credits purchased (e.g. dollar value of credits).";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const handleSave = useCallback(async () => {
    if (!workspaceId) return;
    if (!validate()) return;

    setSaving(true);
    setSubmitError(null);
    try {
      await addCreditPurchase({
        workspace_id: workspaceId,
        vendor: vendor.trim(),
        amount_usd: parseFloat(amountUSD),
        credits: parseFloat(credits),
        purchased_at: toDateInputValue(purchasedAt),
        notes: notes.trim() || null,
      });
      router.back();
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : "Failed to save credit purchase.",
      );
    } finally {
      setSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, vendor, amountUSD, credits, purchasedAt, notes, router]);

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
        <Pressable onPress={() => router.back()} style={{ padding: spacing.sm }}>
          <Text style={{ ...typography.body, color: colors.primary }}>Cancel</Text>
        </Pressable>
        <Text style={{ ...typography.h3, color: colors.textPrimary }}>
          Add Credit Purchase
        </Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Vendor */}
        <View style={s.field}>
          <Text style={s.label}>Vendor / Provider</Text>
          <TextInput
            style={[s.input, errors.vendor ? s.inputError : null]}
            placeholder="e.g. Runway, OpenAI"
            placeholderTextColor={colors.textSecondary}
            value={vendor}
            onChangeText={setVendor}
          />
          {errors.vendor && <Text style={s.errorText}>{errors.vendor}</Text>}
          {/* Quick-select chips */}
          <View style={s.chips}>
            {VENDOR_SUGGESTIONS.map((v) => (
              <Pressable
                key={v}
                onPress={() => setVendor(v === "Other" ? "" : v)}
                style={({ pressed }) => [
                  s.chip,
                  vendor === v && s.chipActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text
                  style={[
                    s.chipText,
                    vendor === v && { color: colors.background },
                  ]}
                >
                  {v}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Amount paid (USD) */}
        <View style={s.field}>
          <Text style={s.label}>Amount Paid (USD)</Text>
          <TextInput
            style={[s.input, errors.amountUSD ? s.inputError : null]}
            placeholder="0.00"
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
            value={amountUSD}
            onChangeText={setAmountUSD}
          />
          {errors.amountUSD && <Text style={s.errorText}>{errors.amountUSD}</Text>}
        </View>

        {/* Credits (credit value or USD equivalent) */}
        <View style={s.field}>
          <Text style={s.label}>Credits Purchased</Text>
          <Text style={{ ...typography.micro, color: colors.textSecondary, marginBottom: spacing.xs }}>
            Enter the USD-equivalent value of the credits (e.g. $10 of Runway credits = 10).
          </Text>
          <TextInput
            style={[s.input, errors.credits ? s.inputError : null]}
            placeholder="e.g. 10"
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
            value={credits}
            onChangeText={setCredits}
          />
          {errors.credits && <Text style={s.errorText}>{errors.credits}</Text>}
        </View>

        {/* Purchase date */}
        <View style={s.field}>
          <Text style={s.label}>Purchase Date</Text>
          {Platform.OS === "web" ? (
            <input
              type="date"
              aria-label="Purchase date"
              value={toDateInputValue(purchasedAt)}
              onChange={(e) => {
                if (e.target.value) setPurchasedAt(new Date(e.target.value + "T12:00:00"));
              }}
              style={{
                backgroundColor: colors.surface,
                color: colors.textPrimary,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.md,
                padding: spacing.md,
                fontSize: 16,
                width: "100%",
              }}
            />
          ) : (
            <TextInput
              style={s.input}
              value={toDateInputValue(purchasedAt)}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSecondary}
              onChangeText={(v) => {
                if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
                  const d = new Date(v + "T12:00:00");
                  if (!isNaN(d.getTime())) setPurchasedAt(d);
                }
              }}
            />
          )}
        </View>

        {/* Notes */}
        <View style={s.field}>
          <Text style={s.label}>Notes (optional)</Text>
          <TextInput
            style={[s.input, { height: 80, textAlignVertical: "top" }]}
            placeholder="e.g. Monthly top-up, promo code used..."
            placeholderTextColor={colors.textSecondary}
            multiline
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        {submitError && (
          <Text style={{ ...typography.caption, color: colors.danger, textAlign: "center" }}>
            {submitError}
          </Text>
        )}

        <AppButton
          label={saving ? "Saving…" : "Save Credit Purchase"}
          onPress={handleSave}
          disabled={saving}
          style={{ marginTop: spacing.md }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function styles(colors: ReturnType<typeof import("@/hooks/use-theme").useTheme>["colors"]) {
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
    },
    scroll: { padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing["3xl"] * 2 },
    field: { gap: spacing.xs },
    label: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
    input: {
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: 16,
    },
    inputError: { borderColor: colors.danger },
    errorText: { ...typography.micro, color: colors.danger },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full ?? 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { ...typography.caption, color: colors.textSecondary },
  });
}
