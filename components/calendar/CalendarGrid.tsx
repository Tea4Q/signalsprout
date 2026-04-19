import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { radius, spacing, typography } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";

// Days with posts: map of "YYYY-MM-DD" → platform set
export type DayDots = Record<string, ("instagram" | "pinterest")[]>;

interface CalendarGridProps {
  year: number;
  month: number; // 0-based (Jan = 0)
  dots: DayDots;
  selectedDate: string | null; // "YYYY-MM-DD"
  onSelectDate: (date: string) => void;
}

const PLATFORM_COLOR: Record<"instagram" | "pinterest", string> = {
  instagram: "#E1306C",
  pinterest: "#E60023",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarGrid({
  year,
  month,
  dots,
  selectedDate,
  onSelectDate,
}: CalendarGridProps) {
  const { colors } = useTheme();

  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const { cells } = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: ({ date: string; day: number } | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ date, day: d });
    }
    // Pad to complete last row
    while (cells.length % 7 !== 0) cells.push(null);
    return { cells };
  }, [year, month]);

  const CELL_SIZE = 44;

  return (
    <View>
      {/* Day labels */}
      <View style={{ flexDirection: "row", marginBottom: spacing.xs }}>
        {DAY_LABELS.map((label) => (
          <View key={label} style={{ flex: 1, alignItems: "center" }}>
            <Text
              style={{
                ...typography.micro,
                color: colors.textMuted,
                fontWeight: "600",
              }}
            >
              {label}
            </Text>
          </View>
        ))}
      </View>

      {/* Grid rows */}
      {Array.from({ length: cells.length / 7 }, (_, rowIdx) => (
        <View key={rowIdx} style={{ flexDirection: "row", marginBottom: 2 }}>
          {cells.slice(rowIdx * 7, rowIdx * 7 + 7).map((cell, colIdx) => {
            if (!cell) {
              return (
                <View key={colIdx} style={{ flex: 1, height: CELL_SIZE }} />
              );
            }

            const isToday = cell.date === today;
            const isSelected = cell.date === selectedDate;
            const platformDots = dots[cell.date] ?? [];

            return (
              <Pressable
                key={cell.date}
                onPress={() => onSelectDate(cell.date)}
                style={({ pressed }) => ({
                  flex: 1,
                  height: CELL_SIZE,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: radius.sm,
                  backgroundColor: isSelected
                    ? colors.primary
                    : isToday
                      ? colors.primarySoft
                      : "transparent",
                  opacity: pressed ? 0.7 : 1,
                })}
                accessibilityRole="button"
                accessibilityLabel={cell.date}
                accessibilityState={{ selected: isSelected }}
              >
                <Text
                  style={{
                    ...typography.caption,
                    fontWeight: isToday || isSelected ? "700" : "400",
                    color: isSelected
                      ? colors.background
                      : isToday
                        ? colors.primary
                        : colors.textPrimary,
                  }}
                >
                  {cell.day}
                </Text>

                {/* Platform dots */}
                {platformDots.length > 0 && (
                  <View style={{ flexDirection: "row", gap: 2, marginTop: 2 }}>
                    {[...new Set(platformDots)].map((platform) => (
                      <View
                        key={platform}
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: 3,
                          backgroundColor: isSelected
                            ? colors.background
                            : PLATFORM_COLOR[platform],
                        }}
                      />
                    ))}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
