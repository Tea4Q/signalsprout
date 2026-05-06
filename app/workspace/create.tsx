import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { createWorkspace } from "@/services/workspace/workspaceService";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CreateWorkspaceScreen() {
  const { colors } = useTheme();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; slug?: string }>({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugEdited) {
      setSlug(toSlug(value));
    }
  }

  function handleSlugChange(value: string) {
    setSlugEdited(true);
    setSlug(toSlug(value));
  }

  async function handleCreate() {
    setServerError("");
    const newErrors: { name?: string; slug?: string } = {};
    if (!name.trim()) newErrors.name = "Workspace name is required.";
    if (!slug.trim()) newErrors.slug = "Slug is required.";
    else if (!/^[a-z0-9-]+$/.test(slug)) {
      newErrors.slug = "Only lowercase letters, numbers, and hyphens.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await createWorkspace(name.trim(), slug);
      router.replace("/(tabs)/dashboard");
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message ?? "Failed to create workspace.";
      setServerError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing["3xl"],
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ marginBottom: spacing["3xl"], alignItems: "center" }}>
            <Text
              style={{
                ...typography.h1,
                color: colors.primary,
                marginBottom: spacing.sm,
              }}
            >
              SignalSprout
            </Text>
            <Text style={{ ...typography.h3, color: colors.textPrimary }}>
              Create your workspace
            </Text>
            <Text
              style={{
                ...typography.body,
                color: colors.textSecondary,
                textAlign: "center",
                marginTop: spacing.sm,
              }}
            >
              Your workspace is where your brands, campaigns, and content live.
            </Text>
          </View>

          <View style={{ gap: spacing.lg }}>
            <AppInput
              label="Workspace Name"
              value={name}
              onChangeText={handleNameChange}
              placeholder="Acme Marketing"
              autoCapitalize="words"
              error={errors.name}
            />

            <AppInput
              label="URL Slug"
              value={slug}
              onChangeText={handleSlugChange}
              placeholder="acme-marketing"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.slug}
            />

            {!!serverError && (
              <Text
                style={{
                  ...typography.caption,
                  color: colors.danger,
                  textAlign: "center",
                }}
              >
                {serverError}
              </Text>
            )}

            <AppButton
              label="Create Workspace"
              onPress={handleCreate}
              loading={loading}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
