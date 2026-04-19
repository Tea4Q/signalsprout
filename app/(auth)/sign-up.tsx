import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { signUpSchema } from "@/lib/validators";
import { signUp } from "@/services/auth/authService";
import { router } from "expo-router";
import React, { useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    View,
} from "react-native";

export default function SignUpScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSignUp() {
    setServerError("");
    const result = signUpSchema.safeParse({ email, password, confirmPassword });
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      setErrors({
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
        confirmPassword: fieldErrors.confirmPassword?.[0],
      });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await signUp(email, password);
      setSuccess(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Sign up failed. Please try again.";
      setServerError(message);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
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
          Check your email
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: "center" }}>
          We sent a confirmation link to {email}. Click the link to activate your account.
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
        <View style={{ marginBottom: spacing["3xl"], alignItems: "center" }}>
          <Text style={{ ...typography.h1, color: colors.primary, marginBottom: spacing.sm }}>
            SignalSprout
          </Text>
          <Text style={{ ...typography.body, color: colors.textSecondary }}>
            Create your account
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
            error={errors.email}
            placeholder="you@example.com"
          />

          <AppInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            error={errors.password}
            placeholder="Min. 8 chars, 1 uppercase, 1 number"
          />

          <AppInput
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            error={errors.confirmPassword}
            placeholder="••••••••"
          />

          {!!serverError && (
            <Text style={{ ...typography.caption, color: colors.danger, textAlign: "center" }}>
              {serverError}
            </Text>
          )}

          <AppButton label="Create Account" onPress={handleSignUp} loading={loading} />

          <View style={{ flexDirection: "row", justifyContent: "center", marginTop: spacing.sm }}>
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>
              Already have an account?{" "}
            </Text>
            <Text
              style={{ ...typography.caption, color: colors.secondary, fontWeight: "600" }}
              onPress={() => router.replace("/(auth)/sign-in")}
            >
              Sign in
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
