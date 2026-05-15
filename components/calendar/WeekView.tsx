import React, { useCallback, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { spacing, radius, typography } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";
import type { Database } from "../../types/database";

type PostRow = Database["public"]["Tables"]["posts"]["Row"];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PLATFORM_COLOR: Record<string, string> = {
  instagram: "#E1306C",
  pinterest: "#E60023",
};

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// ─── Draggable Post Pill ──────────────────────────────────────────────────────

interface DraggablePillProps {
  post: PostRow;
  colIndexSV: SharedValue<number>;
  columnWidthSV: SharedValue<number>;
  totalColsSV: SharedValue<number>;
  weekDayKeys: string[];
  onSelect: () => void;
  onDrop: (postId: string, targetKey: string) => void;
}

function DraggablePill({
  post,
  colIndexSV,
  columnWidthSV,
  totalColsSV,
  weekDayKeys,
  onSelect,
  onDrop,
}: DraggablePillProps) {
  const { colors } = useTheme();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const active = useSharedValue(false);

  const handleDrop = useCallback(
    (targetIdx: number) => {
      const key = weekDayKeys[targetIdx];
      if (key) onDrop(post.id, key);
    },
    [weekDayKeys, post.id, onDrop],
  );

  const jsSelect = useCallback(() => onSelect(), [onSelect]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(8)
        .onStart(() => {
          active.value = true;
        })
        .onUpdate((e) => {
          tx.value = e.translationX;
          ty.value = e.translationY;
        })
        .onEnd((e) => {
          const delta = Math.round(e.translationX / columnWidthSV.value);
          const target = Math.max(
            0,
            Math.min(totalColsSV.value - 1, colIndexSV.value + delta),
          );
          active.value = false;
          tx.value = withSpring(0, { damping: 20 });
          ty.value = withSpring(0, { damping: 20 });
          if (target !== colIndexSV.value) {
            runOnJS(handleDrop)(target);
          }
        })
        .onFinalize(() => {
          active.value = false;
          tx.value = withSpring(0, { damping: 20 });
          ty.value = withSpring(0, { damping: 20 });
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handleDrop],
  );

  const tap = useMemo(
    () => Gesture.Tap().onEnd(() => runOnJS(jsSelect)()),
    [jsSelect],
  );

  const composed = useMemo(() => Gesture.Exclusive(pan, tap), [pan, tap]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
    zIndex: active.value ? 999 : 1,
    opacity: active.value ? 0.88 : 1,
    shadowOpacity: active.value ? 0.25 : 0,
    shadowRadius: active.value ? 8 : 0,
    elevation: active.value ? 8 : 0,
  }));

  const color = PLATFORM_COLOR[post.platform] ?? colors.primary;
  const postDate = post.status === "published"
    ? (post.published_at ?? post.scheduled_for)
    : (post.scheduled_for ?? post.published_at);
  const time = postDate
    ? new Date(postDate).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const preview = (post.caption ?? post.hook ?? "").slice(0, 18) || "—";

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[
          {
            backgroundColor: color + "20",
            borderLeftWidth: 2,
            borderLeftColor: color,
            borderRadius: radius.sm,
            padding: 3,
            marginBottom: 2,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
          },
          animStyle,
        ]}
      >
        {time ? (
          <Text
            style={{
              fontSize: 9,
              lineHeight: 12,
              color: colors.textMuted,
              fontWeight: "500",
            }}
            numberOfLines={1}
          >
            {time}
          </Text>
        ) : null}
        <Text
          style={{
            fontSize: 10,
            lineHeight: 13,
            color: colors.textPrimary,
            fontWeight: "600",
          }}
          numberOfLines={2}
        >
          {preview}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}

// ─── Week Column ──────────────────────────────────────────────────────────────

interface WeekColumnProps {
  day: Date;
  colIdx: number;
  totalCols: number;
  isToday: boolean;
  dayPosts: PostRow[];
  weekDayKeys: string[];
  columnWidthSV: SharedValue<number>;
  totalColsSV: SharedValue<number>;
  colors: ReturnType<typeof useTheme>["colors"];
  onSelectPost: (post: PostRow) => void;
  onReschedule: (postId: string, targetKey: string) => void;
}

