import { AppBadge } from "@/components/ui/AppBadge";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { AppInput } from "@/components/ui/AppInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { getBrands, createBrand } from "@/services/workspace/brandService";
import type { Database } from "@/types/database";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type BrandRow = Database["public"]["Tables"]["brands"]["Row"];

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function BrandsScreen() {
  const { colors } = useTheme();
  const { workspaceId } = useLocalSearchParams<{ workspaceId: string }>();

  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(true);

  // Create modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; slug?: string }>({});
  const [creating, setCreating] = useState(false);
  const [serverError, setServerError] = useState("");

  const fetchBrands = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const data = await getBrands(workspaceId);
      setBrands(data);
    } catch {
      // silently fail on list fetch
    } finally {
      setLoadingBrands(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  function openModal() {
    setName("");
    setSlug("");
    setSlugEdited(false);
    setErrors({});
    setServerError("");
    setModalVisible(true);
  }

  function handleNameChange(value: string) {
    setName(value);
    if (!slugEdited) setSlug(toSlug(value));
  }

  async function handleCreate() {
    setServerError("");
    const newErrors: { name?: string; slug?: string } = {};
    if (!name.trim()) newErrors.name = "Brand name is required.";
    if (!slug.trim()) newErrors.slug = "Slug is required.";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setCreating(true);
    try {
      await createBrand(workspaceId!, { name: name.trim(), slug });
      setModalVisible(false);
      fetchBrands();
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Failed to create brand.");
    } finally {
      setCreating(false);
    }
  }

  if (loadingBrands) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>
        {brands.length === 0 ? (
          <EmptyState
            icon="storefront"
            title="No brands yet"
            subtitle="Create your first brand to get started."
            ctaLabel="Create Brand"
            onCta={openModal}
          />
        ) : (
          <FlatList
            data={brands}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() =>
                  router.push(
                    `/workspace/${workspaceId}/brand/${item.id}` as never,
                  )
                }
              >
                <AppCard>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: spacing.sm,
                    }}
                  >
                    <Text
                      style={{
                        ...typography.h3,
                        color: colors.textPrimary,
                        flex: 1,
                      }}
                    >
                      {item.name}
                    </Text>
                    <View style={{ flexDirection: "row", gap: spacing.xs }}>
                      <AppBadge label="IG" variant="info" />
                      <AppBadge label="PIN" variant="neutral" />
                    </View>
                  </View>
                  {!!item.description && (
                    <Text
                      style={{
                        ...typography.caption,
                        color: colors.textSecondary,
                        marginBottom: spacing.sm,
                      }}
                      numberOfLines={2}
                    >
                      {item.description}
                    </Text>
                  )}
                  {!!item.website_url && (
                    <Text
                      style={{ ...typography.caption, color: colors.secondary }}
                      numberOfLines={1}
                    >
                      {item.website_url}
                    </Text>
                  )}
                </AppCard>
              </Pressable>
            )}
            ListFooterComponent={
              <AppButton label="New Brand" onPress={openModal} variant="secondary" />
            }
          />
        )}
      </View>

      {/* Create Brand Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
            <TouchableWithoutFeedback>
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderTopLeftRadius: radius.xl,
                  borderTopRightRadius: radius.xl,
                  padding: spacing.xl,
                  paddingBottom: spacing["3xl"],
                  gap: spacing.lg,
                }}
              >
                <Text style={{ ...typography.h3, color: colors.textPrimary }}>
                  New Brand
                </Text>

                <AppInput
                  label="Brand Name"
                  value={name}
                  onChangeText={handleNameChange}
                  placeholder="My Brand"
                  error={errors.name}
                />

                <AppInput
                  label="Slug"
                  value={slug}
                  onChangeText={(v) => { setSlugEdited(true); setSlug(toSlug(v)); }}
                  placeholder="my-brand"
                  autoCapitalize="none"
                  autoCorrect={false}
                  error={errors.slug}
                />

                {!!serverError && (
                  <Text style={{ ...typography.caption, color: colors.danger }}>
                    {serverError}
                  </Text>
                )}

                <View style={{ flexDirection: "row", gap: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <AppButton
                      label="Cancel"
                      onPress={() => setModalVisible(false)}
                      variant="secondary"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppButton
                      label="Create"
                      onPress={handleCreate}
                      loading={creating}
                    />
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}
