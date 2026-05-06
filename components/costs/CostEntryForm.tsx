import { AppInput } from "@/components/ui/AppInput";
import { AppSelect, SelectOption } from "@/components/ui/AppSelect";
import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { getCostSources } from "@/services/finance/costService";
import DateTimePicker, {
    DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";

export interface CostEntryFormValues {
  costSourceId: string | null;
  amount: string;
  entryDate: Date;
  quantity: string;
  unit: string;
  notes: string;
  brandId: string | null;
}

interface CostEntryFormProps {
  workspaceId: string;
  values: CostEntryFormValues;
  onChange: (values: CostEntryFormValues) => void;
  brandOptions: SelectOption[];
  errors?: Partial<Record<keyof CostEntryFormValues, string>>;
}

export function CostEntryForm({
  workspaceId,
  values,
  onChange,
  brandOptions,
  errors,
}: CostEntryFormProps) {
  const { colors } = useTheme();
  const [sourceOptions, setSourceOptions] = useState<SelectOption[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    getCostSources(workspaceId)
      .then((sources) =>
        setSourceOptions(
          sources.map((s) => ({
            label: `${s.name} (${s.vendor})`,
            value: s.id,
          })),
        ),
      )
      .catch(() => {});
  }, [workspaceId]);

  function update(partial: Partial<CostEntryFormValues>) {
    onChange({ ...values, ...partial });
  }

  function handleDateChange(_e: DateTimePickerEvent, date?: Date) {
    if (Platform.OS !== "ios") setShowDatePicker(false);
    if (date) update({ entryDate: date });
  }

  const formattedDate = values.entryDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <View style={{ gap: spacing.xl }}>
      <AppSelect
        label="Cost Source"
        value={values.costSourceId}
        options={sourceOptions}
        onChange={(v) => update({ costSourceId: v })}
        placeholder="Select tool / vendor"
        error={errors?.costSourceId}
      />

      <AppInput
        label="Amount (USD)"
        value={values.amount}
        onChangeText={(v) => update({ amount: v })}
        keyboardType="decimal-pad"
        placeholder="0.00"
        error={errors?.amount}
      />

      {/* Date picker trigger */}
      <View style={{ gap: spacing.xs }}>
        <Text style={{ ...typography.caption, color: colors.textSecondary }}>
          Date
        </Text>
        <Pressable
          onPress={() => setShowDatePicker(true)}
          style={{
            height: 48,
            backgroundColor: colors.surfaceAlt,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.lg,
            justifyContent: "center",
          }}
          accessibilityRole="button"
          accessibilityLabel="Select date"
        >
          <Text style={{ ...typography.body, color: colors.textPrimary }}>
            {formattedDate}
          </Text>
        </Pressable>
        {showDatePicker && (
          <DateTimePicker
            value={values.entryDate}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            onChange={handleDateChange}
            maximumDate={new Date()}
          />
        )}
      </View>

      <View style={{ flexDirection: "row", gap: spacing.lg }}>
        <View style={{ flex: 1 }}>
          <AppInput
            label="Quantity"
            value={values.quantity}
            onChangeText={(v) => update({ quantity: v })}
            keyboardType="decimal-pad"
            placeholder="1"
          />
        </View>
        <View style={{ flex: 1 }}>
          <AppInput
            label="Unit"
            value={values.unit}
            onChangeText={(v) => update({ unit: v })}
            placeholder="tokens, calls, GB…"
          />
        </View>
      </View>

      {brandOptions.length > 0 && (
        <AppSelect
          label="Brand (optional)"
          value={values.brandId}
          options={brandOptions}
          onChange={(v) => update({ brandId: v })}
          placeholder="No brand"
        />
      )}

      <AppInput
        label="Notes (optional)"
        value={values.notes}
        onChangeText={(v) => update({ notes: v })}
        placeholder="e.g. GPT-4o content generation run"
      />
    </View>
  );
}
