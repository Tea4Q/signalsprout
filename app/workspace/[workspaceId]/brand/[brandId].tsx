import { AppBadge } from "@/components/ui/AppBadge";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { AppTabs } from "@/components/ui/AppTabs";
import { AppTextarea } from "@/components/ui/AppTextarea";
import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  getBrandProfile,
  updateBrand,
  upsertBrandProfile,
  getBrandAssets,
  uploadBrandAsset,
  deleteBrandAsset,
} from "@/services/workspace/brandService";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type BrandRow = Database["public"]["Tables"]["brands"]["Row"];
type BrandProfileRow = Database["public"]["Tables"]["brand_profiles"]["Row"];

const TABS = [
  { key: "info", label: "Info" },
  { key: "profile", label: "Profile" },
  { key: "assets", label: "Assets" },
];

// ─── Tag Input Helper ──────────────────────────────────────────────────────────
function TagList({
  tags,
  onRemove,
}: {
  tags: string[];
  onRemove: (index: number) => void;
}) {
  const { colors } = useTheme();
  if (tags.length === 0) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm }}>
      {tags.map((tag, i) => (
        <Pressable
          key={i}
          onPress={() => onRemove(i)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor: colors.primarySoft,
            paddingHorizontal: spacing.sm,
            paddingVertical: 4,
            borderRadius: 999,
          }}
        >
          <Text style={{ ...typography.caption, color: colors.primary }}>{tag}</Text>
          <Text style={{ ...typography.caption, color: colors.primary }}>×</Text>
        </Pressable>
      ))}
    </View>
  );
}

