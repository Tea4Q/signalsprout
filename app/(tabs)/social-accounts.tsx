import { SocialAccountCard } from "@/components/social/SocialAccountCard";
import { spacing, typography } from "@/constants/theme";
import { useToast } from "@/context/toast-context";
import { useWorkspace } from "@/context/workspace-context";
import { useTheme } from "@/hooks/use-theme";
import { PLATFORM_LIST, type PlatformId } from "@/lib/platforms/config";
import { supabase } from "@/lib/supabase";
import { FacebookSetupModal } from "@/components/social/FacebookSetupModal";
import { InstagramSetupModal } from "@/components/social/InstagramSetupModal";
import {
  disconnectSocialAccount,
  listSocialAccounts,
  type SocialAccount,
} from "@/services/social/socialAccountService";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Ensure browser session is completed on return (iOS)
WebBrowser.maybeCompleteAuthSession();

// ─── PKCE utilities ──────────────────────────────────────────────────────────

function generateCodeVerifier(): string {
  const bytes = Crypto.getRandomBytes(32);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );
  return digest.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function generateState(): string {
  const bytes = Crypto.getRandomBytes(16);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function SocialAccountsScreen() {
  const { colors } = useTheme();
  const { workspaceId } = useWorkspace();
  const { showToast } = useToast();

  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Track which platform is mid-connect and which is mid-disconnect
  const [connecting, setConnecting] = useState<PlatformId | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null); // accountId
  const [instagramSetupVisible, setInstagramSetupVisible] = useState(false);
  const [facebookSetupVisible, setFacebookSetupVisible] = useState(false);
  const connectingRef = useRef(false);
  // Cached oauth result read from sessionStorage on mount (before workspaceId is ready)
  const pendingOauthToast = useRef<{ type: string; platform?: string; message?: string } | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!workspaceId) return;
      if (!silent) setLoading(true);
      try {
        const data = await listSocialAccounts(workspaceId);
        setAccounts(data);
      } catch (e) {
        if (!silent) {
          showToast(
            e instanceof Error ? e.message : "Failed to load accounts",
            "error",
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [workspaceId, showToast],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Step 1: Read oauth_toast immediately on mount (before workspaceId may be ready)
  // and cache it in a ref. Remove from sessionStorage so it's only consumed once.
  useEffect(() => {
    const ss = (globalThis as any).sessionStorage as Storage | undefined;
    if (!ss) return;
    const raw = ss.getItem("oauth_toast");
    if (!raw) return;
    ss.removeItem("oauth_toast");
    try { pendingOauthToast.current = JSON.parse(raw); } catch {}
  }, []);

  // Step 2: Act on the cached result once workspaceId (and therefore load) is available.
  useEffect(() => {
    const pending = pendingOauthToast.current;
    if (!pending || !workspaceId) return;
    pendingOauthToast.current = null;
    if (pending.type === "success" && pending.platform) {
      showToast(`${pending.platform} connected`, "success");
      load(true);
    } else if (pending.type === "error") {
      showToast(pending.message ?? "Connection failed", "error");
    }
  }, [workspaceId, showToast, load]);

  // ── Connect ───────────────────────────────────────────────────────────────

  const doOAuthConnect = useCallback(
    async (platformId: PlatformId) => {
      if (!workspaceId) {
        showToast("Select a workspace before connecting accounts.", "error");
        return;
      }
      // Prevent double-invocation (would open multiple browser popups on web)
      if (connectingRef.current) return;
      connectingRef.current = true;

      const platform = PLATFORM_LIST.find((p) => p.id === platformId);
      if (!platform) return;

      // Retrieve the public client ID from env
      const CLIENT_IDS: Record<string, string | undefined> = {
        instagram: process.env.EXPO_PUBLIC_INSTAGRAM_CLIENT_ID,
        pinterest: process.env.EXPO_PUBLIC_PINTEREST_CLIENT_ID,
        // Facebook and Instagram share the same Meta app — fall back to Instagram client ID
        facebook: process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_ID ?? process.env.EXPO_PUBLIC_INSTAGRAM_CLIENT_ID,
        tiktok: process.env.EXPO_PUBLIC_TIKTOK_CLIENT_ID,
        x: process.env.EXPO_PUBLIC_X_CLIENT_ID,
        linkedin: process.env.EXPO_PUBLIC_LINKEDIN_CLIENT_ID,
        youtube: process.env.EXPO_PUBLIC_YOUTUBE_CLIENT_ID,
        threads: process.env.EXPO_PUBLIC_THREADS_CLIENT_ID,
        snapchat: process.env.EXPO_PUBLIC_SNAPCHAT_CLIENT_ID,
      };
      const clientId = CLIENT_IDS[platformId];
      if (!clientId) {
        showToast(
          `${platform.label} is not configured yet. Add EXPO_PUBLIC_${platformId.toUpperCase()}_CLIENT_ID to .env.local.`,
          "error",
        );
        return;
      }

      setConnecting(platformId);
      try {
        const redirectUri = Linking.createURL("oauth/callback");
        const state = generateState();

        let codeVerifier: string | undefined;
        let codeChallenge: string | undefined;
        if (platform.usesPkce) {
          codeVerifier = generateCodeVerifier();
          codeChallenge = await generateCodeChallenge(codeVerifier);
        }

        const authUrl = platform.buildAuthUrl({
          clientId,
          redirectUri,
          state,
          codeChallenge,
        });

        // ── Web: full-page redirect (avoids popup-blocker / user-activation issues) ──
        if (Platform.OS === "web") {
          sessionStorage.setItem("oauth_state", state);
          sessionStorage.setItem("oauth_platform", platformId);
          sessionStorage.setItem("oauth_workspace", workspaceId);
          (globalThis as any).window.location.href = authUrl;
          // Don't call setConnecting(null) here — the page will navigate away.
          return;
        }

        // ── Native: in-app browser popup ─────────────────────────────────────────
        const result = await WebBrowser.openAuthSessionAsync(
          authUrl,
          redirectUri,
        );

        if (result.type !== "success") {
          // User cancelled or browser dismissed
          return;
        }

        // Parse code + state out of the redirect URL
        const url = new URL(result.url);
        const returnedState = url.searchParams.get("state");
        const code = url.searchParams.get("code");
        const errorParam = url.searchParams.get("error");

        if (errorParam) {
          throw new Error(
            url.searchParams.get("error_description") ?? errorParam,
          );
        }
        if (returnedState !== state) {
          throw new Error("OAuth state mismatch — possible CSRF attack.");
        }
        if (!code) {
          throw new Error("No authorization code returned.");
        }

        // Exchange code for tokens via Edge Function
        const { data: session } = await supabase.auth.getSession();
        const { data, error } = await supabase.functions.invoke(
          "oauth-exchange",
          {
            body: {
              platform: platformId,
              code,
              workspaceId,
              redirectUri,
              codeVerifier,
            },
            headers: {
              Authorization: `Bearer ${session.session?.access_token}`,
            },
          },
        );

        if (error || !data?.success) {
          throw new Error(
            data?.error ?? error?.message ?? "Token exchange failed",
          );
        }

        showToast(`${platform.label} connected`, "success");
        load(true);
      } catch (e) {
        showToast(
          e instanceof Error ? e.message : `Failed to connect ${platform.label}`,
          "error",
        );
      } finally {
        setConnecting(null);
        connectingRef.current = false;
      }
    },
    [workspaceId, showToast, load],
  );

  const handleConnect = useCallback(
    async (platformId: PlatformId) => {
      if (!workspaceId) {
        showToast("Select a workspace before connecting accounts.", "error");
        return;
      }
      // Show setup guide for Instagram and Facebook before OAuth
      if (platformId === "instagram") {
        setInstagramSetupVisible(true);
        return;
      }
      if (platformId === "facebook") {
        setFacebookSetupVisible(true);
        return;
      }
      await doOAuthConnect(platformId);
    },
    [workspaceId, showToast, doOAuthConnect],
  );

  // ── Disconnect ────────────────────────────────────────────────────────────

  const handleDisconnect = useCallback(
    (account: SocialAccount) => {
      const doDisconnect = async () => {
        setDisconnecting(account.id);
        try {
          await disconnectSocialAccount(account.id);
          showToast(`${account.account_name} disconnected`, "info");
          load(true);
        } catch (e) {
          showToast(
            e instanceof Error ? e.message : "Failed to disconnect",
            "error",
          );
        } finally {
          setDisconnecting(null);
        }
      };

      Alert.alert(
        "Disconnect account",
        `Remove the ${account.account_name} connection? Posts already scheduled will not be affected.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Disconnect", style: "destructive", onPress: doDisconnect },
        ],
      );
    },
    [showToast, load],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  const connectedCount = accounts.length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing["2xl"] }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={{ gap: 4 }}>
          <Text style={{ ...typography.h2, color: colors.textPrimary }}>
            Social Accounts
          </Text>
          {!loading && (
            <Text style={{ ...typography.caption, color: colors.textMuted }}>
              {connectedCount === 0
                ? "No platforms connected yet"
                : `${connectedCount} platform${connectedCount !== 1 ? "s" : ""} connected`}
            </Text>
          )}
        </View>

        {loading ? (
          <View
            style={{ alignItems: "center", paddingVertical: spacing["3xl"] }}
          >
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          /* 2-column grid */
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing.md,
            }}
          >
            {PLATFORM_LIST.map((platform) => {
              const account =
                accounts.find((a) => a.platform === platform.id) ?? null;
              return (
                <View
                  key={platform.id}
                  style={{
                    width: "48%",
                    minWidth: 148,
                  }}
                >
                  <SocialAccountCard
                    platform={platform}
                    account={account}
                    connecting={connecting === platform.id}
                    disconnecting={
                      !!account && disconnecting === account.id
                    }
                    onConnect={() => handleConnect(platform.id)}
                    onDisconnect={() => account && handleDisconnect(account)}
                  />
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
      <InstagramSetupModal
        visible={instagramSetupVisible}
        onClose={() => setInstagramSetupVisible(false)}
        onContinue={() => {
          setInstagramSetupVisible(false);
          setTimeout(() => doOAuthConnect("instagram"), 0);
        }}
      />
      <FacebookSetupModal
        visible={facebookSetupVisible}
        onClose={() => setFacebookSetupVisible(false)}
        onContinue={() => {
          setFacebookSetupVisible(false);
          setTimeout(() => doOAuthConnect("facebook"), 0);
        }}
      />
    </SafeAreaView>
  );
}
