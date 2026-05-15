import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { supabase } from "../../lib/supabase";
import { spacing, radius, typography } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";
import { AppBadge, BadgeVariant } from "../ui/AppBadge";
import { CreativePreview } from "../content/CreativePreview";
import { getPostAuditLog, type AuditLogEntry } from "../../services/scheduling/publishQueueService";
import type { Database } from "../../types/database";

type PostRow = Database["public"]["Tables"]["posts"]["Row"];
type PostStatus = Database["public"]["Enums"]["post_status"];

const STATUS_BADGE: Record<PostStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: "Draft", variant: "neutral" },
  ready_for_review: { label: "Needs Review", variant: "info" },
  approved: { label: "Approved", variant: "success" },
  scheduled: { label: "Scheduled", variant: "warning" },
  publishing: { label: "Publishing", variant: "info" },
  published: { label: "Published", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
  archived: { label: "Archived", variant: "neutral" },
};

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  pinterest: "Pinterest",
};

const PLATFORM_COLOR: Record<string, string> = {
  instagram: "#E1306C",
  pinterest: "#E60023",
};

interface PostAsset {
  id: string;
  file_path: string;
  mime_type: string | null;
  publicUrl: string;
}

export interface PostDetailSheetProps {
  post: PostRow | null;
  visible: boolean;
  onClose: () => void;
  onEdit: (postId: string) => void;
  onPublishNow: (postId: string) => void;
  onDelete: (postId: string) => void;
  onApprove?: (postId: string) => void;
  onReject?: (postId: string, feedback: string) => void;
  onRetry?: (postId: string) => void;
}


// ── Main Sheet ────────────────────────────────────────────────────────────────

