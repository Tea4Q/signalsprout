import React, { useState } from "react";
import {
    FlatList,
    Modal,
    Pressable,
    Text,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, spacing, typography } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";

export interface SelectOption {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

interface AppSelectProps {
  label: string;
  value: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}

export function AppSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Select an option",
  error,
  disabled = false,
}: AppSelectProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value);

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ ...typography.caption, color: colors.textSecondary }}>
        {label}
      </Text>

      <Pressable
        onPress={() => { if (!disabled) setOpen(true); }}
        style={[
          {
            height: 48,
            backgroundColor: colors.surfaceAlt,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.lg,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            opacity: disabled ? 0.5 : 1,
          },
          !!error && { borderColor: colors.danger },
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 }}>
          {selected?.icon}
          <Text
            style={{
              ...typography.body,
              color: selected ? colors.textPrimary : colors.textMuted,
              flex: 1,
            }}
            numberOfLines={1}
          >
            {selected ? selected.label : placeholder}
          </Text>
        </View>
        <Text
          style={{
            color: colors.textMuted,
            fontSize: 12,
            marginLeft: spacing.sm,
          }}
        >
          ▼
        </Text>
      </Pressable>

      {!!error && (
        <Text style={{ ...typography.caption, color: colors.danger }}>
          {error}
        </Text>
      )}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.5)",
              justifyContent: "flex-end",
            }}
          >
            <TouchableWithoutFeedback>
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderTopLeftRadius: radius.xl,
                  borderTopRightRadius: radius.xl,
                  paddingTop: spacing.lg,
                  paddingBottom: insets.bottom + spacing.lg,
                  maxHeight: "60%",
                }}
              >
                <View
                  style={{
                    paddingHorizontal: spacing.xl,
                    paddingBottom: spacing.lg,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.borderSoft,
                  }}
                >
                  <Text style={{ ...typography.h3, color: colors.textPrimary }}>
                    {label}
                  </Text>
                </View>

                <FlatList
                  data={options}
                  keyExtractor={(item) => item.value}
                  style={{ flexShrink: 1 }}
                  renderItem={({ item }) => {
                    const isSelected = item.value === value;
                    return (
                      <Pressable
                        onPress={() => {
                          onChange(item.value);
                          setOpen(false);
                        }}
                        style={({ pressed }) => ({
                          paddingHorizontal: spacing.xl,
                          paddingVertical: spacing.lg,
                          backgroundColor: isSelected
                            ? colors.primarySoft
                            : pressed
                              ? colors.surfaceAlt
                              : "transparent",
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        })}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 }}>
                          {item.icon}
                          <Text
                            style={{
                              ...typography.body,
                              color: isSelected
                                ? colors.primary
                                : colors.textPrimary,
                              fontWeight: isSelected ? "600" : "400",
                            }}
                          >
                            {item.label}
                          </Text>
                        </View>
                        {isSelected && (
                          <Text style={{ color: colors.primary, fontSize: 16 }}>
                            ✓
                          </Text>
                        )}
                      </Pressable>
                    );
                  }}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}
