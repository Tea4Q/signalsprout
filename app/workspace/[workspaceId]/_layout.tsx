import { typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { Stack } from "expo-router";

export default function WorkspaceLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { ...typography.h3 },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="brands" options={{ title: "Brands" }} />
      <Stack.Screen name="campaigns" options={{ title: "Campaigns" }} />
      <Stack.Screen name="assets" options={{ headerShown: false }} />
      <Stack.Screen
        name="social-accounts"
        options={{ title: "Social Accounts" }}
      />
      <Stack.Screen name="brand/[brandId]" options={{ title: "Brand" }} />
    </Stack>
  );
}