export function PostDetailSheet({
  post,
  visible,
  onClose,
  onEdit,
  onPublishNow,
  onDelete,
  onApprove,
  onReject,
  onRetry,
}: PostDetailSheetProps) {
  const { colors } = useTheme();
  const [assets, setAssets] = useState<PostAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loadingAuditLog, setLoadingAuditLog] = useState(false);

  useEffect(() => {
    if (!post?.id || !visible) {
      setAssets([]);
      setShowRejectInput(false);
      setRejectNote("");
      setAuditLog([]);
      return;
    }
    if (post.status === "failed") {
      setLoadingAuditLog(true);
      getPostAuditLog(post.id)
        .then(setAuditLog)
        .catch(() => {})
        .finally(() => setLoadingAuditLog(false));
    }
    setLoadingAssets(true);
    (async () => {
      try {
        const { data } = await supabase
          .from("post_assets")
          .select("sort_order, assets(id, file_path, mime_type)")
          .eq("post_id", post.id)
          .order("sort_order");

        if (!data) return;
        const mapped: PostAsset[] = (
          data as ({
            sort_order: number;
            assets: { id: string; file_path: string; mime_type: string | null } | null;
          })[]
        )
          .filter((row) => row.assets != null)
          .map((row) => {
            const asset = row.assets!;
            const { data: urlData } = supabase.storage
              .from("assets")
              .getPublicUrl(asset.file_path);
            return {
              id: asset.id,
              file_path: asset.file_path,
              mime_type: asset.mime_type,
              publicUrl: urlData.publicUrl,
            };
          });
        setAssets(mapped);
      } finally {
        setLoadingAssets(false);
      }
    })();
  }, [post?.id, post?.status, visible]);

  if (!post) return null;

  const s = makeStyles(colors);
  const status = post.status as PostStatus;
  const badge = STATUS_BADGE[status] ?? { label: status, variant: "neutral" as BadgeVariant };
  const isReview = status === "ready_for_review";
  const isFailed = status === "failed";
  const platformColor = PLATFORM_COLOR[post.platform] ?? colors.primary;

  const createdDate = post.created_at
    ? new Date(post.created_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
  const scheduledDate = post.scheduled_for
    ? new Date(post.scheduled_for).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const publishedDate = post.published_at
    ? new Date(post.published_at).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const platformLabel = PLATFORM_LABEL[post.platform] ?? post.platform;

  const handleDeletePress = () => {
    Alert.alert("Delete Post", "This will permanently remove the post and its schedule.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete(post.id) },
    ]);
  };

  const handleSendFeedback = () => {
    if (!rejectNote.trim()) {
      Alert.alert("Add Feedback", "Please describe what needs to be changed.");
      return;
    }
    onReject?.(post.id, rejectNote.trim());
    setShowRejectInput(false);
    setRejectNote("");
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <View style={s.sheet}>
        <View style={s.handle} />

        {/* ── Header ───────────────────────────────────────────────── */}
        <View style={s.sheetHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 }}>
            <View style={[s.platformDot, { backgroundColor: platformColor }]} />
            <Text style={s.sheetTitle} numberOfLines={1}>
              {post.title ?? post.caption?.slice(0, 40) ?? "Post"}
            </Text>
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close sheet">
            <Text style={{ ...typography.body, color: colors.secondary }}>Done</Text>
          </Pressable>
        </View>

        {/* ── Review banner ─────────────────────────────────────────── */}
        {isReview && (
          <View style={[s.reviewBanner, { backgroundColor: colors.secondarySoft }]}>
            <MaterialIcons name="rate-review" size={15} color={colors.secondary} />
            <Text style={{ ...typography.caption, color: colors.secondary, flex: 1 }}>
              This post is awaiting your approval before it can be scheduled.
            </Text>
          </View>
        )}

        {/* ── Rejection feedback (draft) ────────────────────────────── */}
        {post.failure_reason && status === "draft" && (
          <View style={[s.rejectionBanner, { backgroundColor: colors.accentSoft, borderColor: colors.danger + "44" }]}>
            <MaterialIcons name="feedback" size={15} color={colors.danger} />
            <Text style={{ ...typography.caption, color: colors.danger, flex: 1 }}>
              Feedback: {post.failure_reason}
            </Text>
          </View>
        )}

        {/* ── Publish failure banner ───────────────────────────────── */}
        {isFailed && (
          <View style={[s.rejectionBanner, { backgroundColor: colors.accentSoft, borderColor: colors.danger + "44" }]}>
            <MaterialIcons name="error-outline" size={15} color={colors.danger} />
            <Text style={{ ...typography.caption, color: colors.danger, flex: 1 }}>
              {post.failure_reason ?? "This post failed to publish."}
            </Text>
          </View>
        )}

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>

          {/* ── Creative Preview ─────────────────────────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>PREVIEW</Text>
            <CreativePreview
              publicUrl={assets[0]?.publicUrl ?? null}
              platform={post.platform as "instagram" | "pinterest" | "facebook" | "tiktok"}
              loading={loadingAssets}
              caption={post.caption ?? undefined}
              hashtags={post.hashtags ?? undefined}
            />
          </View>

          {/* ── Content Preview ──────────────────────────────────────── */}
          {(post.caption || post.hook) && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>CONTENT</Text>
              {post.hook && (
                <View style={[s.contentBox, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
                  <Text style={{ ...typography.micro, color: colors.textMuted, marginBottom: spacing.xs, fontWeight: "600" }}>
                    HOOK
                  </Text>
                  <Text style={{ ...typography.body, color: colors.textPrimary }}>{post.hook}</Text>
                </View>
              )}
              {post.caption && (
                <View style={[s.contentBox, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
                  <Text style={{ ...typography.micro, color: colors.textMuted, marginBottom: spacing.xs, fontWeight: "600" }}>
                    CAPTION
                  </Text>
                  <Text style={{ ...typography.body, color: colors.textPrimary }}>{post.caption}</Text>
                </View>
              )}
              {post.hashtags && post.hashtags.length > 0 && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                  {post.hashtags.slice(0, 12).map((tag) => (
                    <View key={tag} style={[s.hashtagChip, { backgroundColor: colors.primarySoft }]}>
                      <Text style={{ ...typography.micro, color: colors.primary }}>#{tag}</Text>
                    </View>
                  ))}
                  {post.hashtags.length > 12 && (
                    <Text style={{ ...typography.micro, color: colors.textMuted, alignSelf: "center" }}>
                      +{post.hashtags.length - 12} more
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}

          {/* ── Error log (failed posts) ──────────────────────────────── */}
          {isFailed && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>ERROR LOG</Text>
              {loadingAuditLog ? (
                <ActivityIndicator color={colors.danger} style={{ marginVertical: spacing.md }} />
              ) : auditLog.length === 0 ? (
                <Text style={{ ...typography.caption, color: colors.textMuted }}>No log entries found.</Text>
              ) : (
                auditLog.map((entry) => {
                  const meta = entry.metadata as Record<string, unknown>;
                  const errorMsg = typeof meta.error === "string" ? meta.error : null;
                  const attempt = typeof meta.attempt === "number" ? meta.attempt : null;
                  const isPublished = entry.action === "post.published";
                  const entryTime = new Date(entry.created_at).toLocaleString(undefined, {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                  });
                  return (
                    <View
                      key={entry.id}
                      style={[s.logEntry, { borderColor: isPublished ? colors.success : colors.danger + "55", backgroundColor: colors.surfaceAlt }]}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: 2 }}>
                        <MaterialIcons
                          name={isPublished ? "check-circle" : "error-outline"}
                          size={13}
                          color={isPublished ? colors.success : colors.danger}
                        />
                        <Text style={{ ...typography.micro, color: colors.textMuted }}>
                          {entryTime}{attempt != null ? ` · Attempt ${attempt}` : ""}
                        </Text>
                      </View>
                      {errorMsg && (
                        <Text style={{ ...typography.micro, color: colors.danger }}>
                          {errorMsg}
                        </Text>
                      )}
                      {isPublished && (
                        <Text style={{ ...typography.micro, color: colors.success }}>Published successfully</Text>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* ── Details 2×2 Grid ─────────────────────────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>DETAILS</Text>
            <View style={s.detailsGrid}>
              <View style={[s.detailCard, { backgroundColor: colors.surfaceAlt }]}>
                <MaterialIcons name="calendar-today" size={14} color={colors.textMuted} />
                <Text style={s.detailLabel}>Created</Text>
                <Text style={s.detailValue} numberOfLines={1}>{createdDate}</Text>
              </View>
              <View style={[s.detailCard, { backgroundColor: colors.surfaceAlt }]}>
                <MaterialIcons name="flag" size={14} color={colors.textMuted} />
                <Text style={s.detailLabel}>Status</Text>
                <AppBadge label={badge.label} variant={badge.variant} />
              </View>
              <View style={[s.detailCard, { backgroundColor: colors.surfaceAlt }]}>
                <MaterialIcons name="devices" size={14} color={colors.textMuted} />
                <Text style={s.detailLabel}>Platform</Text>
                <Text style={s.detailValue} numberOfLines={1}>{platformLabel}</Text>
              </View>
              <View style={[s.detailCard, { backgroundColor: colors.surfaceAlt }]}>
                <MaterialIcons name="collections" size={14} color={colors.textMuted} />
                <Text style={s.detailLabel}>Media</Text>
                <Text style={s.detailValue}>
                  {loadingAssets ? "…" : `${assets.length} file${assets.length !== 1 ? "s" : ""}`}
                </Text>
              </View>
              {scheduledDate && (
                <View style={[s.detailCard, { backgroundColor: colors.surfaceAlt, width: "100%" }]}>
                  <MaterialIcons name="schedule" size={14} color={colors.textMuted} />
                  <Text style={s.detailLabel}>Scheduled For</Text>
                  <Text style={s.detailValue}>{scheduledDate}</Text>
                </View>
              )}
              {publishedDate && (
                <View style={[s.detailCard, { backgroundColor: colors.surfaceAlt, width: "100%" }]}>
                  <MaterialIcons name="check-circle" size={14} color={colors.success} />
                  <Text style={s.detailLabel}>Published At</Text>
                  <Text style={[s.detailValue, { color: colors.success }]}>{publishedDate}</Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        {/* ── Footer ───────────────────────────────────────────────── */}
        {isReview && onApprove ? (
          showRejectInput ? (
            /* Rejection feedback input */
            <View style={[s.footer, { flexDirection: "column", gap: spacing.md }]}>
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                Describe what needs to change:
              </Text>
              <TextInput
                value={rejectNote}
                onChangeText={setRejectNote}
                placeholder="e.g. Rephrase the hook, fix typo in line 2…"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                style={[s.rejectInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surfaceAlt }]}
                autoFocus
              />
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Pressable
                  style={({ pressed }) => [s.editBtn, { flex: 1 }, pressed && { opacity: 0.75 }]}
                  onPress={() => { setShowRejectInput(false); setRejectNote(""); }}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel feedback"
                >
                  <Text style={s.editBtnLabel}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [s.rejectConfirmBtn, { flex: 2 }, pressed && { opacity: 0.85 }]}
                  onPress={handleSendFeedback}
                  accessibilityRole="button"
                  accessibilityLabel="Send feedback"
                >
                  <MaterialIcons name="send" size={15} color="#FFFFFF" />
                  <Text style={s.publishBtnLabel}>Send Feedback</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            /* Review footer: Request Changes + Approve + Delete */
            <View style={s.footer}>
              <Pressable
                style={({ pressed }) => [s.editBtn, pressed && { opacity: 0.75 }]}
                onPress={() => setShowRejectInput(true)}
                accessibilityRole="button"
                accessibilityLabel="Request changes"
              >
                <MaterialIcons name="undo" size={16} color={colors.textPrimary} />
                <Text style={s.editBtnLabel}>Changes</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [s.approveBtn, pressed && { opacity: 0.85 }]}
                onPress={() => onApprove(post.id)}
                accessibilityRole="button"
                accessibilityLabel="Approve post"
              >
                <MaterialIcons name="check-circle" size={16} color="#FFFFFF" />
                <Text style={s.publishBtnLabel}>Approve</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [s.deleteBtn, pressed && { opacity: 0.7 }]}
                onPress={handleDeletePress}
                accessibilityRole="button"
                accessibilityLabel="Delete post"
              >
                <MaterialIcons name="delete-outline" size={20} color={colors.danger} />
              </Pressable>
            </View>
          )
        ) : isFailed ? (
          /* Failed footer: Retry + Edit + Delete */
          <View style={s.footer}>
            <Pressable
              style={({ pressed }) => [s.editBtn, pressed && { opacity: 0.75 }]}
              onPress={() => onEdit(post.id)}
              accessibilityRole="button"
              accessibilityLabel="Edit post"
            >
              <MaterialIcons name="edit" size={16} color={colors.textPrimary} />
              <Text style={s.editBtnLabel}>Edit</Text>
            </Pressable>
            {onRetry && (
              <Pressable
                style={({ pressed }) => [s.publishBtn, { backgroundColor: colors.danger }, pressed && { opacity: 0.85 }]}
                onPress={() => onRetry(post.id)}
                accessibilityRole="button"
                accessibilityLabel="Retry publishing post"
              >
                <MaterialIcons name="replay" size={15} color="#FFFFFF" />
                <Text style={s.publishBtnLabel}>Retry</Text>
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [s.deleteBtn, pressed && { opacity: 0.7 }]}
              onPress={handleDeletePress}
              accessibilityRole="button"
              accessibilityLabel="Delete post"
            >
              <MaterialIcons name="delete-outline" size={20} color={colors.danger} />
            </Pressable>
          </View>
        ) : (
          /* Normal footer: Edit + Publish Now + Delete */
          <View style={s.footer}>
            <Pressable
              style={({ pressed }) => [s.editBtn, pressed && { opacity: 0.75 }]}
              onPress={() => onEdit(post.id)}
              accessibilityRole="button"
              accessibilityLabel="Edit post"
            >
              <MaterialIcons name="edit" size={16} color={colors.textPrimary} />
              <Text style={s.editBtnLabel}>Edit</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [s.publishBtn, pressed && { opacity: 0.85 }]}
              onPress={() => onPublishNow(post.id)}
              accessibilityRole="button"
              accessibilityLabel="Publish now"
            >
              <MaterialIcons name="send" size={15} color="#FFFFFF" />
              <Text style={s.publishBtnLabel}>Publish Now</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [s.deleteBtn, pressed && { opacity: 0.7 }]}
              onPress={handleDeletePress}
              accessibilityRole="button"
              accessibilityLabel="Delete post"
            >
              <MaterialIcons name="delete-outline" size={20} color={colors.danger} />
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

// colors is a dynamic token map with no explicit type
function makeStyles(colors: Record<string, string>) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius["2xl"],
      borderTopRightRadius: radius["2xl"],
      maxHeight: "90%",
      paddingTop: spacing.md,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: "center",
      marginBottom: spacing.md,
    },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
    },
    sheetTitle: {
      ...typography.h3,
      color: colors.textPrimary,
      flex: 1,
      marginRight: spacing.md,
    } as object,
    platformDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      flexShrink: 0,
    },
    reviewBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
    },
    rejectionBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderBottomWidth: 1,
    },
    section: { padding: spacing.xl, gap: spacing.md },
    sectionLabel: {
      ...typography.micro,
      color: colors.textMuted,
      fontWeight: "600",
      letterSpacing: 0.8,
    } as object,
    contentBox: {
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.md,
    },
    hashtagChip: {
      borderRadius: 999,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
    },
    detailsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    detailCard: {
      width: "48%",
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.xs,
    },
    detailLabel: {
      ...typography.micro,
      color: colors.textMuted,
      fontWeight: "500",
    } as object,
    detailValue: {
      ...typography.caption,
      color: colors.textPrimary,
      fontWeight: "600",
    } as object,
    footer: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      padding: spacing.xl,
      borderTopWidth: 1,
      borderTopColor: colors.borderSoft,
      backgroundColor: colors.surface,
    },
    editBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    editBtnLabel: {
      ...typography.body,
      fontWeight: "500",
      color: colors.textPrimary,
    } as object,
    publishBtn: {
      flex: 2,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.accent,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.45,
      shadowRadius: 10,
      elevation: 6,
    },
    approveBtn: {
      flex: 2,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.45,
      shadowRadius: 10,
      elevation: 6,
    },
    rejectConfirmBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.warning,
      shadowColor: colors.warning,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 4,
    },
    publishBtnLabel: {
      ...typography.body,
      fontWeight: "700",
      color: "#FFFFFF",
    } as object,
    deleteBtn: {
      width: 44,
      height: 44,
      borderRadius: radius.lg,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: colors.danger + "44",
      backgroundColor: colors.danger + "18",
    },
    rejectInput: {
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.md,
      fontSize: 14,
      minHeight: 72,
      textAlignVertical: "top",
    },
    logEntry: {
      borderRadius: radius.md,
      borderWidth: 1,
      padding: spacing.md,
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
  });
}
