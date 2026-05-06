import React, { useCallback, useRef, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { faInstagram, faOpenai, faPinterest } from "@fortawesome/free-brands-svg-icons";
import { faKey } from "@fortawesome/free-solid-svg-icons";
import { spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useWorkspace } from "@/context/workspace-context";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { AppSelect } from "@/components/ui/AppSelect";
import { storeCredential } from "@/services/security/credentialVaultService";

const SERVICE_OPTIONS = [
  {
    label: "OpenAI",
    value: "openai",
    icon: <FontAwesomeIcon icon={faOpenai} size={16} color="#74aa9c" />,
  },
  {
    label: "Instagram",
    value: "instagram",
    icon: <FontAwesomeIcon icon={faInstagram} size={16} color="#E1306C" />,
  },
  {
    label: "Pinterest",
    value: "pinterest",
    icon: <FontAwesomeIcon icon={faPinterest} size={16} color="#E60023" />,
  },
  {
    label: "Custom",
    value: "custom",
    icon: <FontAwesomeIcon icon={faKey} size={16} color="#888" />,
  },
];

const ENV_OPTIONS = [
  { label: "Production", value: "production" },
  { label: "Staging", value: "staging" },
];

interface FormValues {
  name: string;
  service: string;
  environment: string;
  value: string;
  rotation_due_at: string;
}

function defaultValues(): FormValues {
  return {
    name: "",
    service: "",
    environment: "production",
    value: "",
    rotation_due_at: "",
  };
}

export default function AddCredentialModal() {
  const { colors } = useTheme();
  const router = useRouter();
  const { workspaceId } = useWorkspace();
  const s = styles(colors);

  const [values, setValues] = useState<FormValues>(defaultValues());
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Keep a ref to the secret so we can wipe it from the TextInput state immediately
  const secretRef = useRef("");

  function set<K extends keyof FormValues>(key: K, val: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: val }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormValues, string>> = {};
    if (!values.name.trim()) errs.name = "Name is required.";
    if (!values.service) errs.service = "Service is required.";
    if (!values.environment) errs.environment = "Environment is required.";
    if (!values.value.trim()) errs.value = "Secret value is required.";
    if (
      values.rotation_due_at &&
      isNaN(Date.parse(values.rotation_due_at))
    ) {
      errs.rotation_due_at = "Enter a valid date (YYYY-MM-DD).";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const handleSave = useCallback(async () => {
    if (!workspaceId) return;
    if (!validate()) return;

    setSaving(true);
    setSubmitError(null);

    // Capture the secret from state, then immediately wipe from component state
    const secretValue = values.value;
    set("value", "");

    try {
      await storeCredential({
        workspace_id: workspaceId,
        name: values.name.trim(),
        service: values.service,
        environment: values.environment,
        value: secretValue,
        rotation_due_at: values.rotation_due_at
          ? new Date(values.rotation_due_at).toISOString()
          : undefined,
      });
      router.back();
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : "Failed to store credential.",
      );
    } finally {
      // Ensure secret is overwritten in memory
      secretRef.current = "";
      setSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, values]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={{ ...typography.body, color: colors.textSecondary }}>
            Cancel
          </Text>
        </Pressable>
        <Text style={{ ...typography.h2, color: colors.textPrimary }}>
          Add Credential
        </Text>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <AppInput
          label="Name"
          placeholder="e.g. OpenAI API Key"
          value={values.name}
          onChangeText={(t) => set("name", t)}
          error={errors.name}
          autoCapitalize="none"
        />

        <AppSelect
          label="Service"
          value={values.service}
          options={SERVICE_OPTIONS}
          onChange={(v) => set("service", v)}
          placeholder="Select service"
          error={errors.service}
        />

        <AppSelect
          label="Environment"
          value={values.environment}
          options={ENV_OPTIONS}
          onChange={(v) => set("environment", v)}
          error={errors.environment}
        />

        <AppInput
          label="Secret Value"
          placeholder="Paste your secret key here"
          value={values.value}
          onChangeText={(t) => {
            secretRef.current = t;
            set("value", t);
          }}
          error={errors.value}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />

        <AppInput
          label="Rotation Due Date (optional)"
          placeholder="YYYY-MM-DD"
          value={values.rotation_due_at}
          onChangeText={(t) => set("rotation_due_at", t)}
          error={errors.rotation_due_at}
          autoCapitalize="none"
          keyboardType="default"
        />

        {!!submitError && (
          <Text style={{ ...typography.caption, color: colors.danger }}>
            {submitError}
          </Text>
        )}

        <View style={{ paddingBottom: spacing["3xl"] }}>
          <AppButton
            label={saving ? "Storing…" : "Store Credential"}
            onPress={handleSave}
            loading={saving}
            disabled={saving}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
  });