function TagInput({
  label,
  tags,
  onChange,
  placeholder,
}: {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const { colors } = useTheme();
  const [value, setValue] = useState("");

  function addTag() {
    const trimmed = value.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    onChange([...tags, trimmed]);
    setValue("");
  }

  return (
    <View style={{ gap: spacing.xs }}>
          <Text style={{ ...typography.caption, color: colors.textSecondary, fontWeight: '600' }}>{label}</Text>
      <TagList tags={tags} onRemove={(i) => onChange(tags.filter((_, idx) => idx !== i))} />
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder={placeholder ?? `Add ${label.toLowerCase()}`}
          placeholderTextColor={colors.textMuted}
          onSubmitEditing={addTag}
          returnKeyType="done"
          style={{
            flex: 1,
            backgroundColor: colors.surfaceAlt,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            color: colors.textPrimary,
            ...typography.body,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        />
        <Pressable
          onPress={addTag}
          style={{
            backgroundColor: colors.primarySoft,
            paddingHorizontal: spacing.md,
            borderRadius: radius.md,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ ...typography.caption, color: colors.primary, fontWeight: '600' }}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Info Tab ─────────────────────────────────────────────────────────────────

function InfoTab({ brand, onSaved }: { brand: BrandRow; onSaved: (updated: Partial<BrandRow>) => void }) {
  const { colors } = useTheme();
  const [name, setName] = useState(brand.name);
  const [description, setDescription] = useState(brand.description ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(brand.website_url ?? "");
  const [appStoreUrl, setAppStoreUrl] = useState(brand.app_store_url ?? "");
  const [playStoreUrl, setPlayStoreUrl] = useState(brand.play_store_url ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      setErrors({ name: "Brand name is required." });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await updateBrand(brand.id, {
        name: name.trim(),
        description: description.trim() || null,
        website_url: websiteUrl.trim() || null,
        app_store_url: appStoreUrl.trim() || null,
        play_store_url: playStoreUrl.trim() || null,
      });
      onSaved({ name: name.trim(), description: description.trim() || null });
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      <AppInput
        label="Brand Name"
        value={name}
        onChangeText={setName}
        error={errors.name}
      />
      <AppTextarea
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="What does this brand do?"
        numberOfLines={4}
      />
      <AppInput
        label="Website URL"
        value={websiteUrl}
        onChangeText={setWebsiteUrl}
        placeholder="https://mybrand.com"
        autoCapitalize="none"
        keyboardType="url"
      />
      <AppInput
        label="App Store URL"
        value={appStoreUrl}
        onChangeText={setAppStoreUrl}
        placeholder="https://apps.apple.com/..."
        autoCapitalize="none"
        keyboardType="url"
      />
      <AppInput
        label="Play Store URL"
        value={playStoreUrl}
        onChangeText={setPlayStoreUrl}
        placeholder="https://play.google.com/..."
        autoCapitalize="none"
        keyboardType="url"
      />
      <AppButton label="Save" onPress={handleSave} loading={saving} />
    </ScrollView>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab({
  brand,
  profile,
}: {
  brand: BrandRow;
  profile: BrandProfileRow | null;
}) {
  const { colors } = useTheme();
  const [primaryColor, setPrimaryColor] = useState(profile?.primary_color ?? "");
  const [secondaryColor, setSecondaryColor] = useState(profile?.secondary_color ?? "");
  const [postingNotes, setPostingNotes] = useState(profile?.posting_notes ?? "");
  const [targetAudience, setTargetAudience] = useState(brand.target_audience ?? "");
  const [voiceSummary, setVoiceSummary] = useState(brand.voice_summary ?? "");
  const [toneKeywords, setToneKeywords] = useState<string[]>(profile?.tone_keywords ?? []);
  const [hashtagLibrary, setHashtagLibrary] = useState<string[]>(profile?.hashtag_library ?? []);
  const [ctaLibrary, setCtaLibrary] = useState<string[]>(profile?.cta_library ?? []);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await Promise.all([
        upsertBrandProfile(brand.id, {
          primary_color: primaryColor.trim() || null,
          secondary_color: secondaryColor.trim() || null,
          posting_notes: postingNotes.trim() || null,
          tone_keywords: toneKeywords.length > 0 ? toneKeywords : null,
          hashtag_library: hashtagLibrary.length > 0 ? hashtagLibrary : null,
          cta_library: ctaLibrary.length > 0 ? ctaLibrary : null,
        }),
        updateBrand(brand.id, {
          target_audience: targetAudience.trim() || null,
          voice_summary: voiceSummary.trim() || null,
        }),
      ]);
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <AppInput
            label="Primary Color"
            value={primaryColor}
            onChangeText={setPrimaryColor}
            placeholder="#3B82F6"
            autoCapitalize="none"
          />
        </View>
        <View style={{ flex: 1 }}>
          <AppInput
            label="Secondary Color"
            value={secondaryColor}
            onChangeText={setSecondaryColor}
            placeholder="#8B5CF6"
            autoCapitalize="none"
          />
        </View>
      </View>

      <AppTextarea
        label="Target Audience"
        value={targetAudience}
        onChangeText={setTargetAudience}
        placeholder="Who is this brand's audience?"
        numberOfLines={3}
      />
      <AppTextarea
        label="Brand Voice Summary"
        value={voiceSummary}
        onChangeText={setVoiceSummary}
        placeholder="Describe the brand's tone and personality..."
        numberOfLines={4}
      />
      <AppTextarea
        label="Posting Notes"
        value={postingNotes}
        onChangeText={setPostingNotes}
        placeholder="Guidelines, restrictions, or reminders..."
        numberOfLines={3}
      />

      <TagInput
        label="Tone Keywords"
        tags={toneKeywords}
        onChange={setToneKeywords}
        placeholder="e.g. friendly, professional"
      />
      <TagInput
        label="Hashtag Library"
        tags={hashtagLibrary}
        onChange={setHashtagLibrary}
        placeholder="e.g. #mybrand"
      />
      <TagInput
        label="CTA Library"
        tags={ctaLibrary}
        onChange={setCtaLibrary}
        placeholder="e.g. Shop now"
      />

      <AppButton label="Save Profile" onPress={handleSave} loading={saving} />
    </ScrollView>
  );
}

// ─── Assets Tab ──────────────────────────────────────────────────────────────

const ASSET_LABELS = ["Logo", "Character / Avatar", "Banner", "Product Shot", "Other"];

type AssetRow = Database["public"]["Tables"]["assets"]["Row"];

function AssetsTab({
  workspaceId,
  brandId,
}: {
  workspaceId: string;
  brandId: string;
}) {
  const { colors } = useTheme();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(ASSET_LABELS[0]);
  const [error, setError] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    try {
      const data = await getBrandAssets(workspaceId, brandId);
      setAssets(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load assets.");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, brandId]);

  useEffect(() => { loadAssets(); }, [loadAssets]);

  async function handleWebFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      await uploadBrandAsset(workspaceId, brandId, file, selectedLabel);
      await loadAssets();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      // reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(asset: AssetRow) {
    Alert.alert("Delete Asset", `Remove "${asset.alt_text ?? "this asset"}" permanently?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteBrandAsset(asset.id, asset.file_path);
            setAssets((prev) => prev.filter((a) => a.id !== asset.id));
          } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Delete failed.");
          }
        },
      },
    ]);
  }

  function getPublicUrl(filePath: string): string {
    const { data } = supabase.storage.from("assets").getPublicUrl(filePath);
    return data.publicUrl;
  }

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }}>
      {!!error && (
        <View
          style={{
            backgroundColor: colors.accentSoft,
            borderRadius: radius.md,
            padding: spacing.md,
          }}
        >
          <Text style={{ ...typography.caption, color: colors.danger }}>{error}</Text>
        </View>
      )}

      {/* Upload section */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.xl,
          gap: spacing.lg,
        }}
      >
        <Text style={{ ...typography.h3, color: colors.textPrimary }}>Upload Asset</Text>

        {/* Label picker */}
        <View style={{ gap: spacing.xs }}>
          <Text style={{ ...typography.caption, color: colors.textSecondary }}>Asset Type</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {ASSET_LABELS.map((label) => (
              <Pressable
                key={label}
                onPress={() => setSelectedLabel(label)}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  borderRadius: radius.xl,
                  backgroundColor:
                    selectedLabel === label ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor:
                    selectedLabel === label ? colors.primary : colors.border,
                }}
                accessibilityRole="button"
              >
                <Text
                  style={{
                    ...typography.caption,
                    color:
                      selectedLabel === label
                        ? colors.background
                        : colors.textSecondary,
                    fontWeight: selectedLabel === label ? "600" : "400",
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {Platform.OS === "web" ? (
          <View style={{ gap: spacing.sm }}>
            {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
            {/* @ts-expect-error web-only */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              title="Choose brand asset"
              aria-label="Choose brand asset file"
              disabled={uploading}
              onChange={handleWebFile}
            />
            {uploading && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                  Uploading…
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View
            style={{
              padding: spacing.lg,
              borderRadius: radius.md,
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: colors.border,
              alignItems: "center",
            }}
          >
            <Text style={{ ...typography.caption, color: colors.textMuted, textAlign: "center" }}>
              File upload is available on web. Open this page in a browser to upload assets.
            </Text>
          </View>
        )}
      </View>

      {/* Asset gallery */}
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : assets.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: spacing.xl }}>
          <Text style={{ ...typography.body, color: colors.textMuted }}>
            No brand assets uploaded yet.
          </Text>
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          <Text style={{ ...typography.caption, color: colors.textSecondary, textTransform: "uppercase" }}>
            Uploaded Assets ({assets.length})
          </Text>
          {assets.map((asset) => (
            <View
              key={asset.id}
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: "hidden",
              }}
            >
              <Image
                source={{ uri: getPublicUrl(asset.file_path) }}
                style={{ width: "100%", height: 180 }}
                contentFit="contain"
                transition={200}
              />
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: spacing.md,
                  gap: spacing.sm,
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ ...typography.body, color: colors.textPrimary, fontWeight: "600" }}>
                    {asset.alt_text ?? "Untitled"}
                  </Text>
                  <Text style={{ ...typography.micro, color: colors.textMuted }}>
                    {new Date(asset.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleDelete(asset)}
                  style={({ pressed }) => ({
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs,
                    borderRadius: radius.sm,
                    borderWidth: 1,
                    borderColor: colors.danger + "40",
                    backgroundColor: colors.danger + "10",
                    opacity: pressed ? 0.6 : 1,
                  })}
                  accessibilityRole="button"
                  accessibilityLabel="Delete asset"
                >
                  <Text style={{ ...typography.caption, color: colors.danger }}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BrandDetailScreen() {
  const { colors } = useTheme();
  const { workspaceId, brandId } = useLocalSearchParams<{ workspaceId: string; brandId: string }>();

  const [activeTab, setActiveTab] = useState("info");
  const [brand, setBrand] = useState<BrandRow | null>(null);
  const [profile, setProfile] = useState<BrandProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!brandId) return;
      try {
        const [brandRes, profileData] = await Promise.all([
          supabase.from("brands").select("*").eq("id", brandId).single(),
          getBrandProfile(brandId),
        ]);
        if (brandRes.data) setBrand(brandRes.data);
        setProfile(profileData);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [brandId]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!brand) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ ...typography.body, color: colors.textSecondary }}>Brand not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <AppTabs tabs={TABS} activeKey={activeTab} onChange={setActiveTab} />
      {activeTab === "info" ? (
        <InfoTab
          brand={brand}
          onSaved={(updated) => setBrand((prev) => prev ? { ...prev, ...updated } : prev)}
        />
      ) : activeTab === "profile" ? (
        <ProfileTab brand={brand} profile={profile} />
      ) : (
        <AssetsTab workspaceId={workspaceId!} brandId={brand.id} />
      )}
    </SafeAreaView>
  );
}
