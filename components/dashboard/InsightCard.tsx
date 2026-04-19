import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { Recommendation } from "@/services/analytics/recommendationService";
import type { Database } from "@/types/database";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { BadgeVariant } from "../ui/AppBadge";
import { AppBadge } from "../ui/AppBadge";

type RecommendationAction =
  Database["public"]["Enums"]["recommendation_action"];

const ACTION_VARIANT: Record<RecommendationAction, BadgeVariant> = {
  scale: "success",
  keep_testing: "info",
  rewrite: "warning",
  pause: "warning",
  remove: "danger",
};

const ACTION_LABEL: Record<RecommendationAction, string> = {
  scale: "Scale",
  keep_testing: "Keep Testing",
  rewrite: "Rewrite",
  pause: "Pause",
  remove: "Remove",
};

interface InsightCardProps {
  recommendation: Recommendation | null;
  loading: boolean;
  onPress: () => void;
}

export function InsightCard({
  recommendation,
  loading,
  onPress,
}: InsightCardProps) {
  const { colors } = useTheme();

  const action = recommendation?.action as RecommendationAction | undefined;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.xl,
        gap: spacing.sm,
      })}
      accessibilityRole="button"
      accessibilityLabel="View AI Insights"
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ ...typography.caption, color: colors.textSecondary }}>
          AI Insight
        </Text>
        <Text style={{ ...typography.micro, color: colors.primary }}>
          View Analytics →
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} size="small" />
      ) : recommendation && action ? (
        <>
          <AppBadge
            label={ACTION_LABEL[action]}
            variant={ACTION_VARIANT[action]}
          />
          <Text
            style={{
              ...typography.body,
              color: colors.textSecondary,
            }}
            numberOfLines={3}
          >
            {recommendation.summary}
          </Text>
        </>
      ) : (
        <Text style={{ ...typography.caption, color: colors.textMuted }}>
          No insights yet — generate recommendations in Analytics.
        </Text>
      )}
    </Pressable>
  );
}
