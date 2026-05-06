import { spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import React from "react";
import { ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AssetsScreen() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>
          Assets coming soon.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
