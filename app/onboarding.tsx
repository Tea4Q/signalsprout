import { AppButton } from "@/components/ui/AppButton";
import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Onboarding state key ─────────────────────────────────────────────────────

export const ONBOARDING_COMPLETE_KEY = "signalsprout_onboarding_complete_v1";

export async function markOnboardingComplete(): Promise<void> {
  if (Platform.OS === "web") {
    try {
      localStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
    } catch {}
  } else {
    await SecureStore.setItemAsync(ONBOARDING_COMPLETE_KEY, "true");
  }
}

export async function isOnboardingComplete(): Promise<boolean> {
  if (Platform.OS === "web") {
    try {
      return localStorage.getItem(ONBOARDING_COMPLETE_KEY) === "true";
    } catch {
      return false;
    }
  }
  const value = await SecureStore.getItemAsync(ONBOARDING_COMPLETE_KEY);
  return value === "true";
}

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  {
    icon: "business" as const,
    title: "Create your workspace",
    subtitle:
      "A workspace is your home base. Organise brands, posts, and costs all in one place.",
    cta: "Set up workspace",
    completed: true, // workspace is already created by the time onboarding shows
  },
  {
    icon: "palette" as const,
    title: "Add your first brand",
    subtitle:
      "Add a brand to start generating content that matches your voice and visual identity.",
    cta: "Add a brand",
  },
  {
    icon: "link" as const,
    title: "Connect a social account",
    subtitle:
      "Link your Instagram or Pinterest account so SignalSprout can schedule and publish posts.",
    cta: "Connect account",
  },
  {
    icon: "payments" as const,
    title: "Track your ad spend",
    subtitle:
      "Add a cost source to start monitoring your AI and advertising tool expenses.",
    cta: "Add cost source",
  },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (currentStep + 1) / STEPS.length,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [currentStep]);

  const handleCta = useCallback(
    async (stepIndex: number) => {
      // Step 0: workspace already created — just advance
      if (stepIndex === 0) {
        setCurrentStep(1);
        return;
      }

      // Steps 1-3: navigate to the relevant screen
      // After navigating, the user will be redirected back to tabs
      if (stepIndex === STEPS.length - 1) {
        // Last step — complete onboarding and go to dashboard
        await markOnboardingComplete();
        router.replace("/(tabs)/dashboard" as never);
        return;
      }

      setCurrentStep((s) => s + 1);
    },
    [],
  );

  const step = STEPS[currentStep];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          flex: 1,
          padding: spacing.xl,
          gap: spacing.xl,
          justifyContent: "center",
        }}
      >
        {/* Progress bar */}
        <View
          style={{
            height: 4,
            backgroundColor: colors.borderSoft,
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <Animated.View
            style={{
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.primary,
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            }}
          />
        </View>

        {/* Step indicator */}
        <Text
          style={{
            ...typography.micro,
            color: colors.textMuted,
            textAlign: "center",
            textTransform: "uppercase",
            letterSpacing: 0.6,
          }}
        >
          Step {currentStep + 1} of {STEPS.length}
        </Text>

        {/* Step cards */}
        <View
          style={{
            gap: spacing.lg,
          }}
        >
          {STEPS.map((s, i) => {
            const isActive = i === currentStep;
            const isDone = i < currentStep;

            return (
              <View
                key={i}
                style={{
                  backgroundColor:
                    isActive ? colors.surface : colors.background,
                  borderRadius: radius.xl,
                  borderWidth: isActive ? 1.5 : 1,
                  borderColor: isActive ? colors.primary : colors.borderSoft,
                  padding: spacing.xl,
                  gap: spacing.md,
                  opacity: isDone ? 0.55 : 1,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: radius.md,
                      backgroundColor:
                        isDone
                          ? colors.primarySoft
                          : isActive
                            ? colors.primarySoft
                            : colors.borderSoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {isDone ? (
                      <MaterialIcons
                        name="check-circle"
                        size={22}
                        color={colors.success}
                      />
                    ) : (
                      <MaterialIcons
                        name={s.icon}
                        size={22}
                        color={isActive ? colors.primary : colors.textMuted}
                      />
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        ...typography.body,
                        color: isActive
                          ? colors.textPrimary
                          : colors.textSecondary,
                        fontWeight: isActive ? "600" : "400",
                      }}
                    >
                      {s.title}
                    </Text>
                    {isActive && (
                      <Text
                        style={{
                          ...typography.caption,
                          color: colors.textSecondary,
                          marginTop: 2,
                        }}
                      >
                        {s.subtitle}
                      </Text>
                    )}
                  </View>
                </View>

                {isActive && (
                  <AppButton
                    label={s.cta}
                    onPress={() => handleCta(i)}
                    variant="primary"
                  />
                )}
              </View>
            );
          })}
        </View>

        {/* Skip */}
        <Pressable
          onPress={async () => {
            await markOnboardingComplete();
            router.replace("/(tabs)/dashboard" as never);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
          style={{ alignItems: "center" }}
        >
          <Text
            style={{ ...typography.caption, color: colors.textMuted }}
          >
            Skip for now
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
