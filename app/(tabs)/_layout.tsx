import { Tabs } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { AppModal } from "@/components/ui/AppModal";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { spacing, typography } from "@/constants/theme";
import {
  useWorkspace,
} from "@/context/workspace-context";
import { useTheme } from "@/hooks/use-theme";

// ─── Workspace switcher button shown in header ──────────────────────────────

function WorkspaceSwitcher() {
  const { workspace, allWorkspaces, loading, setWorkspace } = useWorkspace();
  const { colors } = useTheme();
  const [modalOpen, setModalOpen] = useState(false);

  if (loading || !workspace) return null;

  // Only show the dropdown affordance when the user belongs to multiple workspaces
  const hasMultiple = allWorkspaces.length > 1;

  return (
    <>
      <Pressable
        onPress={() => hasMultiple && setModalOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Switch workspace"
        style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
      >
        <Text
          numberOfLines={1}
          style={{
            ...typography.h3,
            color: colors.textPrimary,
            maxWidth: 180,
          }}
        >
          {workspace.name}
        </Text>
        {hasMultiple && (
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>▾</Text>
        )}
      </Pressable>

      <AppModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Switch workspace"
      >
        <View style={{ gap: spacing.sm }}>
          {allWorkspaces.map((ws) => (
            <Pressable
              key={ws.id}
              onPress={() => {
                setWorkspace(ws);
                setModalOpen(false);
              }}
              style={({ pressed }) => ({
                padding: spacing.lg,
                borderRadius: 12,
                backgroundColor:
                  ws.id === workspace.id
                    ? colors.primarySoft
                    : pressed
                      ? colors.surfaceAlt
                      : colors.surface,
              })}
              accessibilityRole="button"
              accessibilityLabel={`Switch to ${ws.name}`}
            >
              <Text
                style={{
                  ...typography.body,
                  color:
                    ws.id === workspace.id
                      ? colors.primary
                      : colors.textPrimary,
                  fontWeight: ws.id === workspace.id ? "600" : "400",
                }}
              >
                {ws.name}
              </Text>
              <Text
                style={{ ...typography.micro, color: colors.textMuted }}
              >
                {ws.slug}
              </Text>
            </Pressable>
          ))}
        </View>
      </AppModal>
    </>
  );
}

// ─── Layout ──────────────────────────────────────────────────────────────────

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
          },
          tabBarLabelStyle: {
            ...typography.micro,
          },
          headerShown: true,
          headerTitle: () => <WorkspaceSwitcher />,
          headerStyle: { backgroundColor: colors.surface },
          headerShadowVisible: false,
          tabBarButton: HapticTab,
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: "Dashboard",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={24} name="house.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: "Calendar",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={24} name="calendar" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="content"
          options={{
            title: "Content",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={24} name="sparkles" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            title: "Analytics",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={24} name="chart.bar.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="costs"
          options={{
            title: "Costs",
            tabBarIcon: ({ color }) => (
              <IconSymbol
                size={24}
                name="dollarsign.circle.fill"
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="social-accounts"
          options={{
            title: "Accounts",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={24} name="person.2.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={24} name="gear" color={color} />
            ),
          }}
        />
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="explore" options={{ href: null }} />
      </Tabs>
  );
}
