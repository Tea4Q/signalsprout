import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { forgotPasswordSchema } from "@/lib/validators";
import { resetPassword } from "@/services/auth/authService";
import { router } from "expo-router";
import React, { useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    View,
} from "react-native";

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSendReset() {
    setServerError("");
    const result = forgotPasswordSchema.safeParse({ email });
    if (!result.success) {
      setEmailError(result.error.flatten().fieldErrors.email?.[0] ?? "");
      return;
    }
    setEmailError("");
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to send reset email.";
      setServerError(message);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: "center",
          paddingHorizontal: spacing.xl,
          gap: spacing.lg,
        }}
      >
        <Text style={{ ...typography.h2, color: colors.textPrimary, textAlign: "center" }}>
          Reset link sent
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: "center" }}>
          Check {email} for a password reset link.
        </Text>
        <AppButton label="Back to Sign In" onPress={() => router.replace("/(auth)/sign-in")} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
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
        <View
          style={{
            marginBottom: spacing["3xl"],
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          <Text style={{ ...typography.h1, color: colors.primary }}>
            SignalSprout
          </Text>
          <Text style={{ ...typography.h3, color: colors.textPrimary }}>
            Reset your password
          </Text>
          <Text
            style={{ ...typography.body, color: colors.textSecondary, textAlign: "center" }}
          >
            {"Enter your email and we'll send you a link to reset your password."}
          </Text>
        </View>

        <View style={{ gap: spacing.lg }}>
          <AppInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            error={emailError}
            placeholder="you@example.com"
          />

          {!!serverError && (
            <Text style={{ ...typography.caption, color: colors.danger, textAlign: "center" }}>
              {serverError}
            </Text>
          )}

          <AppButton label="Send Reset Link" onPress={handleSendReset} loading={loading} />

          <AppButton label="Back to Sign In" onPress={() => router.back()} variant="secondary" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
