import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
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

const START_HOUR = 6;
const END_HOUR = 22;
const SLOT_HEIGHT = 64;

const PLATFORM_COLOR: Record<string, string> = {
  instagram: "#E1306C",
  pinterest: "#E60023",
};

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
}

// ─── Draggable Post Block ──────────────────────────────────────────────────────

interface DayPostBlockProps {
  post: PostRow;
  hour: number;
  slotHeightSV: SharedValue<number>;
  onSelect: () => void;
  onDrop: (postId: string, newHour: number) => void;
}

function DayPostBlock({
  post,
  hour,
  slotHeightSV,
  onSelect,
  onDrop,
}: DayPostBlockProps) {
  const { colors } = useTheme();
  const ty = useSharedValue(0);
  const active = useSharedValue(false);
  const hourSV = useSharedValue(hour);
  hourSV.value = hour;

  const handleDrop = useCallback(
    (targetHour: number) => {
      if (targetHour !== hour) onDrop(post.id, targetHour);
    },
    [hour, post.id, onDrop],
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
          ty.value = e.translationY;
        })
        .onEnd((e) => {
          const deltaHours = Math.round(e.translationY / slotHeightSV.value);
          const targetHour = Math.max(
            START_HOUR,
            Math.min(END_HOUR - 1, hourSV.value + deltaHours),
          );
          active.value = false;
          ty.value = withSpring(0, { damping: 20 });
          runOnJS(handleDrop)(targetHour);
        })
        .onFinalize(() => {
          active.value = false;
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
    transform: [{ translateY: ty.value }],
    zIndex: active.value ? 999 : 2,
    opacity: active.value ? 0.88 : 1,
    shadowOpacity: active.value ? 0.3 : 0.1,
    shadowRadius: active.value ? 10 : 3,
    elevation: active.value ? 8 : 2,
  }));

  const color = PLATFORM_COLOR[post.platform] ?? colors.primary;
  const preview = (post.caption ?? post.hook ?? "").slice(0, 55) || "(no caption)";
  const timeStr = post.scheduled_for
    ? new Date(post.scheduled_for).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[
          {
            position: "absolute",
            left: 60,
            right: spacing.sm,
            top: (hour - START_HOUR) * SLOT_HEIGHT + 2,
            height: SLOT_HEIGHT - 6,
            backgroundColor: color + "1A",
            borderLeftWidth: 3,
            borderLeftColor: color,
            borderRadius: radius.md,
            padding: spacing.sm,
            justifyContent: "center",
            shadowColor: color,
            shadowOffset: { width: 0, height: 2 },
          },
          animStyle,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Post at ${timeStr}`}
      >
        {timeStr ? (
          <Text
            style={{ ...typography.micro, color: colors.textMuted, marginBottom: 2 }}
            numberOfLines={1}
          >
            {timeStr}
          </Text>
        ) : null}
        <Text
          style={{ ...typography.caption, color: colors.textPrimary, fontWeight: "600" }}
          numberOfLines={2}
        >
          {preview}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}

// ─── Day View ──────────────────────────────────────────────────────────────────

interface DayViewProps {
  posts: PostRow[];
  referenceDate: Date;
  onSelectPost: (post: PostRow) => void;
  onReschedule: (postId: string, newScheduledFor: string) => void;
}

export function DayView({
  posts,
  referenceDate,
  onSelectPost,
  onReschedule,
}: DayViewProps) {
  const { colors } = useTheme();
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date(referenceDate);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const slotHeightSV = useSharedValue(SLOT_HEIGHT);

  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const dateKey = useMemo(() => toDateKey(currentDate), [currentDate]);
  const isToday = dateKey === todayKey;

  const dayPosts = useMemo(
    () => posts.filter((p) => p.scheduled_for?.slice(0, 10) === dateKey),
    [posts, dateKey],
  );

  const handleDrop = useCallback(
    (postId: string, newHour: number) => {
      const post = posts.find((p) => p.id === postId);
      if (!post?.scheduled_for) return;
      const dt = new Date(post.scheduled_for);
      dt.setHours(newHour, dt.getMinutes(), 0, 0);
      onReschedule(postId, dt.toISOString());
    },
    [posts, onReschedule],
  );

  const hours = useMemo(
    () => Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i),
    [],
  );

  const totalHeight = (END_HOUR - START_HOUR) * SLOT_HEIGHT;

  const dateLabel = currentDate.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <View style={{ gap: spacing.md }}>
      {/* Navigation */}
      <View
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
      >
        <Pressable
          onPress={() =>
            setCurrentDate((d) => {
              const n = new Date(d);
              n.setDate(n.getDate() - 1);
              return n;
            })
          }
          style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
          accessibilityLabel="Previous day"
        >
          <Text style={{ ...typography.h2, color: colors.primary }}>‹</Text>
        </Pressable>

        <View style={{ alignItems: "center" }}>
          <Text style={{ ...typography.body, color: colors.textPrimary, fontWeight: "600" }}>
            {dateLabel}
          </Text>
          {isToday && (
            <Text style={{ ...typography.micro, color: colors.primary, marginTop: 1 }}>
              Today
            </Text>
          )}
        </View>

        <Pressable
          onPress={() =>
            setCurrentDate((d) => {
              const n = new Date(d);
              n.setDate(n.getDate() + 1);
              return n;
            })
          }
          style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
          accessibilityLabel="Next day"
        >
          <Text style={{ ...typography.h2, color: colors.primary }}>›</Text>
        </Pressable>
      </View>

      {/* Timeline */}
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.lg,
          overflow: "hidden",
        }}
      >
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
          <View style={{ position: "relative", height: totalHeight }}>
            {/* Hour slot lines */}
            {hours.map((hour) => (
              <View
                key={hour}
                style={{
                  position: "absolute",
                  top: (hour - START_HOUR) * SLOT_HEIGHT,
                  left: 0,
                  right: 0,
                  height: SLOT_HEIGHT,
                  flexDirection: "row",
                }}
              >
                {/* Hour label */}
                <View
                  style={{
                    width: 52,
                    alignItems: "flex-end",
                    paddingRight: spacing.sm,
                    paddingTop: spacing.xs,
                    borderRightWidth: 1,
                    borderRightColor: colors.borderSoft,
                  }}
                >
                  <Text style={{ ...typography.micro, color: colors.textMuted }}>
                    {formatHour(hour)}
                  </Text>
                </View>
                {/* Horizontal rule */}
                <View
                  style={{
                    flex: 1,
                    borderTopWidth: 1,
                    borderTopColor: colors.borderSoft,
                  }}
                />
              </View>
            ))}

            {/* Post blocks (absolute positioned) */}
            {dayPosts.map((post) => {
              const h = post.scheduled_for
                ? new Date(post.scheduled_for).getHours()
                : START_HOUR;
              const clampedHour = Math.max(START_HOUR, Math.min(END_HOUR - 1, h));
              return (
                <DayPostBlock
                  key={post.id}
                  post={post}
                  hour={clampedHour}
                  slotHeightSV={slotHeightSV}
                  onSelect={() => onSelectPost(post)}
                  onDrop={handleDrop}
                />
              );
            })}

            {/* Now line */}
            {isToday && (() => {
              const now = new Date();
              const nowHour = now.getHours() + now.getMinutes() / 60;
              if (nowHour < START_HOUR || nowHour > END_HOUR) return null;
              const top = (nowHour - START_HOUR) * SLOT_HEIGHT;
              return (
                <View
                  style={{
                    position: "absolute",
                    left: 52,
                    right: 0,
                    top,
                    height: 2,
                    backgroundColor: colors.primary,
                    opacity: 0.7,
                  }}
                />
              );
            })()}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
