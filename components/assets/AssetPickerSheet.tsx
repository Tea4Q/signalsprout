import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { getAssets, getAssetPublicUrl } from "@/services/content/assetService";
import type { GeneratedImage } from "@/services/content/imageGenerationService";
import type { Database } from "@/types/database";

type AssetRow = Database["public"]["Tables"]["assets"]["Row"];

interface AssetPickerSheetProps {
  visible: boolean;
  workspaceId: string;
  onClose: () => void;
  /** Called with a GeneratedImage-compatible object when the user taps an asset. */
  onSelect: (image: GeneratedImage) => void;
}

const NUM_COLUMNS = 3;

export function AssetPickerSheet({
  visible,
  workspaceId,
  onClose,
  onSelect,
}: AssetPickerSheetProps) {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const all = await getAssets(workspaceId);
      // Only show AI-generated images
      setAssets(all.filter((a) => a.type === "generated_image"));
    } catch {
      // silently fail — user sees empty state
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const handleSelect = (asset: AssetRow) => {
    const publicUrl = getAssetPublicUrl(asset.file_path);
    onSelect({
      asset_id: asset.id,
      file_path: asset.file_path,
      public_url: publicUrl,
      width: asset.width ?? 0,
      height: asset.height ?? 0,
      revised_prompt: asset.prompt_used ?? "",
    });
    onClose();
  };

  const renderItem = ({ item }: { item: AssetRow }) => {
    const url = getAssetPublicUrl(item.file_path);
    return (
      <Pressable
        onPress={() => handleSelect(item)}
        style={({ pressed }) => [s.cell, { opacity: pressed ? 0.75 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel="Select image"
      >
        <Image
          source={{ uri: url }}
          style={s.cellImage}
          contentFit="cover"
        />
        {item.prompt_used ? (
          <View style={[s.promptOverlay, { backgroundColor: colors.background + "CC" }]}>
            <Text
              style={{ ...typography.micro, color: colors.textSecondary }}
              numberOfLines={2}
            >
              {item.prompt_used}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={s.overlay} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <View style={[s.sheet, { backgroundColor: colors.surface }]}>
        <View style={[s.handle, { backgroundColor: colors.border }]} />

        {/* Header */}
        <View style={[s.header, { borderBottomColor: colors.borderSoft }]}>
          <Text style={{ ...typography.h3, color: colors.textPrimary }}>
            Choose from Library
          </Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={{ ...typography.body, color: colors.secondary }}>Cancel</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator
            color={colors.primary}
            style={{ marginTop: spacing["3xl"] }}
          />
        ) : assets.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ ...typography.body, color: colors.textMuted, textAlign: "center" }}>
              No AI-generated images yet.{"\n"}Generate an image in the next step to build your library.
            </Text>
          </View>
        ) : (
          <FlatList
            data={assets}
            keyExtractor={(a) => a.id}
            renderItem={renderItem}
            numColumns={NUM_COLUMNS}
            contentContainerStyle={s.grid}
            columnWrapperStyle={{ gap: spacing.xs }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeStyles(colors: any) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    sheet: {
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      maxHeight: "75%",
      paddingBottom: spacing["2xl"],
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      alignSelf: "center",
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
    },
    grid: {
      padding: spacing.md,
      gap: spacing.xs,
    },
    cell: {
      flex: 1,
      aspectRatio: 1,
      borderRadius: radius.md,
      overflow: "hidden",
      backgroundColor: colors.surfaceAlt,
    },
    cellImage: {
      width: "100%",
      height: "100%",
    },
    promptOverlay: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      padding: spacing.xs,
    },
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing["3xl"],
    },
  });
}
