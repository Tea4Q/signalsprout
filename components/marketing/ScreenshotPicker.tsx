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

interface ScreenshotPickerProps {
  visible: boolean;
  workspaceId: string;
  onClose: () => void;
  onSelect: (image: GeneratedImage) => void;
}

const NUM_COLUMNS = 3;

export function ScreenshotPicker({ visible, workspaceId, onClose, onSelect }: ScreenshotPickerProps) {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const all = await getAssets(workspaceId);
      setAssets(all.filter((asset) => asset.type === "uploaded_image"));
    } catch {
      // silently fail — picker will render empty state
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
        accessibilityLabel="Select screenshot"
      >
        <Image source={{ uri: url }} style={s.cellImage} contentFit="cover" />
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <View style={[s.sheet, { backgroundColor: colors.surface }]}>
        <View style={[s.handle, { backgroundColor: colors.border }]} />
        <View style={[s.header, { borderBottomColor: colors.borderSoft }]}>
          <Text style={{ ...typography.h3, color: colors.textPrimary }}>Choose Screenshot</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={{ ...typography.body, color: colors.secondary }}>Cancel</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing["3xl"] }} />
        ) : assets.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ ...typography.body, color: colors.textMuted, textAlign: "center" }}>
              No uploaded screenshots yet. Upload one in Assets first.
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
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing["3xl"],
    },
  });
}