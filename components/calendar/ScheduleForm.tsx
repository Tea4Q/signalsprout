import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { radius, spacing, typography } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";
import { supabase } from "../../lib/supabase";
import { AppSelect, SelectOption } from "../ui/AppSelect";

import type { Database } from "../../types/database";

type PlatformType = Database["public"]["Enums"]["platform_type"];

interface ScheduleFormProps {
  workspaceId: string;
  platform: PlatformType;
  scheduledFor: Date;
  socialAccountId: string | null;
  onChangeDate: (date: Date) => void;
  onChangeSocialAccount: (id: string) => void;
}

// Formats a Date to "YYYY-MM-DD" for <input type="date">
function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Formats a Date to "HH:MM" for <input type="time">
function toTimeInputValue(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function ScheduleForm({
  workspaceId,
  platform,
  scheduledFor,
  socialAccountId,
  onChangeDate,
  onChangeSocialAccount,
}: ScheduleFormProps) {
  const { colors } = useTheme();
  const [accounts, setAccounts] = useState<SelectOption[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    supabase
      .from("social_accounts")
      .select("id, account_name, platform")
      .eq("workspace_id", workspaceId)
      .eq("platform", platform)
      .then(({ data }) => {
        setAccounts(
          (data ?? []).map((a) => ({ label: a.account_name, value: a.id })),
        );
      });
  }, [workspaceId, platform]);

  const formattedDate = scheduledFor.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const formattedTime = scheduledFor.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleDateChange = (_: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== "ios") setShowDatePicker(false);
    if (selected) {
      const newDate = new Date(selected);
      newDate.setHours(scheduledFor.getHours(), scheduledFor.getMinutes());
      onChangeDate(newDate);
    }
  };

  const handleTimeChange = (_: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== "ios") setShowTimePicker(false);
    if (selected) {
      const newDate = new Date(scheduledFor);
      newDate.setHours(selected.getHours(), selected.getMinutes());
      onChangeDate(newDate);
    }
  };

  const inputStyle = {
    height: 48,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: spacing.lg,
    paddingRight: spacing.lg,
    color: colors.textPrimary,
    fontSize: 15,
    fontFamily: "System",
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
  } as unknown as object;

  return (
    <View style={{ gap: spacing.lg }}>
      {/* Date */}
      <View style={{ gap: spacing.xs }}>
        <Text style={{ ...typography.caption, color: colors.textSecondary }}>
          Date
        </Text>

        {Platform.OS === "web" ? (
          // @ts-expect-error — web-only HTML input
          <input
            type="date"
            title="Select date"
            aria-label="Select date"
            value={toDateInputValue(scheduledFor)}
            min={toDateInputValue(new Date())}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              if (!e.target.value) return;
              const [y, m, d] = e.target.value.split("-").map(Number);
              const newDate = new Date(scheduledFor);
              newDate.setFullYear(y, m - 1, d);
              onChangeDate(newDate);
            }}
            style={inputStyle}
          />
        ) : (
          <>
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
                value={scheduledFor}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                minimumDate={new Date()}
                onChange={handleDateChange}
              />
            )}
          </>
        )}
      </View>

      {/* Time */}
      <View style={{ gap: spacing.xs }}>
        <Text style={{ ...typography.caption, color: colors.textSecondary }}>
          Time
        </Text>

        {Platform.OS === "web" ? (
          // @ts-expect-error — web-only HTML input
          <input
            type="time"
            title="Select time"
            aria-label="Select time"
            value={toTimeInputValue(scheduledFor)}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              if (!e.target.value) return;
              const [h, min] = e.target.value.split(":").map(Number);
              const newDate = new Date(scheduledFor);
              newDate.setHours(h, min);
              onChangeDate(newDate);
            }}
            style={inputStyle}
          />
        ) : (
          <>
            <Pressable
              onPress={() => setShowTimePicker(true)}
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
              accessibilityLabel="Select time"
            >
              <Text style={{ ...typography.body, color: colors.textPrimary }}>
                {formattedTime}
              </Text>
            </Pressable>
            {showTimePicker && (
              <DateTimePicker
                value={scheduledFor}
                mode="time"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={handleTimeChange}
              />
            )}
          </>
        )}
      </View>

      {/* Social account selector */}
      <AppSelect
        label={`${platform === "instagram" ? "Instagram" : "Pinterest"} Account`}
        value={socialAccountId}
        options={accounts}
        onChange={onChangeSocialAccount}
        placeholder="Select account"
      />
    </View>
  );
}
