import type { AccountInsightCard } from "@/services/analytics/accountInsightsService";
import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";
import * as Linking from "expo-linking";

interface AccountInsightsSectionProps {
  insights: AccountInsightCard[];
  loading?: boolean;
}

function percentLabel(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "--";
  return `${value.toFixed(1)}%`;
}

function openMaybeUrl(url: string | null | undefined) {
  if (!url) return;
  Linking.openURL(url).catch(() => {
    // Ignore open failures in embedded environments.
  });
}

export function AccountInsightsSection({ insights, loading = false }: AccountInsightsSectionProps) {
  const { colors } = useTheme();

  return (
    <View style={{ gap: spacing.md }}>
      <Text style={{ ...typography.h3, color: colors.textPrimary }}>
        Account Insights
      </Text>

      {loading ? (
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.xl,
            alignItems: "center",
          }}
        >
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : insights.length === 0 ? (
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
            gap: spacing.xs,
          }}
        >
          <Text style={{ ...typography.caption, color: colors.textSecondary }}>
            No account insights yet. Run Sync Metrics after connecting and publishing.
          </Text>
        </View>
      ) : (
        <View style={{ gap: spacing.lg }}>
          {insights.map((insight) => (
            <View
              key={`${insight.platform}:${insight.accountName}:${insight.capturedAt}`}
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.lg,
                gap: spacing.md,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Text style={{ ...typography.caption, color: colors.textMuted, textTransform: "capitalize" }}>
                    {insight.platform}
                  </Text>
                  <Text style={{ ...typography.body, color: colors.textPrimary, fontWeight: "600" }}>
                    {insight.accountName}
                  </Text>
                </View>
                <Text style={{ ...typography.micro, color: colors.textMuted }}>
                  {new Date(insight.capturedAt).toLocaleDateString()}
                </Text>
              </View>

              <View style={{ flexDirection: "row", gap: spacing.md }}>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text style={{ ...typography.micro, color: colors.textSecondary }}>Views</Text>
                  <Text style={{ ...typography.h2, color: colors.textPrimary }}>{insight.views.toLocaleString()}</Text>
                </View>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text style={{ ...typography.micro, color: colors.textSecondary }}>Accounts reached</Text>
                  <Text style={{ ...typography.h2, color: colors.textPrimary }}>{insight.accountsReached.toLocaleString()}</Text>
                </View>
              </View>

              <View style={{ gap: spacing.xs }}>
                <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                  Follower split: {percentLabel(insight.followersShare)} followers · {percentLabel(insight.nonFollowersShare)} non-followers
                </Text>
                <View style={{ height: 8, borderRadius: 999, backgroundColor: colors.surfaceAlt, overflow: "hidden", flexDirection: "row" }}>
                  <View
                    style={{
                      width: `${Math.max(0, Math.min(100, insight.followersShare ?? 0))}%`,
                      backgroundColor: colors.primary,
                    }}
                  />
                  <View
                    style={{
                      width: `${Math.max(0, Math.min(100, insight.nonFollowersShare ?? 0))}%`,
                      backgroundColor: colors.secondary,
                    }}
                  />
                </View>
              </View>

              <View style={{ gap: spacing.xs }}>
                <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                  By content type: {percentLabel(insight.postsShare)} posts · {percentLabel(insight.storiesShare)} stories
                </Text>
                <View style={{ height: 8, borderRadius: 999, backgroundColor: colors.surfaceAlt, overflow: "hidden", flexDirection: "row" }}>
                  <View
                    style={{
                      width: `${Math.max(0, Math.min(100, insight.postsShare ?? 0))}%`,
                      backgroundColor: colors.accent,
                    }}
                  />
                  <View
                    style={{
                      width: `${Math.max(0, Math.min(100, insight.storiesShare ?? 0))}%`,
                      backgroundColor: colors.primary,
                    }}
                  />
                </View>
              </View>

              <View style={{ gap: spacing.sm }}>
                <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                  Top content by views
                </Text>
                {insight.topContent.length === 0 ? (
                  <Text style={{ ...typography.micro, color: colors.textMuted }}>
                    No content cards available from this snapshot.
                  </Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                    {insight.topContent.map((item) => (
                      <Pressable
                        key={item.id}
                        onPress={() => openMaybeUrl(item.permalink)}
                        style={{
                          width: 122,
                          backgroundColor: colors.surfaceAlt,
                          borderRadius: radius.md,
                          overflow: "hidden",
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        {item.thumbnailUrl ? (
                          <Image
                            source={{ uri: item.thumbnailUrl }}
                            style={{ width: 122, height: 150, backgroundColor: colors.borderSoft }}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={{
                              width: 122,
                              height: 150,
                              backgroundColor: colors.borderSoft,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text style={{ ...typography.caption, color: colors.textMuted }}>No image</Text>
                          </View>
                        )}
                        <View style={{ padding: spacing.sm, gap: 2 }}>
                          <Text numberOfLines={2} style={{ ...typography.micro, color: colors.textPrimary }}>
                            {item.title || item.mediaType || "Untitled"}
                          </Text>
                          <Text style={{ ...typography.micro, color: colors.textSecondary }}>
                            {item.views.toLocaleString()} views
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
