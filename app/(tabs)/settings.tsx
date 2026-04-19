import { AppBadge } from "@/components/ui/AppBadge";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { AppInput } from "@/components/ui/AppInput";
import { AppModal } from "@/components/ui/AppModal";
import { spacing, radius, typography } from "@/constants/theme";
import { useWorkspace, canManageMembers } from "@/context/workspace-context";
import { useThemePreference, type ThemePreference } from "@/context/theme-context";
import { useTheme } from "@/hooks/use-theme";
import { maskSecret } from "@/lib/crypto";
import { getAuditLog } from "@/services/security/auditLogService";
import {
  deleteCredential,
  getRotationAlerts,
  listCredentials,
  rotateCredential,
  type CredentialMeta,
} from "@/services/security/credentialVaultService";
import {
  getWorkspaceMembers,
  inviteMember,
  removeMember,
  type WorkspaceMember,
} from "@/services/workspace/memberService";
import { signOut } from "@/services/auth/authService";
import type { Database } from "@/types/database";
import Constants from "expo-constants";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Clipboard,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type AuditLogRow = Database["public"]["Tables"]["audit_logs"]["Row"];

// ─── Helpers ────────────────────────────────────────────────────────────────

function daysUntil(isoDate: string): number {
  const now = Date.now();
  const due = new Date(isoDate).getTime();
  return Math.ceil((due - now) / (1000 * 60 * 60 * 24));
}

function rotationLabel(credential: CredentialMeta): string | null {
  if (!credential.rotation_due_at) return null;
  const days = daysUntil(credential.rotation_due_at);
  if (days < 0) return "Overdue";
  if (days === 0) return "Due today";
  return `Rotate in ${days}d`;
}

function rotationBadgeVariant(
  credential: CredentialMeta,
): "danger" | "warning" | "info" {
  if (!credential.rotation_due_at) return "info";
  const days = daysUntil(credential.rotation_due_at);
  if (days <= 0) return "danger";
  if (days <= 3) return "warning";
  return "info";
}

