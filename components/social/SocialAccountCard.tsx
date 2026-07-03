import { AppBadge } from "@/components/ui/AppBadge";
import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { PlatformConfig } from "@/lib/platforms/config";
import type { SocialAccount } from "@/services/social/socialAccountService";
import { isTokenExpired, isTokenExpiringSoon } from "@/services/social/socialAccountService";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import { useState } from "react";

interface SocialAccountCardProps {
  platform: PlatformConfig;
  account: SocialAccount | null;
  connectedCount?: number;
  connecting: boolean;
  disconnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onManage?: () => void;
}

function formatAccountIdentifier(account: SocialAccount): string | null {
  if (!account.account_identifier) return null;
  if (account.platform === "instagram") {
    return account.account_identifier.startsWith("@")
      ? account.account_identifier
      : `@${account.account_identifier}`;
  }
  if (account.platform === "facebook") {
    return `Page ID ${account.account_identifier}`;
  }
  return account.account_identifier;
}

export function SocialAccountCard({
  platform,
  account,
  connectedCount = account ? 1 : 0,
  connecting,
  disconnecting,
  onConnect,
  onDisconnect,
  onManage,
}: SocialAccountCardProps) {
  const { colors } = useTheme();
  const [avatarError, setAvatarError] = useState(false);

  const isConnected = !!account;
  const expired = account ? isTokenExpired(account) : false;
  const expiringSoon = account ? isTokenExpiringSoon(account) : false;
  const additionalCount = Math.max(connectedCount - 1, 0);
  const formattedIdentifier = account ? formatAccountIdentifier(account) : null;

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: isConnected ? platform.color + "44" : colors.border,
        padding: spacing.lg,
        gap: spacing.md,
        flex: 1,
      }}
    >
      {/* Platform header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: platform.color + "1A",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <FontAwesomeIcon icon={platform.icon} size={18} color={platform.color} />
        </View>
        <Text
          style={{ ...typography.caption, color: colors.textPrimary, fontWeight: "600", flex: 1 }}
          numberOfLines={1}
        >
          {platform.label}
        </Text>
      </View>

      {/* Account info or empty state */}
      {isConnected && account ? (
        <View style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            {account.avatar_url && !avatarError ? (
              <Image
                source={{ uri: account.avatar_url }}
                style={{ width: 28, height: 28, borderRadius: 14 }}
                accessibilityLabel={`${account.account_name} avatar`}
                onError={() => setAvatarError(true)}
              />
            ) : (
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: platform.color + "33",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ ...typography.micro, color: platform.color, fontWeight: "700" }}>
                  {(account.account_identifier ?? account.account_name)
                    .replace(/^@/, "")
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>
            )}
            <Text
              style={{ ...typography.micro, color: colors.textPrimary, flex: 1 }}
              numberOfLines={1}
            >
              {account.account_name}
            </Text>
          </View>

          {!!formattedIdentifier && (
            <Text style={{ ...typography.micro, color: colors.textMuted }} numberOfLines={1}>
              {formattedIdentifier}
            </Text>
          )}

          {additionalCount > 0 && (
            <Text style={{ ...typography.micro, color: colors.textMuted }}>
              {`+${additionalCount} more connected`}
            </Text>
          )}

          {/* Token status */}
          {expired ? (
            <AppBadge label="Token expired" variant="danger" />
          ) : expiringSoon ? (
            <AppBadge label="Expiring soon" variant="warning" />
          ) : (
            <AppBadge label="Connected" variant="success" />
          )}

          {connectedCount > 1 && <AppBadge label={`${connectedCount} accounts`} variant="info" />}
        </View>
      ) : (
        <Text style={{ ...typography.micro, color: colors.textMuted }}>
          Not connected
        </Text>
      )}

      {/* Action button */}
      {isConnected ? (
        <View style={{ gap: spacing.xs }}>
          <Pressable
            onPress={onConnect}
            disabled={connecting || disconnecting}
            accessibilityRole="button"
            accessibilityLabel={`${expired ? "Reconnect" : "Sync"} ${platform.label}`}
            style={({ pressed }) => ({
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: radius.sm,
              backgroundColor: platform.color,
              alignItems: "center",
              opacity: pressed || connecting ? 0.7 : 1,
            })}
          >
            {connecting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ ...typography.micro, color: "#fff", fontWeight: "600" }}>
                {expired ? "Reconnect" : "Sync Accounts"}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={onManage ?? onDisconnect}
            disabled={connecting || disconnecting}
            accessibilityRole="button"
            accessibilityLabel={onManage ? `Manage ${platform.label}` : `Disconnect ${platform.label}`}
            style={({ pressed }) => ({
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: onManage ? colors.border : colors.danger,
              alignItems: "center",
              opacity: pressed || disconnecting ? 0.7 : 1,
            })}
          >
            {disconnecting ? (
              <ActivityIndicator size="small" color={onManage ? colors.textSecondary : colors.danger} />
            ) : (
              <Text
                style={{
                  ...typography.micro,
                  color: onManage ? colors.textPrimary : colors.danger,
                  fontWeight: "600",
                }}
              >
                {onManage ? "Manage" : "Disconnect"}
              </Text>
            )}
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={onConnect}
          disabled={connecting}
          accessibilityRole="button"
          accessibilityLabel={`Connect ${platform.label}`}
          style={({ pressed }) => ({
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: radius.sm,
            backgroundColor: platform.color,
            alignItems: "center",
            opacity: pressed || connecting ? 0.7 : 1,
          })}
        >
          {connecting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={{ ...typography.micro, color: "#fff", fontWeight: "600" }}>
              Connect
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
}
