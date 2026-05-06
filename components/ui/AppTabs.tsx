import React from "react";
import { Pressable, ScrollView, Text, View, ViewStyle } from "react-native";
import { spacing, typography } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";

export interface TabItem {
  key: string;
  label: string;
}

interface AppTabsProps {
  tabs: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  style?: ViewStyle;
}

export function AppTabs({ tabs, activeKey, onChange, style }: AppTabsProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        {
          borderBottomWidth: 1,
          borderBottomColor: colors.borderSoft,
          backgroundColor: colors.surface,
        },
        style,
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.xl }}
      >
        {tabs.map((tab) => {
          const isActive = tab.key === activeKey;
          return (
            <Pressable
              key={tab.key}
              onPress={() => onChange(tab.key)}
              style={{
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.sm,
                marginRight: spacing.lg,
                borderBottomWidth: 2,
                borderBottomColor: isActive ? colors.primary : "transparent",
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Text
                style={{
                  ...typography.body,
                  fontWeight: isActive ? "600" : "400",
                  color: isActive ? colors.primary : colors.textSecondary,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
