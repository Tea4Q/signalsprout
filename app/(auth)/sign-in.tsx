import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { signInSchema } from "@/lib/validators";
import { signIn } from "@/services/auth/authService";
import { router } from "expo-router";
import React, { useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    View,
} from "react-native";

export default function SignInScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  async function handleSignIn() {
    setServerError("");
    const result = signInSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      setErrors({
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
      });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace("/(tabs)/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sign in failed. Please try again.";
      setServerError(message);
    } finally {
      setLoading(false);
    }
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
            Sign in to your account
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
            autoComplete="password"
            textContentType="password"
            error={errors.password}
            placeholder="••••••••"
          />

          {!!serverError && (
            <Text style={{ ...typography.caption, color: colors.danger, textAlign: "center" }}>
              {serverError}
            </Text>
          )}

          <AppButton label="Sign In" onPress={handleSignIn} loading={loading} />

          <AppButton
            label="Forgot password?"
            onPress={() => router.push("/(auth)/forgot-password")}
            variant="secondary"
          />

          <View style={{ flexDirection: "row", justifyContent: "center", marginTop: spacing.sm }}>
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>
              {"Don't have an account? "}
            </Text>
            <Text
              style={{ ...typography.caption, color: colors.secondary, fontWeight: "600" }}
              onPress={() => router.push("/(auth)/sign-up")}
            >
              Sign up
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