function WeekColumn({
  day,
  colIdx,
  totalCols,
  isToday,
  dayPosts,
  weekDayKeys,
  columnWidthSV,
  totalColsSV,
  colors,
  onSelectPost,
  onReschedule,
}: WeekColumnProps) {
  const colIndexSV = useSharedValue(colIdx);
  colIndexSV.value = colIdx;

  return (
    <View
      style={{
        flex: 1,
        borderRightWidth: colIdx < totalCols - 1 ? 1 : 0,
        borderRightColor: colors.borderSoft,
      }}
    >
      {/* Day header */}
      <View
        style={{
          alignItems: "center",
          paddingVertical: spacing.xs,
          backgroundColor: isToday ? colors.primarySoft : colors.surfaceAlt,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderSoft,
        }}
      >
        <Text
          style={{
            fontSize: 9,
            lineHeight: 12,
            color: colors.textMuted,
            fontWeight: "600",
            textTransform: "uppercase",
          }}
        >
          {DAY_LABELS[day.getDay()]}
        </Text>
        <Text
          style={{
            ...typography.caption,
            color: isToday ? colors.primary : colors.textPrimary,
            fontWeight: isToday ? "700" : "400",
          }}
        >
          {day.getDate()}
        </Text>
      </View>

      {/* Posts */}
      <View style={{ padding: 2, minHeight: 80, overflow: "hidden" }}>
        {dayPosts.map((post) => (
          <DraggablePill
            key={post.id}
            post={post}
            colIndexSV={colIndexSV}
            columnWidthSV={columnWidthSV}
            totalColsSV={totalColsSV}
            weekDayKeys={weekDayKeys}
            onSelect={() => onSelectPost(post)}
            onDrop={onReschedule}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Week View ─────────────────────────────────────────────────────────────────

interface WeekViewProps {
  posts: PostRow[];
  referenceDate: Date;
  onSelectPost: (post: PostRow) => void;
  onReschedule: (postId: string, newDateKey: string) => void;
}

export function WeekView({
  posts,
  referenceDate,
  onSelectPost,
  onReschedule,
}: WeekViewProps) {
  const { colors } = useTheme();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(referenceDate));
  const [containerWidth, setContainerWidth] = useState(350);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [weekStart],
  );

  const weekDayKeys = useMemo(() => weekDays.map(toDateKey), [weekDays]);
  const today = useMemo(() => toDateKey(new Date()), []);

  const postsByDay = useMemo(() => {
    const map: Record<string, PostRow[]> = {};
    for (const k of weekDayKeys) map[k] = [];
    for (const post of posts) {
      const raw = post.status === "published"
        ? (post.published_at ?? post.scheduled_for)
        : (post.scheduled_for ?? post.published_at);
      const key = raw ? toDateKey(new Date(raw)) : undefined;
      if (key && key in map) map[key].push(post);
    }
    return map;
  }, [posts, weekDayKeys]);

  const columnWidthSV = useSharedValue(containerWidth / 7);
  const totalColsSV = useSharedValue(7);

  // Keep shared values in sync
  columnWidthSV.value = containerWidth / 7;

  const weekLabel = `${weekDays[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${weekDays[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <View style={{ gap: spacing.md }}>
      {/* Navigation */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Pressable
          onPress={() =>
            setWeekStart((d) => {
              const n = new Date(d);
              n.setDate(n.getDate() - 7);
              return n;
            })
          }
          style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
          accessibilityLabel="Previous week"
        >
          <Text style={{ ...typography.h2, color: colors.primary }}>‹</Text>
        </Pressable>
        <Text style={{ ...typography.caption, color: colors.textSecondary }}>
          {weekLabel}
        </Text>
        <Pressable
          onPress={() =>
            setWeekStart((d) => {
              const n = new Date(d);
              n.setDate(n.getDate() + 7);
              return n;
            })
          }
          style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
          accessibilityLabel="Next week"
        >
          <Text style={{ ...typography.h2, color: colors.primary }}>›</Text>
        </Pressable>
      </View>

      {/* 7-column grid */}
      <View
        style={{
          flexDirection: "row",
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.lg,
          overflow: "hidden",
        }}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        {weekDays.map((day, colIdx) => (
          <WeekColumn
            key={weekDayKeys[colIdx]}
            day={day}
            colIdx={colIdx}
            totalCols={7}
            isToday={weekDayKeys[colIdx] === today}
            dayPosts={postsByDay[weekDayKeys[colIdx]] ?? []}
            weekDayKeys={weekDayKeys}
            columnWidthSV={columnWidthSV}
            totalColsSV={totalColsSV}
            colors={colors}
            onSelectPost={onSelectPost}
            onReschedule={onReschedule}
          />
        ))}
      </View>
    </View>
  );
}
