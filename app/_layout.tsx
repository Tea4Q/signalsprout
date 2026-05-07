import { AppToastContainer } from "@/components/ui/AppToast";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/lib/supabase";
import { ThemeProvider } from "@/context/theme-context";
import { ToastProvider } from "@/context/toast-context";
import { WorkspaceProvider, type WorkspaceRole } from "@/context/workspace-context";
import { isOnboardingComplete } from "@/app/onboarding";
import { getMyRole } from "@/services/workspace/memberService";
import { getMyWorkspaces } from "@/services/workspace/workspaceService";
import type { Database } from "@/types/database";
import type { Session } from "@supabase/supabase-js";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { Component, useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, View, Pressable } from "react-native";
import "react-native-reanimated";

type WorkspaceRow = Database["public"]["Tables"]["workspaces"]["Row"];

export const unstable_settings = {
  anchor: "(tabs)",
};

// ─── Global Error Boundary ────────────────────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
            gap: 16,
          }}
        >
          <Text
            style={{ fontSize: 18, fontWeight: "600", textAlign: "center" }}
          >
            Something went wrong
          </Text>
          <Text
            style={{ fontSize: 14, color: "#64748B", textAlign: "center" }}
          >
            {this.state.error?.message ?? "An unexpected error occurred."}
          </Text>
          <Pressable
            onPress={() => this.setState({ hasError: false, error: null })}
            style={{
              paddingHorizontal: 24,
              paddingVertical: 12,
              backgroundColor: "#5BCF8E",
              borderRadius: 10,
            }}
            accessibilityRole="button"
            accessibilityLabel="Retry"
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>Retry</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

function RootLayout() {
  const { colors } = useTheme();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  const [workspace, setWorkspaceState] = useState<WorkspaceRow | null>(null);
  const [allWorkspaces, setAllWorkspaces] = useState<WorkspaceRow[]>([]);
  const [role, setRole] = useState<WorkspaceRole | null>(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);

  const loadWorkspaces = useCallback(async () => {
    setLoadingWorkspace(true);
    try {
      const workspaces = await getMyWorkspaces();
      if (workspaces.length === 0) {
        router.replace("/workspace/create" as never);
        return;
      }
      const active = workspaces[0];
      setAllWorkspaces(workspaces);
      setWorkspaceState(active);
      const myRole = await getMyRole(active.id);
      setRole(myRole as WorkspaceRole | null);
    } catch (e) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[RootLayout] loadWorkspaces error:", e);
      }
    } finally {
      setLoadingWorkspace(false);
    }
  }, [router]);

  const handleSwitchWorkspace = useCallback(async (ws: WorkspaceRow) => {
    setWorkspaceState(ws);
    try {
      const myRole = await getMyRole(ws.id);
      setRole(myRole as WorkspaceRole | null);
    } catch {
      setRole(null);
    }
  }, []);

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION synchronously on setup,
    // so we use it as the single source of truth instead of getSession().
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        // Mark loading done once we have the initial session state
        if (event === "INITIAL_SESSION") {
          setLoading(false);
        }
        // Reload workspaces on sign-in and token refresh
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          loadWorkspaces();
        }
        // Clear workspace on sign-out
        if (event === "SIGNED_OUT") {
          setWorkspaceState(null);
          setAllWorkspaces([]);
          setRole(null);
        }
      },
    );

    return () => listener.subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (session) {
      loadWorkspaces();
    } else {
      setWorkspaceState(null);
      setAllWorkspaces([]);
      setRole(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboarding = (segments[0] as string) === "onboarding";
    const inOAuthCallback = segments[0] === "oauth";

    if (!session && !inAuthGroup && !inOAuthCallback) {
      router.replace("/(auth)/sign-in");
    } else if (session && inAuthGroup) {
      // Check if onboarding has been completed before going to dashboard
      isOnboardingComplete().then((done) => {
        if (done) {
          router.replace("/(tabs)/dashboard");
        } else {
          router.replace("/onboarding" as never);
        }
      });
    }
  }, [session, loading, segments]);

  // Let the oauth callback render immediately — it handles its own loading state
  // and must not be blocked by the auth spinner or redirected to sign-in.
  const isOAuthCallback =
    typeof window !== "undefined"
      ? (globalThis as any).location?.pathname?.startsWith("/oauth/")
      : false;

  if (loading && !isOAuthCallback) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <WorkspaceProvider
      workspace={workspace}
      allWorkspaces={allWorkspaces}
      role={role}
      loading={loadingWorkspace}
      onSwitch={handleSwitchWorkspace}
    >
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="workspace/[workspaceId]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="workspace/create"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
        <Stack.Screen
          name="modals/edit-post"
          options={{ presentation: "modal", headerShown: false }}
        />
        <Stack.Screen
          name="modals/create-post"
          options={{ presentation: "modal", headerShown: false }}
        />
        <Stack.Screen
          name="modals/generate-image"
          options={{ presentation: "modal", headerShown: false }}
        />
        <Stack.Screen
          name="modals/schedule-post"
          options={{ presentation: "modal", headerShown: false }}
        />
        <Stack.Screen
          name="modals/add-cost"
          options={{ presentation: "modal", headerShown: false }}
        />
        <Stack.Screen
          name="modals/add-credit"
          options={{ presentation: "modal", headerShown: false }}
        />
        <Stack.Screen
          name="modals/add-credential"
          options={{ presentation: "modal", headerShown: false }}
        />
        <Stack.Screen
          name="onboarding"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="oauth/callback"
          options={{ headerShown: false }}
        />
      </Stack>
      <AppToastContainer />
      <StatusBar style="auto" backgroundColor={colors.background} />
    </WorkspaceProvider>
  );
}

export default function RootLayoutWithProviders() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <RootLayout />
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
