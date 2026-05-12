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
import { useFocusEffect, useRouter } from "expo-router";
import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useWorkspace } from "@/context/workspace-context";
import { AppTabs, TabItem } from "@/components/ui/AppTabs";
import { CalendarGrid, DayDots } from "@/components/calendar/CalendarGrid";
import { QueueList } from "@/components/calendar/QueueList";
import { WeekView } from "@/components/calendar/WeekView";
import { DayView } from "@/components/calendar/DayView";
import { PostDetailSheet } from "@/components/calendar/PostDetailSheet";
import { getPosts, deletePost, approvePost, rejectPost } from "@/services/scheduling/postService";
import {
  getQueue,
  retryFailedPost,
  publishNow,
  reschedulePost,
  QueueItem,
} from "@/services/scheduling/publishQueueService";
import type { Database } from "@/types/database";

type PostRow = Database["public"]["Tables"]["posts"]["Row"];

const TABS: TabItem[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "queue", label: "Queue" },
  { key: "review", label: "Review" },
  { key: "failed", label: "Failed" },
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
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

  const [allPosts, setAllPosts] = useState<PostRow[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [daySheetPosts, setDaySheetPosts] = useState<PostRow[]>([]);
  const [sheetVisible, setSheetVisible] = useState(false);

  // Post detail sheet
  const [activePost, setActivePost] = useState<PostRow | null>(null);
  const [postSheetVisible, setPostSheetVisible] = useState(false);

  const s = styles(colors);

  // ── Data loading ──────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const [posts, queue] = await Promise.all([
        getPosts(workspaceId), // all posts with scheduled_for
        getQueue(workspaceId),
      ]);
      setAllPosts(posts);
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

  useFocusEffect(
    useCallback(() => {
      if (!loadingWorkspace) loadAll();
    }, [loadingWorkspace, loadAll]),
  );

  const scheduledPosts = useMemo(
    () => allPosts.filter((p) => p.scheduled_for),
    [allPosts],
  );

  const reviewPosts = useMemo(
    () => allPosts.filter((p) => p.status === "ready_for_review"),
    [allPosts],
  );

  // ── Month calendar dots ────────────────────────────────────────────────────────

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

  // ── Month navigation ──────────────────────────────────────────────────────────

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const monthQueueItems = useMemo(
    () =>
      queueItems.filter((j) => {
        const d = new Date(j.run_at);
        return d.getFullYear() === year && d.getMonth() === month;
      }),
    [queueItems, year, month],
  );

  // ── Day sheet (month-view date tap) ───────────────────────────────────────────

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

  // ── Post detail sheet ─────────────────────────────────────────────────────────

  const openPostSheet = useCallback((post: PostRow) => {
    setSheetVisible(false);
    setActivePost(post);
    setPostSheetVisible(true);
  }, []);

  const closePostSheet = useCallback(() => {
    setPostSheetVisible(false);
    setActivePost(null);
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────────

  const handleEdit = useCallback(
    (postId: string) => {
      closePostSheet();
      router.push({ pathname: "/modals/edit-post", params: { postId } });
    },
    [closePostSheet, router],
  );

  const handlePublishNow = useCallback(
    async (postId: string) => {
      try {
        await publishNow(postId);
        closePostSheet();
        await loadAll();
      } catch { /* ignore */ }
    },
    [closePostSheet, loadAll],
  );

  const handleDelete = useCallback(
    async (postId: string) => {
      try {
        await deletePost(postId);
        closePostSheet();
        await loadAll();
      } catch { /* ignore */ }
    },
    [closePostSheet, loadAll],
  );

  const handleReschedule = useCallback(
    async (postId: string, newDateKey: string) => {
      const post = allPosts.find((p) => p.id === postId);
      if (!post?.scheduled_for) return;
      const dt = new Date(post.scheduled_for);
      const [yr, mo, dy] = newDateKey.split("-").map(Number);
      dt.setFullYear(yr, mo - 1, dy);
      try {
        await reschedulePost(postId, dt.toISOString());
        await loadAll();
      } catch { /* ignore */ }
    },
    [allPosts, loadAll],
  );

  const handleRescheduleTime = useCallback(
    async (postId: string, newScheduledFor: string) => {
      try {
        await reschedulePost(postId, newScheduledFor);
        await loadAll();
      } catch { /* ignore */ }
    },
    [loadAll],
  );

  const handleRetry = useCallback(
    async (postId: string) => {
      try {
        await retryFailedPost(postId);
        await loadAll();
      } catch { /* ignore */ }
    },
    [loadAll],
  );

  const handleApprove = useCallback(
    async (postId: string) => {
      try {
        await approvePost(postId);
        closePostSheet();
        await loadAll();
      } catch { /* ignore */ }
    },
    [closePostSheet, loadAll],
  );

  const handleReject = useCallback(
    async (postId: string, feedback: string) => {
      try {
        await rejectPost(postId, feedback);
        closePostSheet();
        await loadAll();
      } catch { /* ignore */ }
    },
    [closePostSheet, loadAll],
  );

  // ── Loading guard ─────────────────────────────────────────────────────────────

  if (loadingWorkspace) {
    return (
      <SafeAreaView style={s.safeArea}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing["3xl"] }} />
      </SafeAreaView>
    );
  }

  const failedQueueItems = queueItems.filter((j) => j.post?.status === "failed");
  const referenceDate = new Date();

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.header}>
        <Text style={{ ...typography.h2, color: colors.textPrimary }}>Calendar</Text>
      </View>

      <AppTabs tabs={TABS} activeKey={activeTab} onChange={setActiveTab} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scrollContent}>
        {loading && (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
        )}

        {/* ── Day View ───────────────────────────────────────────────── */}
        {activeTab === "day" && (
          <DayView
            posts={scheduledPosts}
            referenceDate={referenceDate}
            onSelectPost={openPostSheet}
            onReschedule={handleRescheduleTime}
          />
        )}

        {/* ── Week View ──────────────────────────────────────────────── */}
        {activeTab === "week" && (
          <WeekView
            posts={scheduledPosts}
            referenceDate={referenceDate}
            onSelectPost={openPostSheet}
            onReschedule={handleReschedule}
          />
        )}

        {/* ── Month View ─────────────────────────────────────────────── */}
        {activeTab === "month" && (
          <View style={{ gap: spacing.lg }}>
            <View style={s.monthNav}>
              <Pressable onPress={prevMonth} style={s.navBtn} accessibilityLabel="Previous month">
                <Text style={{ ...typography.h2, color: colors.primary }}>‹</Text>
              </Pressable>
              <Text style={{ ...typography.h3, color: colors.textPrimary }}>
                {MONTH_NAMES[month]} {year}
              </Text>
              <Pressable onPress={nextMonth} style={s.navBtn} accessibilityLabel="Next month">
                <Text style={{ ...typography.h2, color: colors.primary }}>›</Text>
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
                <Text style={{ ...typography.caption, color: colors.textSecondary, textTransform: "uppercase" }}>
                  Scheduled this month
                </Text>
                <QueueList
                  items={monthQueueItems}
                  onRetry={handleRetry}
                  onPress={(postId: string) => {
                    const post = allPosts.find((p) => p.id === postId);
                    if (post) openPostSheet(post);
                  }}
                />
              </View>
            )}
          </View>
        )}

        {/* ── Queue View ─────────────────────────────────────────────── */}
        {activeTab === "queue" && (
          <View style={{ gap: spacing.sm }}>
            <Text style={{ ...typography.caption, color: colors.textSecondary, textTransform: "uppercase" }}>
              Upcoming posts
            </Text>
            <QueueList
              items={queueItems.filter((j) => j.status !== "failed")}
              onRetry={handleRetry}
              onPress={(postId: string) => {
                const post = allPosts.find((p) => p.id === postId);
                if (post) openPostSheet(post);
              }}
              emptyLabel="No posts queued yet."
            />
          </View>
        )}

        {/* ── Review View ───────────────────────────────────────────── */}
        {activeTab === "review" && (
          <View style={{ gap: spacing.sm }}>
            <Text style={{ ...typography.caption, color: colors.textSecondary, textTransform: "uppercase" }}>
              Awaiting review
            </Text>
            {reviewPosts.length === 0 ? (
              <View style={{ padding: spacing.xl, alignItems: "center", gap: spacing.sm }}>
                <Text style={{ ...typography.body, color: colors.textMuted }}>All caught up — no posts need review.</Text>
              </View>
            ) : (
              reviewPosts.map((post) => (
                <Pressable
                  key={post.id}
                  onPress={() => openPostSheet(post)}
                  accessibilityRole="button"
                  accessibilityLabel="Review post"
                  style={({ pressed }) => [s.reviewCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <View style={{
                      width: 8, height: 8, borderRadius: 4,
                      backgroundColor: post.platform === "instagram" ? "#E1306C" : "#E60023",
                    }} />
                    <Text style={{ ...typography.micro, color: colors.textMuted, textTransform: "uppercase", fontWeight: "600" }}>
                      {post.platform}
                    </Text>
                    <Text style={{ ...typography.micro, color: colors.textMuted }}>
                      · {new Date(post.created_at ?? "").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </Text>
                  </View>
                  <Text style={{ ...typography.body, color: colors.textPrimary }} numberOfLines={2}>
                    {post.caption ?? post.hook ?? "No content"}
                  </Text>
                  {post.title && (
                    <Text style={{ ...typography.caption, color: colors.textMuted }} numberOfLines={1}>
                      {post.title}
                    </Text>
                  )}
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end" }}>
                    <Text style={{ ...typography.micro, color: colors.secondary, fontWeight: "600" }}>Tap to review →</Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}

        {/* ── Failed View ────────────────────────────────────────────── */}
        {activeTab === "failed" && (
          <View style={{ gap: spacing.sm }}>
            <Text style={{ ...typography.caption, color: colors.textSecondary, textTransform: "uppercase" }}>
              Failed posts
            </Text>
            {failedQueueItems.length === 0 ? (
              <View style={{ padding: spacing.xl, alignItems: "center" }}>
                <Text style={{ ...typography.body, color: colors.textMuted }}>No failed posts.</Text>
              </View>
            ) : (
              <QueueList
                items={failedQueueItems}
                onRetry={handleRetry}
                onPress={(postId: string) => {
                  const post = allPosts.find((p) => p.id === postId);
                  if (post) openPostSheet(post);
                }}
              />
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Day Sheet (month date tap → post list) ──────────────────── */}
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
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg }}>
            <Text style={{ ...typography.h3, color: colors.textPrimary }}>{selectedDate ?? ""}</Text>
            <Pressable onPress={() => setSheetVisible(false)} accessibilityRole="button" accessibilityLabel="Close sheet">
              <Text style={{ ...typography.body, color: colors.secondary }}>Done</Text>
            </Pressable>
          </View>

          {daySheetPosts.length === 0 ? (
            <Text style={{ ...typography.body, color: colors.textMuted }}>No posts on this day.</Text>
          ) : (
            <ScrollView>
              {daySheetPosts.map((post) => (
                <Pressable
                  key={post.id}
                  style={s.sheetPost}
                  onPress={() => openPostSheet(post)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open post`}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <View style={{
                      width: 8, height: 8, borderRadius: 4,
                      backgroundColor: post.platform === "instagram" ? "#E1306C" : "#E60023",
                    }} />
                    <Text style={{ ...typography.micro, color: colors.textMuted, textTransform: "uppercase" }}>
                      {post.platform} ·{" "}
                      {post.scheduled_for
                        ? new Date(post.scheduled_for).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
                        : "—"}
                    </Text>
                  </View>
                  <Text style={{ ...typography.body, color: colors.textPrimary }} numberOfLines={2}>
                    {post.caption ?? post.hook ?? "No caption"}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* ── Post Detail Sheet ────────────────────────────────────────── */}
      <PostDetailSheet
        post={activePost}
        visible={postSheetVisible}
        onClose={closePostSheet}
        onEdit={handleEdit}
        onPublishNow={handlePublishNow}
        onDelete={handleDelete}
        onApprove={handleApprove}
        onReject={handleReject}
        onRetry={handleRetry}
      />
    </SafeAreaView>
  );
}

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
    reviewCard: {
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.lg,
      gap: spacing.sm,
    },
  });
}
