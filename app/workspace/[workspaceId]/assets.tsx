import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { AppBadge, BadgeVariant } from "@/components/ui/AppBadge";
import { AppButton } from "@/components/ui/AppButton";
import { AppModal } from "@/components/ui/AppModal";
import {
  getAssetsWithUsage,
  deleteAsset,
  getAssetPublicUrl,
  type AssetWithUsage,
} from "@/services/content/assetService";

type AssetType = "generated_image" | "uploaded_image" | "template_image";

const TYPE_BADGE: Record<AssetType, { label: string; variant: BadgeVariant }> = {
  generated_image: { label: "AI", variant: "info" },
  uploaded_image: { label: "Upload", variant: "neutral" },
  template_image: { label: "Template", variant: "success" },
};

type FilterKey = "all" | AssetType;
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "generated_image", label: "AI Generated" },
  { key: "uploaded_image", label: "Uploaded" },
  { key: "template_image", label: "Templates" },
];

const NUM_COLUMNS = 2;

export default function AssetsScreen() {
  const { colors } = useTheme();
  const { workspaceId } = useLocalSearchParams<{ workspaceId: string }>();

  const [assets, setAssets] = useState<AssetWithUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");

  const [confirmAsset, setConfirmAsset] = useState<AssetWithUsage | null>(null);
  const [deleting, setDeleting] = useState(false);

  const s = styles(colors);

  const load = useCallback(
    async (silent = false) => {
      if (!workspaceId) return;
      if (!silent) setLoading(true);
      try {
        const data = await getAssetsWithUsage(workspaceId);
        setAssets(data);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [workspaceId],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Reload when navigating back from generate-image modal
  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load]),
  );

  const filtered =
    filter === "all" ? assets : assets.filter((a) => a.type === filter);

  const handleDelete = useCallback(
    async () => {
      if (!confirmAsset) return;
      const asset = confirmAsset;
      setConfirmAsset(null);
      setDeleting(true);
      try {
        await deleteAsset(asset.id);
        setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      } catch {
        // Re-fetch so the list is back in sync
        load(true);
      } finally {
        setDeleting(false);
      }
    },
    [confirmAsset, load],
  );

  const renderItem = ({ item, index }: { item: AssetWithUsage; index: number }) => {
    const url = getAssetPublicUrl(item.file_path);
    const typeKey = item.type as AssetType;
    const badge = TYPE_BADGE[typeKey];
    const isLeft = index % NUM_COLUMNS === 0;

    return (
      <View
        style={[
          s.cell,
          { marginLeft: isLeft ? 0 : spacing.sm },
        ]}
      >
        <Image
          source={{ uri: url }}
          style={s.cellImage}
          contentFit="cover"
          accessibilityLabel="Asset thumbnail"
        />
        {/* Type badge overlay */}
        <View style={s.cellBadge}>
          <AppBadge label={badge.label} variant={badge.variant} />
        </View>
        {/* Post usage chip */}
        {item.postCount > 0 && (
          <View style={[s.usageChip, { backgroundColor: colors.surface + "CC" }]}>
            <MaterialIcons name="link" size={10} color={colors.textSecondary} />
            <Text style={{ ...typography.micro, color: colors.textSecondary }}>
              {item.postCount}
            </Text>
          </View>
        )}
        {/* Trash button overlay */}
        <Pressable
          onPress={() => setConfirmAsset(item)}
          style={({ pressed }) => [s.trashBtn, { opacity: pressed ? 0.7 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Delete asset"
          hitSlop={8}
        >
          <MaterialIcons name="delete" size={16} color="#fff" />
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={s.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <MaterialIcons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ ...typography.h2, color: colors.textPrimary }}>Assets</Text>
          {!loading && (
            <Text style={{ ...typography.micro, color: colors.textMuted }}>
              {filtered.length} {filtered.length === 1 ? "item" : "items"}
            </Text>
          )}
        </View>
      </View>

      {/* Filter tabs */}
      <View style={[s.filterRow, { borderBottomColor: colors.borderSoft }]}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[
                s.filterChip,
                {
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={f.label}
            >
              <Text
                style={{
                  ...typography.micro,
                  color: active ? colors.background : colors.textSecondary,
                  fontWeight: "600",
                }}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator
          color={colors.primary}
          style={{ marginTop: spacing["3xl"] }}
        />
      ) : filtered.length === 0 ? (
        <View style={s.empty}>
          <MaterialIcons name="perm-media" size={48} color={colors.textMuted} />
          <Text style={{ ...typography.h3, color: colors.textPrimary, marginTop: spacing.lg }}>
            No assets yet
          </Text>
          <Text
            style={{
              ...typography.body,
              color: colors.textSecondary,
              textAlign: "center",
              marginTop: spacing.sm,
            }}
          >
            Images are added here when you generate or upload media for a post.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(a) => a.id}
          renderItem={renderItem}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={s.grid}
          columnWrapperStyle={{ gap: spacing.sm }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(true);
              }}
              tintColor={colors.primary}
            />
          }
        />
      )}

      <AppModal
        visible={!!confirmAsset}
        onClose={() => setConfirmAsset(null)}
        title="Delete asset"
      >
        <Text style={{ ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg }}>
          {confirmAsset?.postCount
            ? `This asset is used in ${confirmAsset.postCount} post${confirmAsset.postCount !== 1 ? "s" : ""}. It will be unlinked and permanently deleted.`
            : "This will permanently delete the asset."}
        </Text>
        <AppButton
          label="Delete"
          variant="destructive"
          onPress={handleDelete}
          loading={deleting}
        />
        <AppButton
          label="Cancel"
          variant="secondary"
          onPress={() => setConfirmAsset(null)}
        />
      </AppModal>
    </SafeAreaView>
  );
}

function styles(colors: Record<string, string>) {
  return StyleSheet.create({
    safe: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
    },
    backBtn: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    filterRow: {
      flexDirection: "row",
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
    },
    filterChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: 999,
      borderWidth: 1,
    },
    grid: {
      padding: spacing.xl,
      gap: spacing.sm,
    },
    cell: {
      flex: 1,
      borderRadius: radius.lg,
      overflow: "hidden",
      backgroundColor: colors.surfaceAlt,
      aspectRatio: 1,
    },
    cellImage: { width: "100%", height: "100%" },
    cellBadge: {
      position: "absolute",
      top: spacing.sm,
      left: spacing.sm,
    },
    usageChip: {
      position: "absolute",
      bottom: spacing.sm,
      right: spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderRadius: 999,
    },
    trashBtn: {
      position: "absolute",
      top: spacing.sm,
      right: spacing.sm,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
    },
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing["3xl"],
    },
  });
}

