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
        const hash = win?.location?.hash ?? "";
        const params = new URLSearchParams(search);
        // Facebook Business Login (config_id) can return either:
        //   • code in the query string  (code flow — preferred)
        //   • access_token in the hash  (implicit flow — Business Login default)
        // Check both locations for both values.
        const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
        const code = params.get("code") ?? hashParams.get("code");
        const accessToken = hashParams.get("access_token"); // implicit flow
        const state = params.get("state") ?? hashParams.get("state");
        const error = params.get("error") ?? hashParams.get("error");
        const errorDescription = params.get("error_description") ?? hashParams.get("error_description");

        console.log("[oauth/callback] search:", search, "hash:", hash, "code:", !!code, "accessToken:", !!accessToken, "state:", !!state, "error:", error);

        if (error) {
          throw new Error(errorDescription ?? error);
        }

        if (!code && !accessToken) {
          const debugInfo = `No code or token returned. search="${search}" hash="${hash}"`;
          console.error("[oauth/callback]", debugInfo);
          throw new Error("Facebook did not return an authorization code. Please try connecting again.");
        }

        const storedState = ss?.getItem("oauth_state");
        const platformId = ss?.getItem("oauth_platform");
        const workspaceId = ss?.getItem("oauth_workspace");

        // State is required for code flow. For implicit flow (access_token in hash),
        // Facebook doesn't always include state — skip the check only in that case.
        if (code && (!storedState || state !== storedState)) {
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

        // Build the exchange payload: code flow or implicit (access_token) flow.
        const exchangePayload = code
          ? { platform: platformId, code, workspaceId, redirectUri }
          : { platform: platformId, accessToken, workspaceId };

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
            body: JSON.stringify(exchangePayload),
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
