import { AppBadge } from "@/components/ui/AppBadge";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { AppInput } from "@/components/ui/AppInput";
import { AppSelect, SelectOption } from "@/components/ui/AppSelect";
import { AppTextarea } from "@/components/ui/AppTextarea";
import { EmptyState } from "@/components/ui/EmptyState";
import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { getBrands } from "@/services/workspace/brandService";
import { getCampaigns, createCampaign } from "@/services/workspace/campaignService";
import type { Database } from "@/types/database";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type CampaignRow = Database["public"]["Tables"]["campaigns"]["Row"];
type BrandRow = Database["public"]["Tables"]["brands"]["Row"];

function statusVariant(status: string): "success" | "warning" | "neutral" | "info" {
  if (status === "active") return "success";
  if (status === "draft") return "neutral";
  if (status === "paused") return "warning";
  if (status === "completed") return "info";
  return "neutral";
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function CampaignsScreen() {
  const { colors } = useTheme();
  const { workspaceId } = useLocalSearchParams<{ workspaceId: string }>();

  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [goal, setGoal] = useState("");
  const [brandId, setBrandId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  const brandOptions: SelectOption[] = brands.map((b) => ({ label: b.name, value: b.id }));

  const fetchData = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const [campaignData, brandsData] = await Promise.all([
        getCampaigns(workspaceId),
        getBrands(workspaceId),
      ]);
      setCampaigns(campaignData);
      setBrands(brandsData);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openModal() {
    setCampaignName("");
    setGoal("");
    setBrandId(null);
    setStartDate("");
    setEndDate("");
    setErrors({});
    setModalVisible(true);
  }

  async function handleCreate() {
    const newErrors: Record<string, string> = {};
    if (!campaignName.trim()) newErrors.campaignName = "Campaign name is required.";
    if (!brandId) newErrors.brandId = "Brand is required.";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setCreating(true);
    try {
      await createCampaign({
        workspace_id: workspaceId!,
        brand_id: brandId!,
        name: campaignName.trim(),
        goal: goal.trim() || null,
        start_date: startDate.trim() || null,
        end_date: endDate.trim() || null,
      });
      setModalVisible(false);
      fetchData();
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to create campaign.");
    } finally {
      setCreating(false);
    }
  }

  function brandName(id: string) {
    return brands.find((b) => b.id === id)?.name ?? "—";
  }

  if (loading) {
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
        {campaigns.length === 0 ? (
          <EmptyState
            icon="campaign"
            title="No campaigns yet"
            subtitle="Create your first campaign to plan and track your marketing efforts."
            ctaLabel="Create Campaign"
            onCta={openModal}
          />
        ) : (
          <FlatList
            data={campaigns}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
            renderItem={({ item }) => (
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
                    style={{ ...typography.h3, color: colors.textPrimary, flex: 1, marginRight: spacing.sm }}
                  >
                    {item.name}
                  </Text>
                  <AppBadge label={item.status} variant={statusVariant(item.status)} />
                </View>
                <Text style={{ ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs }}>
                  {brandName(item.brand_id)}
                </Text>
                {!!item.goal && (
                  <Text
                    style={{ ...typography.body, color: colors.textSecondary, marginBottom: spacing.sm }}
                    numberOfLines={2}
                  >
                    {item.goal}
                  </Text>
                )}
                <Text style={{ ...typography.caption, color: colors.textMuted }}>
                  {formatDate(item.start_date)} — {formatDate(item.end_date)}
                </Text>
              </AppCard>
            )}
            ListFooterComponent={
              <AppButton label="New Campaign" onPress={openModal} variant="secondary" />
            }
          />
        )}
      </View>

      {/* Create Campaign Modal */}
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
                  New Campaign
                </Text>

                <AppInput
                  label="Campaign Name"
                  value={campaignName}
                  onChangeText={setCampaignName}
                  placeholder="Summer Launch"
                  error={errors.campaignName}
                />

                <AppSelect
                  label="Brand"
                  value={brandId}
                  options={brandOptions}
                  onChange={setBrandId}
                  placeholder="Select brand"
                  error={errors.brandId}
                />

                <AppTextarea
                  label="Goal"
                  value={goal}
                  onChangeText={setGoal}
                  placeholder="What do you want to achieve?"
                  numberOfLines={3}
                />

                <View style={{ flexDirection: "row", gap: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <AppInput
                      label="Start Date"
                      value={startDate}
                      onChangeText={setStartDate}
                      placeholder="YYYY-MM-DD"
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppInput
                      label="End Date"
                      value={endDate}
                      onChangeText={setEndDate}
                      placeholder="YYYY-MM-DD"
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                </View>

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
