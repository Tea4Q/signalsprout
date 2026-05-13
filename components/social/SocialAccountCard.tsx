import { AppBadge } from "@/components/ui/AppBadge";
import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { PlatformConfig } from "@/lib/platforms/config";
import type { SocialAccount } from "@/services/social/socialAccountService";
import { isTokenExpired, isTokenExpiringSoon } from "@/services/social/socialAccountService";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";

interface SocialAccountCardProps {
  platform: PlatformConfig;
  account: SocialAccount | null;
  connecting: boolean;
  disconnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function SocialAccountCard({
  platform,
  account,
  connecting,
  disconnecting,
  onConnect,
  onDisconnect,
}: SocialAccountCardProps) {
  const { colors } = useTheme();

  const isConnected = !!account;
  const expired = account ? isTokenExpired(account) : false;
  const expiringSoon = account ? isTokenExpiringSoon(account) : false;

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
            {account.avatar_url ? (
              <Image
                source={{ uri: account.avatar_url }}
                style={{ width: 28, height: 28, borderRadius: 14 }}
                accessibilityLabel={`${account.account_name} avatar`}
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
              {account.account_identifier
                ? `@${account.account_identifier}`
                : account.account_name}
            </Text>
          </View>

          {/* Token status */}
          {expired ? (
            <AppBadge label="Token expired" variant="danger" />
          ) : expiringSoon ? (
            <AppBadge label="Expiring soon" variant="warning" />
          ) : (
            <AppBadge label="Connected" variant="success" />
          )}
        </View>
      ) : (
        <Text style={{ ...typography.micro, color: colors.textMuted }}>
          Not connected
        </Text>
      )}

      {/* Action button */}
      {isConnected ? (
        <View style={{ gap: spacing.xs }}>
          {expired && (
            <Pressable
              onPress={onConnect}
              disabled={connecting || disconnecting}
              accessibilityRole="button"
              accessibilityLabel={`Reconnect ${platform.label}`}
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
                  Reconnect
                </Text>
              )}
            </Pressable>
          )}
          <Pressable
            onPress={onDisconnect}
            disabled={connecting || disconnecting}
            accessibilityRole="button"
            accessibilityLabel={`Disconnect ${platform.label}`}
            style={({ pressed }) => ({
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: colors.danger,
              alignItems: "center",
              opacity: pressed || disconnecting ? 0.7 : 1,
            })}
          >
            {disconnecting ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <Text style={{ ...typography.micro, color: colors.danger, fontWeight: "600" }}>
                Disconnect
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
