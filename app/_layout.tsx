import { AppToastContainer } from "@/components/ui/AppToast";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/lib/supabase";
import { ThemeProvider } from "@/context/theme-context";
import { ToastProvider } from "@/context/toast-context";
import { isOnboardingComplete } from "@/app/onboarding";
import type { Session } from "@supabase/supabase-js";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { Component, useEffect, useState } from "react";
import { ActivityIndicator, Text, View, Pressable } from "react-native";
import "react-native-reanimated";

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      },
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboarding = (segments[0] as string) === "onboarding";

    if (!session && !inAuthGroup) {
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

  if (loading) {
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
    <>
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
    </>
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