function formatActionLabel(action: string): string {
  return action.replace(/_/g, " ");
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function SectionHeader({
  title,
  colors,
}: {
  title: string;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <Text
      style={{
        ...typography.caption,
        color: colors.textSecondary,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        fontWeight: "700",
        marginBottom: spacing.sm,
      }}
    >
      {title}
    </Text>
  );
}

function CredentialRow({
  credential,
  colors,
  onAction,
}: {
  credential: CredentialMeta;
  colors: ReturnType<typeof useTheme>["colors"];
  onAction: (credential: CredentialMeta) => void;
}) {
  const label = rotationLabel(credential);
  const variant = rotationBadgeVariant(credential);

  return (
    <Pressable
      onPress={() => onAction(credential)}
      style={({ pressed }) => [
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.lg,
          gap: spacing.xs,
        },
        pressed && { opacity: 0.82 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${credential.name} credential options`}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
      >
        <Text
          style={{
            ...typography.body,
            color: colors.textPrimary,
            fontWeight: "600",
            flex: 1,
          }}
          numberOfLines={1}
        >
          {credential.name}
        </Text>
        {label && <AppBadge label={label} variant={variant} />}
      </View>
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <Text style={{ ...typography.caption, color: colors.textMuted }}>
          {credential.service.toUpperCase()}
        </Text>
        <Text style={{ ...typography.caption, color: colors.textMuted }}>
          {credential.environment}
        </Text>
      </View>
      <Text
        style={{
          ...typography.caption,
          color: colors.textMuted,
          fontFamily: "monospace",
        }}
      >
        {maskSecret("sk-placeholder")}
      </Text>
    </Pressable>
  );
}

function AuditRow({
  entry,
  colors,
}: {
  entry: AuditLogRow;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  const meta = (entry.metadata as Record<string, string>) ?? {};
  return (
    <View
      style={{
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: 2,
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
      >
        <Text
          style={{
            ...typography.caption,
            color: colors.textPrimary,
            fontWeight: "600",
            flex: 1,
          }}
          numberOfLines={1}
        >
          {formatActionLabel(entry.action)}
        </Text>
        <Text style={{ ...typography.micro, color: colors.textMuted }}>
          {formatTimestamp(entry.created_at)}
        </Text>
      </View>
      {(meta.name || meta.service) && (
        <Text
          style={{ ...typography.micro, color: colors.textSecondary }}
          numberOfLines={1}
        >
          {[meta.name, meta.service, meta.environment]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      )}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { themePreference, setThemePreference } = useThemePreference();
  const { workspace, workspaceId, role } = useWorkspace();

  const [credentials, setCredentials] = useState<CredentialMeta[]>([]);
  const [alerts, setAlerts] = useState<CredentialMeta[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditLogRow[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Members
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviteLoading, setInviteLoading] = useState(false);

  const PAGE_SIZE = 10;

  useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    Promise.all([
      listCredentials(workspaceId),
      getRotationAlerts(workspaceId),
    ])
      .then(([creds, alertCreds]) => {
        setCredentials(creds);
        setAlerts(alertCreds);
      })
      .catch((e) => console.warn("Failed to load credentials:", e))
      .finally(() => setLoading(false));
  }, [workspaceId, refreshKey]);

  useEffect(() => {
    if (!workspaceId) return;
    setAuditLoading(true);
    getAuditLog(workspaceId, {
      entity_type: "credential_vault",
      page: auditPage,
      pageSize: PAGE_SIZE,
    })
      .then(({ entries, total }) => {
        setAuditEntries((prev) =>
          auditPage === 1 ? entries : [...prev, ...entries],
        );
        setAuditTotal(total);
      })
      .catch((e) => console.warn("Failed to load audit log:", e))
      .finally(() => setAuditLoading(false));
  }, [workspaceId, auditPage, refreshKey]);

  const refresh = useCallback(() => {
    setAuditPage(1);
    setRefreshKey((k) => k + 1);
  }, []);

  // Load members
  useEffect(() => {
    if (!workspaceId) return;
    setMembersLoading(true);
    getWorkspaceMembers(workspaceId)
      .then(setMembers)
      .catch((e) => console.warn("Failed to load members:", e))
      .finally(() => setMembersLoading(false));
  }, [workspaceId, refreshKey]);

  async function handleInvite() {
    if (!workspaceId || !inviteEmail.trim()) return;
    setInviteLoading(true);
    try {
      await inviteMember(workspaceId, inviteEmail.trim(), inviteRole);
      setInviteEmail("");
      setInviteModalOpen(false);
      refresh();
    } catch (e) {
      Alert.alert(
        "Invite failed",
        e instanceof Error ? e.message : "Could not send invitation.",
      );
    } finally {
      setInviteLoading(false);
    }
  }

  function handleRemoveMember(member: WorkspaceMember) {
    if (!workspaceId) return;
    Alert.alert(
      "Remove member",
      `Remove ${member.user_id.slice(0, 8)}… from this workspace?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await removeMember(workspaceId, member.user_id);
              refresh();
            } catch (e) {
              Alert.alert(
                "Error",
                e instanceof Error ? e.message : "Failed to remove member.",
              );
            }
          },
        },
      ],
    );
  }

  function handleAddCredential() {
    router.push("/modals/add-credential");
  }

  function handleSignOut() {
    signOut()
      .catch(() => {})
      .finally(() => router.replace("/(auth)/sign-in"));
  }

  function handleCredentialAction(credential: CredentialMeta) {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Rotate", "Delete", "Cancel"],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 2,
          title: credential.name,
        },
        (index) => {
          if (index === 0) promptRotate(credential);
          if (index === 1) confirmDelete(credential);
        },
      );
    } else {
      Alert.alert(credential.name, "Choose an action", [
        { text: "Rotate", onPress: () => promptRotate(credential) },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => confirmDelete(credential),
        },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }

  function promptRotate(credential: CredentialMeta) {
    Alert.prompt(
      "Rotate Credential",
      `Enter the new secret value for "${credential.name}":`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Rotate",
          onPress: async (newValue: string | undefined) => {
            if (!newValue?.trim()) return;
            try {
              await rotateCredential(credential.id, newValue.trim());
              refresh();
            } catch (e) {
              Alert.alert(
                "Error",
                e instanceof Error
                  ? e.message
                  : "Failed to rotate credential.",
              );
            }
          },
        },
      ],
      "secure-text",
    );
  }

  function confirmDelete(credential: CredentialMeta) {
    Alert.alert(
      "Delete Credential",
      `Are you sure you want to delete "${credential.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCredential(credential.id);
              refresh();
            } catch (e) {
              Alert.alert(
                "Error",
                e instanceof Error
                  ? e.message
                  : "Failed to delete credential.",
              );
            }
          },
        },
      ],
    );
  }

  const hasMoreAudit = auditEntries.length < auditTotal;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing["2xl"] }}
      >
        {/* Page title */}
        <View>
          <Text style={{ ...typography.h2, color: colors.textPrimary }}>
            Settings
          </Text>
        </View>

        {/* ── Appearance ──────────────────────────────────────────── */}
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title="Appearance" colors={colors} />
          <AppCard padding="md">
            <View
              style={{
                flexDirection: "row",
                backgroundColor: colors.surfaceAlt,
                borderRadius: radius.md,
                padding: 4,
                gap: 4,
              }}
            >
              {(["light", "dark", "system"] as ThemePreference[]).map((pref) => {
                const active = themePreference === pref;
                return (
                  <Pressable
                    key={pref}
                    onPress={() => setThemePreference(pref)}
                    accessibilityRole="button"
                    accessibilityLabel={`${pref} theme`}
                    accessibilityState={{ selected: active }}
                    style={{
                      flex: 1,
                      paddingVertical: spacing.sm,
                      borderRadius: radius.sm,
                      alignItems: "center",
                      backgroundColor: active ? colors.surface : "transparent",
                      borderWidth: active ? 1 : 0,
                      borderColor: active ? colors.border : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        ...typography.caption,
                        color: active ? colors.textPrimary : colors.textMuted,
                        fontWeight: active ? "600" : "400",
                        textTransform: "capitalize",
                      }}
                    >
                      {pref === "light" ? "☀\uFE0E Light" : pref === "dark" ? "🌙 Dark" : "⚙ System"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </AppCard>
        </View>

        {/* ── Workspace Info ───────────────────────────────────────── */}
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title="Workspace" colors={colors} />
          <AppCard padding="md">
            <View style={{ gap: spacing.xs }}>
              <Text
                style={{
                  ...typography.body,
                  color: colors.textPrimary,
                  fontWeight: "600",
                }}
              >
                {workspace?.name ?? "—"}
              </Text>
              <Text
                style={{ ...typography.caption, color: colors.textMuted }}
              >
                Slug: {workspace?.slug ?? "—"}
              </Text>
              <Text
                style={{ ...typography.micro, color: colors.textMuted }}
              >
                ID: {workspace?.id ?? "—"}
              </Text>
            </View>
          </AppCard>
        </View>

        {/* ── Team Members ─────────────────────────────────────────── */}
        <View style={{ gap: spacing.sm }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <SectionHeader title="Team Members" colors={colors} />
            {canManageMembers(role) && (
              <Pressable
                onPress={() => setInviteModalOpen(true)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Invite member"
              >
                <Text
                  style={{
                    ...typography.caption,
                    color: colors.primary,
                    fontWeight: "700",
                  }}
                >
                  + Invite
                </Text>
              </Pressable>
            )}
          </View>

          {membersLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <View style={{ gap: spacing.xs }}>
              {members.map((m) => (
                <AppCard key={m.id} padding="md">
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          ...typography.caption,
                          color: colors.textPrimary,
                          fontFamily: "monospace",
                        }}
                        numberOfLines={1}
                      >
                        {m.user_id.slice(0, 8)}…
                      </Text>
                    </View>
                    <AppBadge label={m.role} variant="neutral" />
                    {canManageMembers(role) && m.role !== "owner" && (
                      <Pressable
                        onPress={() => handleRemoveMember(m)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Remove member"
                      >
                        <Text
                          style={{
                            ...typography.caption,
                            color: colors.danger,
                          }}
                        >
                          Remove
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </AppCard>
              ))}
            </View>
          )}
        </View>

        {/* Invite modal */}
        <AppModal
          visible={inviteModalOpen}
          onClose={() => setInviteModalOpen(false)}
          title="Invite team member"
        >
          <View style={{ gap: spacing.lg }}>
            <AppInput
              label="Email address"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="colleague@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {(["editor", "viewer"] as const).map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setInviteRole(r)}
                  style={({ pressed }) => ({
                    flex: 1,
                    padding: spacing.md,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor:
                      inviteRole === r ? colors.primary : colors.border,
                    backgroundColor:
                      inviteRole === r
                        ? colors.primarySoft
                        : pressed
                          ? colors.surfaceAlt
                          : colors.surface,
                    alignItems: "center",
                  })}
                  accessibilityRole="button"
                  accessibilityLabel={`Set role to ${r}`}
                >
                  <Text
                    style={{
                      ...typography.caption,
                      color:
                        inviteRole === r ? colors.primary : colors.textSecondary,
                      fontWeight: inviteRole === r ? "700" : "400",
                      textTransform: "capitalize",
                    }}
                  >
                    {r}
                  </Text>
                </Pressable>
              ))}
            </View>
            <AppButton
              label="Send Invite"
              onPress={handleInvite}
              loading={inviteLoading}
              disabled={!inviteEmail.trim()}
            />
          </View>
        </AppModal>

        {/* ── Rotation Alerts ──────────────────────────────────────── */}
        {alerts.length > 0 && (
          <View style={{ gap: spacing.sm }}>
            <SectionHeader title="⚠ Rotation Alerts" colors={colors} />
            {alerts.map((a) => {
              const days = a.rotation_due_at
                ? daysUntil(a.rotation_due_at)
                : null;
              return (
                <AppCard key={a.id} padding="md">
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          ...typography.body,
                          color: colors.textPrimary,
                          fontWeight: "600",
                        }}
                      >
                        {a.name}
                      </Text>
                      <Text
                        style={{
                          ...typography.caption,
                          color: colors.textMuted,
                        }}
                      >
                        {a.service} · {a.environment}
                      </Text>
                    </View>
                    <AppBadge
                      label={
                        days !== null && days <= 0
                          ? "Overdue"
                          : `Rotate in ${days}d`
                      }
                      variant={
                        days !== null && days <= 0 ? "danger" : "warning"
                      }
                    />
                  </View>
                </AppCard>
              );
            })}
          </View>
        )}

        {/* ── Security Vault ───────────────────────────────────────── */}
        <View style={{ gap: spacing.sm }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <SectionHeader title="Security Vault" colors={colors} />
            <Pressable
              onPress={handleAddCredential}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Add credential"
            >
              <Text
                style={{
                  ...typography.caption,
                  color: colors.primary,
                  fontWeight: "700",
                }}
              >
                + Add
              </Text>
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : credentials.length === 0 ? (
            <AppCard>
              <Text
                style={{
                  ...typography.body,
                  color: colors.textMuted,
                  textAlign: "center",
                }}
              >
                No credentials stored yet.
              </Text>
            </AppCard>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {credentials.map((c) => (
                <CredentialRow
                  key={c.id}
                  credential={c}
                  colors={colors}
                  onAction={handleCredentialAction}
                />
              ))}
            </View>
          )}
        </View>

        {/* ── App Signing Metadata ─────────────────────────────────── */}
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title="App Signing Metadata" colors={colors} />
          {(() => {
            const signingEntries = credentials.filter(
              (c) =>
                typeof c.key_metadata === "object" &&
                c.key_metadata !== null &&
                !!(c.key_metadata as Record<string, unknown>)["signing"],
            );
            return signingEntries.length === 0 ? (
              <AppCard>
                <Text
                  style={{
                    ...typography.body,
                    color: colors.textMuted,
                    textAlign: "center",
                  }}
                >
                  No signing metadata entries.
                </Text>
              </AppCard>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {signingEntries.map((c) => (
                  <AppCard key={c.id} padding="md">
                    <Text
                      style={{
                        ...typography.body,
                        color: colors.textPrimary,
                        fontWeight: "600",
                      }}
                    >
                      {c.name}
                    </Text>
                    <Text
                      style={{
                        ...typography.caption,
                        color: colors.textMuted,
                      }}
                    >
                      {c.service} · {c.environment}
                    </Text>
                  </AppCard>
                ))}
              </View>
            );
          })()}
        </View>

        {/* ── Audit Log ────────────────────────────────────────────── */}
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title="Audit Log" colors={colors} />
          <AppCard padding="md">
            {auditEntries.length === 0 && !auditLoading ? (
              <Text
                style={{
                  ...typography.body,
                  color: colors.textMuted,
                  textAlign: "center",
                }}
              >
                No audit events recorded.
              </Text>
            ) : (
              <>
                {auditEntries.map((entry) => (
                  <AuditRow key={entry.id} entry={entry} colors={colors} />
                ))}
                {auditLoading && (
                  <ActivityIndicator
                    color={colors.primary}
                    style={{ marginTop: spacing.md }}
                  />
                )}
                {hasMoreAudit && !auditLoading && (
                  <Pressable
                    onPress={() => setAuditPage((p) => p + 1)}
                    style={{ marginTop: spacing.md, alignItems: "center" }}
                    accessibilityRole="button"
                    accessibilityLabel="Load more audit entries"
                  >
                    <Text
                      style={{
                        ...typography.caption,
                        color: colors.secondary,
                      }}
                    >
                      Load more
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </AppCard>
        </View>

        {/* ── Sign Out ─────────────────────────────────────────────── */}
        <View style={{ gap: spacing.md, paddingBottom: spacing["3xl"] }}>
          <AppButton
            label="Sign Out"
            onPress={handleSignOut}
            variant="destructive"
          />
          <Text
            style={{
              ...typography.micro,
              color: colors.textMuted,
              textAlign: "center",
            }}
          >
            SignalSprout v{Constants.expoConfig?.version ?? "1.0.0"}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
