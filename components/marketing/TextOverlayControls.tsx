import React from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type TextAlignment = "left" | "center" | "right";

export interface TextOverlayValues {
  headline: string;
  subheadline: string;
  cta: string;
  badge: string;
  fontSize: number;
  textColor: string;
  alignment: TextAlignment;
}

interface TextOverlayControlsProps {
  value: TextOverlayValues;
  onChange: (value: TextOverlayValues) => void;
  disabled?: boolean;
}

const ALIGNMENTS: TextAlignment[] = ["left", "center", "right"];

export function TextOverlayControls({ value, onChange, disabled = false }: TextOverlayControlsProps) {
  const { colors } = useTheme();

  const set = <K extends keyof TextOverlayValues>(key: K, next: TextOverlayValues[K]) => {
    onChange({ ...value, [key]: next });
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Text style={{ ...typography.caption, color: colors.textSecondary }}>Text Overlays</Text>

      <View style={{ gap: spacing.sm }}>
        <TextInput
          editable={!disabled}
          value={value.headline}
          onChangeText={(text) => set("headline", text)}
          placeholder="Headline"
          placeholderTextColor={colors.textMuted}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            color: colors.textPrimary,
            fontSize: 16,
            fontWeight: "700",
            backgroundColor: colors.surface,
          }}
        />

        <TextInput
          editable={!disabled}
          value={value.subheadline}
          onChangeText={(text) => set("subheadline", text)}
          placeholder="Subheadline"
          placeholderTextColor={colors.textMuted}
          multiline
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            color: colors.textPrimary,
            fontSize: 14,
            minHeight: 72,
            backgroundColor: colors.surface,
            textAlignVertical: "top",
          }}
        />

        <TextInput
          editable={!disabled}
          value={value.cta}
          onChangeText={(text) => set("cta", text)}
          placeholder="CTA"
          placeholderTextColor={colors.textMuted}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            color: colors.textPrimary,
            fontSize: 14,
            fontWeight: "700",
            backgroundColor: colors.surface,
          }}
        />

        <TextInput
          editable={!disabled}
          value={value.badge}
          onChangeText={(text) => set("badge", text)}
          placeholder="Optional badge"
          placeholderTextColor={colors.textMuted}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            color: colors.textPrimary,
            fontSize: 14,
            backgroundColor: colors.surface,
          }}
        />
      </View>

      <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs }}>
            Size
          </Text>
          <TextInput
            editable={!disabled}
            value={String(value.fontSize)}
            onChangeText={(text) => {
              const parsed = Number(text);
              if (!Number.isNaN(parsed)) set("fontSize", parsed);
            }}
            keyboardType="number-pad"
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              color: colors.textPrimary,
              backgroundColor: colors.surface,
            }}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs }}>
            Color
          </Text>
          <TextInput
            editable={!disabled}
            value={value.textColor}
            onChangeText={(text) => set("textColor", text)}
            placeholder="#12385C"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              color: colors.textPrimary,
              backgroundColor: colors.surface,
            }}
          />
        </View>
      </View>

      <View style={{ gap: spacing.xs }}>
        <Text style={{ ...typography.caption, color: colors.textSecondary }}>Alignment</Text>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {ALIGNMENTS.map((alignment) => {
            const active = value.alignment === alignment;
            return (
              <Pressable
                key={alignment}
                disabled={disabled}
                onPress={() => set("alignment", alignment)}
                style={{
                  flex: 1,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.primarySoft : colors.surface,
                  paddingVertical: spacing.sm,
                  alignItems: "center",
                }}
              >
                <Text style={{ ...typography.caption, color: colors.textPrimary, fontWeight: "600" }}>
                  {alignment}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}