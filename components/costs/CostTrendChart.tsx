import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { formatUSD } from "@/lib/currency";
import { ScrollView, Text, View } from "react-native";

export interface ChartDataPoint {
  label: string;
  ai_text: number;
  ai_images: number;
  infra: number;
  other: number;
}

interface CostTrendChartProps {
  data: ChartDataPoint[];
}

type SeriesKey = "ai_text" | "ai_images" | "infra" | "other";

const SERIES: { key: SeriesKey; label: string }[] = [
  { key: "ai_text", label: "AI Text" },
  { key: "ai_images", label: "AI Images" },
  { key: "infra", label: "Infra" },
  { key: "other", label: "Other" },
];

const BAR_HEIGHT = 100;
const BAR_WIDTH = 40;

export function CostTrendChart({ data }: CostTrendChartProps) {
  const { colors } = useTheme();

  const SERIES_COLORS: Record<SeriesKey, string> = {
    ai_text: colors.primary,
    ai_images: colors.accent,
    infra: colors.secondary,
    other: colors.textMuted,
  };

  const maxTotal = data.reduce((max, d) => {
    const total = d.ai_text + d.ai_images + d.infra + d.other;
    return Math.max(max, total);
  }, 1);

  if (data.length === 0) {
    return (
      <View style={{ alignItems: "center", paddingVertical: spacing["2xl"] }}>
        <Text style={{ ...typography.caption, color: colors.textMuted }}>
          No data for this period.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.lg }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: spacing.sm,
          paddingHorizontal: spacing.xs,
          paddingBottom: spacing.xs,
        }}
      >
        {data.map((d, i) => {
          const total = d.ai_text + d.ai_images + d.infra + d.other;

          return (
            <View
              key={i}
              style={{
                alignItems: "center",
                gap: spacing.xs,
                width: BAR_WIDTH,
              }}
            >
              {/* Stacked bar */}
              <View
                style={{
                  width: BAR_WIDTH,
                  height: BAR_HEIGHT,
                  justifyContent: "flex-end",
                }}
              >
                <View
                  style={{
                    width: BAR_WIDTH,
                    borderRadius: radius.sm,
                    overflow: "hidden",
                  }}
                >
                  {SERIES.map((s) => {
                    const segH =
                      maxTotal > 0
                        ? Math.round((d[s.key] / maxTotal) * BAR_HEIGHT)
                        : 0;
                    if (segH < 1) return null;
                    return (
                      <View
                        key={s.key}
                        style={{
                          width: BAR_WIDTH,
                          height: segH,
                          backgroundColor: SERIES_COLORS[s.key],
                        }}
                      />
                    );
                  })}
                </View>
              </View>

              <Text
                style={{
                  ...typography.micro,
                  color: colors.textSecondary,
                  textAlign: "center",
                }}
              >
                {d.label}
              </Text>
              <Text style={{ ...typography.micro, color: colors.textMuted }}>
                {formatUSD(total)}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Legend */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.md,
        }}
      >
        {SERIES.map((s) => (
          <View
            key={s.key}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
            }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: SERIES_COLORS[s.key],
              }}
            />
            <Text style={{ ...typography.micro, color: colors.textSecondary }}>
              {s.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
