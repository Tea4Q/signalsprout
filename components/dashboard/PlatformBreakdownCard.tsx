import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { PlatformPerformanceRow } from "@/services/analytics/reportingService";
import { ActivityIndicator, Text, View } from "react-native";

interface PlatformBreakdownCardProps {
  platforms: PlatformPerformanceRow[];
  loading: boolean;
}

export function PlatformBreakdownCard({
  platforms,
  loading,
}: PlatformBreakdownCardProps) {
  const { colors } = useTheme();

  const instagram = platforms.find((p) => p.platform === "instagram");
  const facebook = platforms.find((p) => p.platform === "facebook");
  const pinterest = platforms.find((p) => p.platform === "pinterest");

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.xl,
        gap: spacing.md,
      }}
    >
      <Text style={{ ...typography.caption, color: colors.textSecondary }}>
        Platform Breakdown
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.primary} size="small" />
      ) : (
        <View style={{ flexDirection: "row", gap: spacing.lg }}>
          {[
            { label: "Instagram", data: instagram, color: colors.info },
            { label: "Facebook", data: facebook, color: colors.primary },
            { label: "Pinterest", data: pinterest, color: colors.danger },
          ].map(({ label, data, color }) => (
            <View key={label} style={{ flex: 1, gap: spacing.xs }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: color,
                  }}
                />
                <Text
                  style={{ ...typography.micro, color: colors.textSecondary }}
                >
                  {label}
                </Text>
              </View>

              <Text
                style={{
                  ...typography.h3,
                  color: colors.textPrimary,
                }}
              >
                {(data?.impressions ?? 0).toLocaleString()}
              </Text>
              <Text style={{ ...typography.micro, color: colors.textMuted }}>
                impressions
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginTop: spacing.xs,
                }}
              >
                <View>
                  <Text
                    style={{
                      ...typography.micro,
                      color: colors.textPrimary,
                      fontWeight: "600",
                    }}
                  >
                    {(data?.saves ?? 0).toLocaleString()}
                  </Text>
                  <Text
                    style={{ ...typography.micro, color: colors.textMuted }}
                  >
                    saves
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={{
                      ...typography.micro,
                      color: colors.textPrimary,
                      fontWeight: "600",
                    }}
                  >
                    {((data?.avgEngagementRate ?? 0) * 100).toFixed(1)}%
                  </Text>
                  <Text
                    style={{ ...typography.micro, color: colors.textMuted }}
                  >
                    eng rate
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
