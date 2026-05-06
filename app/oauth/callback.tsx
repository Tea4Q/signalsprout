import { spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

export default function OAuthCallbackPage() {
  const router = useRouter();
  const { colors } = useTheme();
  const [statusMessage, setStatusMessage] = useState("Connecting your account…");
  const [isError, setIsError] = useState(false);
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    async function exchange() {
      const ss = (globalThis as any).sessionStorage as Storage | undefined;
      try {
        // Parse directly from window.location.search — more reliable than
        // useLocalSearchParams on web after a cross-origin redirect, because
        // Expo Router may not have finished hydrating search params yet.
        const win = (globalThis as any);
        const search = win?.location?.search ?? "";
        const params = new URLSearchParams(search);
        const code = params.get("code");
        const state = params.get("state");
        const error = params.get("error");
        const errorDescription = params.get("error_description");

        if (error) {
          throw new Error(errorDescription ?? error);
        }

        if (!code) {
          router.replace("/(tabs)/social-accounts");
          return;
        }

        const storedState = ss?.getItem("oauth_state");
        const platformId = ss?.getItem("oauth_platform");
        const workspaceId = ss?.getItem("oauth_workspace");

        if (!storedState || state !== storedState) {
          throw new Error("OAuth state mismatch — possible CSRF attack.");
        }
        if (!platformId || !workspaceId) {
          throw new Error("OAuth session data missing. Please try again.");
        }

        ss?.removeItem("oauth_state");
        ss?.removeItem("oauth_platform");
        ss?.removeItem("oauth_workspace");

        const redirectUri = Linking.createURL("oauth/callback");
        const { data: sessionData } = await supabase.auth.getSession();

        // Use raw fetch so we can read the actual error body when the function
        // returns a non-2xx — supabase.functions.invoke swallows the body.
        const fnRes = await fetch(
          `${env.supabaseUrl}/functions/v1/oauth-exchange`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${sessionData.session?.access_token}`,
              "apikey": env.supabaseAnonKey,
            },
            body: JSON.stringify({ platform: platformId, code, workspaceId, redirectUri }),
          },
        );
        const fnJson = await fnRes.json().catch(() => ({})) as Record<string, unknown>;
        if (!fnRes.ok || !fnJson?.["success"]) {
          throw new Error((fnJson?.["error"] as string | undefined) ?? `Exchange failed (HTTP ${fnRes.status})`);
        }

        // Signal success to the social-accounts page via sessionStorage
        ss?.setItem(
          "oauth_toast",
          JSON.stringify({ type: "success", platform: platformId }),
        );
        router.replace("/(tabs)/social-accounts");
      } catch (e) {
        const message = e instanceof Error ? e.message : "Connection failed";
        setStatusMessage(message);
        setIsError(true);
        ss?.setItem(
          "oauth_toast",
          JSON.stringify({ type: "error", message }),
        );
        setTimeout(() => {
          router.replace("/(tabs)/social-accounts");
        }, 3000);
      }
    }

    exchange();
  }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: "center",
        justifyContent: "center",
        padding: spacing["2xl"],
        gap: spacing.lg,
      }}
    >
      {!isError && <ActivityIndicator size="large" color={colors.primary} />}
      <Text
        style={{
          ...typography.body,
          color: isError ? colors.danger : colors.textSecondary,
          textAlign: "center",
        }}
      >
        {statusMessage}
      </Text>
      {isError && (
        <Text style={{ ...typography.caption, color: colors.textMuted, textAlign: "center" }}>
          Redirecting back…
        </Text>
      )}
    </View>
  );
}
