import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useWorkspace } from "@/context/workspace-context";
import { AppTabs, TabItem } from "@/components/ui/AppTabs";
import { CalendarGrid, DayDots } from "@/components/calendar/CalendarGrid";
import { QueueList } from "@/components/calendar/QueueList";
import { getPosts } from "@/services/scheduling/postService";
import {
  getQueue,
  retryFailedPost,
  QueueItem,
} from "@/services/scheduling/publishQueueService";
import type { Database } from "@/types/database";

type PostRow = Database["public"]["Tables"]["posts"]["Row"];

const TABS: TabItem[] = [
  { key: "month", label: "Month" },
  { key: "queue", label: "Queue" },
  { key: "failed", label: "Failed" },
];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function CalendarScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { workspaceId, loading: loadingWorkspace } = useWorkspace();

  const now = new Date();
  const [activeTab, setActiveTab] = useState("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [scheduledPosts, setScheduledPosts] = useState<PostRow[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [daySheetPosts, setDaySheetPosts] = useState<PostRow[]>([]);
  const [sheetVisible, setSheetVisible] = useState(false);

  const s = styles(colors);

  const loadAll = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const [posts, queue] = await Promise.all([
        getPosts(workspaceId, { status: "scheduled" }),
        getQueue(workspaceId),
      ]);
      setScheduledPosts(posts);
      setQueueItems(queue);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!loadingWorkspace) loadAll();
  }, [loadingWorkspace, loadAll]);

  const dots = useMemo<DayDots>(() => {
    const map: DayDots = {};
    for (const post of scheduledPosts) {
      if (!post.scheduled_for) continue;
      const dateKey = post.scheduled_for.slice(0, 10);
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(post.platform as "instagram" | "pinterest");
    }
    return map;
  }, [scheduledPosts]);

  const handleSelectDate = useCallback(
    (date: string) => {
      setSelectedDate(date);
      const dayPosts = scheduledPosts.filter(
        (p) => p.scheduled_for?.slice(0, 10) === date,
      );
      setDaySheetPosts(dayPosts);
      setSheetVisible(true);
    },
    [scheduledPosts],
  );

  const monthQueueItems = useMemo(() => {
    return queueItems.filter((j) => {
      const d = new Date(j.run_at);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }, [queueItems, year, month]);

  const handleRetry = useCallback(
    async (postId: string) => {
      try {
        await retryFailedPost(postId);
        await loadAll();
      } catch {
        // ignore
      }
    },
    [loadAll],
  );

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  if (loadingWorkspace) {
    return (
      <SafeAreaView style={s.safeArea}>
        <ActivityIndicator
          color={colors.primary}
          style={{ marginTop: spacing["3xl"] }}
        />
      </SafeAreaView>
    );
  }

  const failedQueueItems = queueItems.filter(
    (j) => j.post?.status === "failed",
  );

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.header}>
        <Text style={{ ...typography.h2, color: colors.textPrimary }}>
          Calendar
        </Text>
      </View>

      <AppTabs tabs={TABS} activeKey={activeTab} onChange={setActiveTab} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scrollContent}>
        {loading && (
          <ActivityIndicator
            color={colors.primary}
            style={{ marginVertical: spacing.lg }}
          />
        )}

        {activeTab === "month" && (
          <View style={{ gap: spacing.lg }}>
            <View style={s.monthNav}>
              <Pressable
                onPress={prevMonth}
                style={s.navBtn}
                accessibilityLabel="Previous month"
              >
                <Text style={{ ...typography.h2, color: colors.primary }}>
                  ‹
                </Text>
              </Pressable>
              <Text style={{ ...typography.h3, color: colors.textPrimary }}>
                {MONTH_NAMES[month]} {year}
              </Text>
              <Pressable
                onPress={nextMonth}
                style={s.navBtn}
                accessibilityLabel="Next month"
              >
                <Text style={{ ...typography.h2, color: colors.primary }}>
                  ›
                </Text>
              </Pressable>
            </View>

            <CalendarGrid
              year={year}
              month={month}
              dots={dots}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
            />

            {monthQueueItems.length > 0 && (
              <View style={{ gap: spacing.sm }}>
                <Text
                  style={{
                    ...typography.caption,
                    color: colors.textSecondary,
                    textTransform: "uppercase",
                  }}
                >
                  Scheduled this month
                </Text>
                <QueueList items={monthQueueItems} onRetry={handleRetry} />
              </View>
            )}
          </View>
        )}

        {activeTab === "queue" && (
          <View style={{ gap: spacing.sm }}>
            <Text
              style={{
                ...typography.caption,
                color: colors.textSecondary,
                textTransform: "uppercase",
              }}
            >
              Upcoming posts
            </Text>
            <QueueList
              items={queueItems.filter((j) => j.status !== "failed")}
              onRetry={handleRetry}
              emptyLabel="No posts queued yet."
            />
          </View>
        )}

        {activeTab === "failed" && (
          <View style={{ gap: spacing.sm }}>
            <Text
              style={{
                ...typography.caption,
                color: colors.textSecondary,
                textTransform: "uppercase",
              }}
            >
              Failed posts
            </Text>
            {failedQueueItems.length === 0 ? (
              <View style={{ padding: spacing.xl, alignItems: "center" }}>
                <Text style={{ ...typography.body, color: colors.textMuted }}>
                  No failed posts.
                </Text>
              </View>
            ) : (
              <QueueList items={failedQueueItems} onRetry={handleRetry} />
            )}
          </View>
        )}
      </ScrollView>

      {/* Day sheet */}
      <Modal
        visible={sheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetVisible(false)}
      >
        <Pressable
          style={s.sheetOverlay}
          onPress={() => setSheetVisible(false)}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View style={s.sheet}>
          <View style={s.sheetHandle} />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: spacing.lg,
            }}
          >
            <Text style={{ ...typography.h3, color: colors.textPrimary }}>
              {selectedDate ?? ""}
            </Text>
            <Pressable
              onPress={() => setSheetVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Close sheet"
            >
              <Text style={{ ...typography.body, color: colors.secondary }}>
                Done
              </Text>
            </Pressable>
          </View>

          {daySheetPosts.length === 0 ? (
            <Text style={{ ...typography.body, color: colors.textMuted }}>
              No posts on this day.
            </Text>
          ) : (
            daySheetPosts.map((post) => (
              <Pressable
                key={post.id}
                style={s.sheetPost}
                onPress={() => {
                  setSheetVisible(false);
                  router.push({
                    pathname: "/modals/schedule-post",
                    params: { postId: post.id },
                  });
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor:
                        post.platform === "instagram" ? "#E1306C" : "#E60023",
                    }}
                  />
                  <Text
                    style={{
                      ...typography.micro,
                      color: colors.textMuted,
                      textTransform: "uppercase",
                    }}
                  >
                    {post.platform} ·{" "}
                    {post.scheduled_for
                      ? new Date(post.scheduled_for).toLocaleTimeString(
                          undefined,
                          { hour: "2-digit", minute: "2-digit" },
                        )
                      : "—"}
                  </Text>
                </View>
                <Text
                  style={{ ...typography.body, color: colors.textPrimary }}
                  numberOfLines={2}
                >
                  {post.caption ?? post.hook ?? "No caption"}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function styles(colors: any) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    scrollContent: { padding: spacing.xl, paddingBottom: spacing["3xl"] },
    monthNav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    navBtn: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      padding: spacing.xl,
      paddingBottom: spacing["3xl"],
      maxHeight: "60%",
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: "center",
      marginBottom: spacing.lg,
    },
    sheetPost: {
      gap: spacing.xs,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
    },
  });
}
