import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { Recommendation } from "@/services/analytics/recommendationService";
import type { Database } from "@/types/database";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { AppBadge, type BadgeVariant } from "../ui/AppBadge";
import { AppButton } from "../ui/AppButton";

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

interface RecommendationPanelProps {
  recommendations: Recommendation[];
  loading: boolean;
  onDismiss: (id: string) => void;
  onGenerate: () => void;
}

export function RecommendationPanel({
  recommendations,
  loading,
  onDismiss,
  onGenerate,
}: RecommendationPanelProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const visible = recommendations.filter((r) => (r.confidence_score ?? 0) >= 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Recommendations</Text>
        <AppButton
          label="Generate"
          onPress={onGenerate}
          variant="secondary"
          loading={loading}
        />
      </View>

      {loading && visible.length === 0 && (
        <ActivityIndicator
          color={colors.primary}
          style={{ marginVertical: spacing.xl }}
        />
      )}

      {!loading && visible.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            No recommendations yet. Tap Generate to analyse your content.
          </Text>
        </View>
      )}

      {visible.map((rec) => {
        const action = rec.action as RecommendationAction;
        const confidence = rec.confidence_score ?? 0;

        return (
          <View key={rec.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <AppBadge
                label={ACTION_LABEL[action]}
                variant={ACTION_VARIANT[action]}
              />
              <Pressable
                onPress={() => onDismiss(rec.id)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Dismiss recommendation"
              >
                <Text style={styles.dismiss}>✕</Text>
              </Pressable>
            </View>

            <Text style={styles.summary}>{rec.summary}</Text>

            {/* Confidence bar */}
            <View style={styles.confidenceRow}>
              <Text style={styles.confidenceLabel}>
                Confidence {Math.round(confidence * 100)}%
              </Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.max(0, Math.min(1, confidence)) * 100}%`,
                      backgroundColor:
                        confidence >= 0.7
                          ? colors.success
                          : confidence >= 0.4
                            ? colors.warning
                            : colors.danger,
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

type ThemeColors = ReturnType<
  typeof import("@/hooks/use-theme").useTheme
>["colors"];

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: spacing.md,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    title: {
      ...typography.h3,
      color: colors.textPrimary,
    },
    empty: {
      paddingVertical: spacing.xl,
      alignItems: "center",
    },
    emptyText: {
      ...typography.caption,
      color: colors.textMuted,
      textAlign: "center",
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    dismiss: {
      ...typography.caption,
      color: colors.textMuted,
      paddingHorizontal: spacing.sm,
    },
    summary: {
      ...typography.body,
      color: colors.textSecondary,
    },
    confidenceRow: {
      gap: spacing.xs,
    },
    confidenceLabel: {
      ...typography.micro,
      color: colors.textMuted,
    },
    barTrack: {
      height: 4,
      backgroundColor: colors.borderSoft,
      borderRadius: radius.sm,
      overflow: "hidden",
    },
    barFill: {
      height: "100%",
      borderRadius: radius.sm,
    },
  });
}
