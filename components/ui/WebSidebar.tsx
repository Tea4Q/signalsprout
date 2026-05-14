import { usePathname, useRouter } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { spacing, typography, radius } from "@/constants/theme";
import { useWorkspace } from "@/context/workspace-context";
import { useTheme } from "@/hooks/use-theme";

type IconName =
  | "house.fill"
  | "calendar"
  | "sparkles"
  | "chart.bar.fill"
  | "dollarsign.circle.fill"
  | "person.2.fill"
  | "gear";

const NAV_ITEMS: { name: string; label: string; icon: IconName; href: string }[] = [
  { name: "dashboard", label: "Dashboard", icon: "house.fill", href: "/(tabs)/dashboard" },
  { name: "calendar", label: "Calendar", icon: "calendar", href: "/(tabs)/calendar" },
  { name: "content", label: "Content", icon: "sparkles", href: "/(tabs)/content" },
  { name: "analytics", label: "Analytics", icon: "chart.bar.fill", href: "/(tabs)/analytics" },
  { name: "costs", label: "Costs", icon: "dollarsign.circle.fill", href: "/(tabs)/costs" },
  { name: "social-accounts", label: "Accounts", icon: "person.2.fill", href: "/(tabs)/social-accounts" },
  { name: "settings", label: "Settings", icon: "gear", href: "/(tabs)/settings" },
];

export function WebSidebar() {
  const { colors } = useTheme();
  const { workspace } = useWorkspace();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View
      style={{
        width: 220,
        backgroundColor: colors.surface,
        borderRightWidth: 1,
        borderRightColor: colors.border,
        paddingTop: spacing["3xl"],
        paddingBottom: spacing["3xl"],
        paddingHorizontal: spacing.lg,
        gap: spacing.xs,
      }}
    >
      {/* Brand header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          marginBottom: spacing["2xl"],
          paddingHorizontal: spacing.xs,
        }}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: radius.md,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ ...typography.h3, color: "#fff", fontWeight: "700" }}>S</Text>
        </View>
        <View style={{ flex: 1, overflow: "hidden" }}>
          <Text
            numberOfLines={1}
            style={{ ...typography.body, color: colors.textPrimary, fontWeight: "600" }}
          >
            {workspace?.name ?? "SignalSprout"}
          </Text>
          <Text style={{ ...typography.micro, color: colors.textMuted }}>Workspace</Text>
        </View>
      </View>

      {/* Nav items */}
      {NAV_ITEMS.map((item) => {
        const isFocused = pathname === item.href || pathname.startsWith(item.href + "/") ||
          pathname === `/${item.name}` || pathname.endsWith(`/${item.name}`);

        return (
          <Pressable
            key={item.name}
            onPress={() => router.push(item.href as never)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={item.label}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              paddingVertical: spacing.sm + 2,
              paddingHorizontal: spacing.md,
              borderRadius: radius.md,
              backgroundColor: isFocused
                ? colors.primarySoft
                : pressed
                ? colors.surfaceAlt
                : "transparent",
            })}
          >
            <IconSymbol
              size={20}
              name={item.icon}
              color={isFocused ? colors.primary : colors.textSecondary}
            />
            <Text
              style={{
                ...typography.body,
                color: isFocused ? colors.primary : colors.textSecondary,
                fontWeight: isFocused ? "600" : "400",
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
