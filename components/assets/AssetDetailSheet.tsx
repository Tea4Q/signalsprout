import React from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { AppBadge, BadgeVariant } from "@/components/ui/AppBadge";
import type { AssetWithUsage } from "@/services/content/assetService";

type AssetType = "generated_image" | "uploaded_image" | "template_image";

const TYPE_BADGE: Record<AssetType, { label: string; variant: BadgeVariant }> = {
  generated_image: { label: "AI Generated", variant: "info" },
  uploaded_image: { label: "Uploaded", variant: "neutral" },
  template_image: { label: "Template", variant: "success" },
};

interface AssetDetailSheetProps {
  asset: AssetWithUsage | null;
  publicUrl: string | null;
  visible: boolean;
  onClose: () => void;
  onDelete: (assetId: string) => void;
  deleting: boolean;
}

export function AssetDetailSheet({
  asset,
  publicUrl,
  visible,
  onClose,
  onDelete,
  deleting,
}: AssetDetailSheetProps) {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  if (!asset || !publicUrl) return null;

  const typeKey = asset.type as AssetType;
  const badge = TYPE_BADGE[typeKey] ?? { label: asset.type, variant: "neutral" as BadgeVariant };

  const createdDate = new Date(asset.created_at).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const dimensions =
    asset.width && asset.height ? `${asset.width} × ${asset.height}` : null;

  const handleDeletePress = () => {
    Alert.alert(
      "Delete Asset",
      "This will permanently remove the asset and unlink it from any posts.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => onDelete(asset.id),
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={s.overlay}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <View style={[s.sheet, { backgroundColor: colors.surface }]}>
        <View style={[s.handle, { backgroundColor: colors.border }]} />

        {/* Header */}
        <View style={s.header}>
          <AppBadge label={badge.label} variant={badge.variant} />
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close sheet"
          >
            <Text style={{ ...typography.body, color: colors.secondary }}>
              Done
            </Text>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Image Preview */}
          <View style={s.imageWrapper}>
            <Image
              source={{ uri: publicUrl }}
              style={s.image}
              contentFit="contain"
              accessibilityLabel="Asset preview"
            />
          </View>

          {/* Metadata */}
          <View style={s.metaGrid}>
            {dimensions && (
              <View style={[s.metaCell, { backgroundColor: colors.surfaceAlt }]}>
                <MaterialIcons name="aspect-ratio" size={14} color={colors.textMuted} />
                <Text style={[s.metaLabel, { color: colors.textMuted }]}>Dimensions</Text>
                <Text style={[s.metaValue, { color: colors.textPrimary }]}>{dimensions}</Text>
              </View>
            )}
            <View style={[s.metaCell, { backgroundColor: colors.surfaceAlt }]}>
              <MaterialIcons name="calendar-today" size={14} color={colors.textMuted} />
              <Text style={[s.metaLabel, { color: colors.textMuted }]}>Created</Text>
              <Text style={[s.metaValue, { color: colors.textPrimary }]}>{createdDate}</Text>
            </View>
            <View style={[s.metaCell, { backgroundColor: colors.surfaceAlt }]}>
              <MaterialIcons name="post-add" size={14} color={colors.textMuted} />
              <Text style={[s.metaLabel, { color: colors.textMuted }]}>Used in Posts</Text>
              <Text style={[s.metaValue, { color: colors.textPrimary }]}>
                {asset.postCount} {asset.postCount === 1 ? "post" : "posts"}
              </Text>
            </View>
            {asset.mime_type && (
              <View style={[s.metaCell, { backgroundColor: colors.surfaceAlt }]}>
                <MaterialIcons name="image" size={14} color={colors.textMuted} />
                <Text style={[s.metaLabel, { color: colors.textMuted }]}>Format</Text>
                <Text style={[s.metaValue, { color: colors.textPrimary }]}>
                  {asset.mime_type.split("/")[1]?.toUpperCase() ?? asset.mime_type}
                </Text>
              </View>
            )}
          </View>

          {/* AI Prompt */}
          {asset.prompt_used && (
            <View style={s.promptSection}>
              <Text
                style={[
                  s.sectionLabel,
                  { color: colors.textMuted },
                ]}
              >
                AI PROMPT
              </Text>
              <View
                style={[
                  s.promptBox,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceAlt,
                  },
                ]}
              >
                <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                  {asset.prompt_used}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={[s.footer, { borderTopColor: colors.borderSoft, backgroundColor: colors.surface }]}>
          <Pressable
            onPress={handleDeletePress}
            disabled={deleting}
            style={({ pressed }) => [
              s.deleteBtn,
              {
                borderColor: colors.danger + "44",
                backgroundColor: colors.danger + "18",
                opacity: pressed || deleting ? 0.6 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Delete asset"
          >
            <MaterialIcons name="delete-outline" size={18} color={colors.danger} />
            <Text style={[s.deleteBtnLabel, { color: colors.danger }]}>
              {deleting ? "Deleting…" : "Delete Asset"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: Record<string, string>) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
    sheet: {
      borderTopLeftRadius: radius["2xl"],
      borderTopRightRadius: radius["2xl"],
      maxHeight: "88%",
      paddingTop: spacing.md,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      alignSelf: "center",
      marginBottom: spacing.md,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.lg,
    },
    imageWrapper: {
      marginHorizontal: spacing.xl,
      borderRadius: radius.lg,
      overflow: "hidden",
      backgroundColor: "#00000018",
      aspectRatio: 1,
    },
    image: { width: "100%", height: "100%" },
    metaGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      padding: spacing.xl,
    },
    metaCell: {
      width: "47%",
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.xs,
    },
    metaLabel: {
      ...typography.micro,
      fontWeight: "500",
    },
    metaValue: {
      ...typography.caption,
      fontWeight: "600",
    },
    promptSection: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xl,
      gap: spacing.md,
    },
    sectionLabel: {
      ...typography.micro,
      fontWeight: "600",
      letterSpacing: 0.8,
    },
    promptBox: {
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.md,
    },
    footer: {
      padding: spacing.xl,
      borderTopWidth: 1,
    },
    deleteBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1.5,
    },
    deleteBtnLabel: {
      ...typography.body,
      fontWeight: "600",
    },
  });
}
