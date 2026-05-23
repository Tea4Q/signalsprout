import { AppButton } from "@/components/ui/AppButton";
import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import {
  faCheckCircle,
  faFlag,
  faLink,
  faShieldAlt,
} from "@fortawesome/free-solid-svg-icons";
import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface FacebookSetupModalProps {
  visible: boolean;
  onClose: () => void;
  onContinue: () => void;
}

const STEPS = [
  {
    icon: faFlag,
    title: "You need a Facebook Page",
    body: "Publishing requires a Facebook Page (not a personal profile). Go to facebook.com/pages/create if you don't have one yet.",
  },
  {
    icon: faLink,
    title: "Select your Page in the Meta dialog",
    body: "When the Facebook login window opens, tap the Page dropdown and choose the Page you want to publish from. Skipping this step means no publishing access.",
  },
  {
    icon: faShieldAlt,
    title: "Approve the requested permissions",
    body: "SignalSprout needs pages_manage_posts and pages_read_engagement to publish and fetch basic metrics on your behalf.",
  },
  {
    icon: faCheckCircle,
    title: "You're all set",
    body: "After approving, SignalSprout will detect your Page and show it as connected so you can start scheduling posts.",
  },
] as const;

export function FacebookSetupModal({
  visible,
  onClose,
  onContinue,
}: FacebookSetupModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.55)" }]}
        onPress={onClose}
      />
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.surface,
          borderTopLeftRadius: radius["2xl"],
          borderTopRightRadius: radius["2xl"],
          paddingTop: spacing.lg,
          paddingBottom: Math.max(insets.bottom, spacing.xl),
          maxHeight: "90%",
        }}
      >
        {/* Handle */}
        <View
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
            alignSelf: "center",
            marginBottom: spacing.lg,
          }}
        />

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.xl }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={{ gap: spacing.xs }}>
            <Text style={{ ...typography.h2, color: colors.textPrimary }}>
              Connect Facebook
            </Text>
            <Text style={{ ...typography.caption, color: colors.textMuted }}>
              Publishing to Facebook requires a Facebook Page. Complete these steps
              before tapping Continue:
            </Text>
          </View>

          {/* Steps */}
          {STEPS.map((step, i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                gap: spacing.md,
                backgroundColor: colors.surfaceAlt,
                borderRadius: radius.lg,
                padding: spacing.lg,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: "#1877F21A",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <FontAwesomeIcon icon={step.icon} size={16} color="#1877F2" />
              </View>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text
                  style={{
                    ...typography.caption,
                    color: colors.textPrimary,
                    fontWeight: "600",
                  }}
                >
                  {`Step ${i + 1}: ${step.title}`}
                </Text>
                <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                  {step.body}
                </Text>
              </View>
            </View>
          ))}

          {/* Actions */}
          <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
            <AppButton
              label="Continue with Facebook"
              onPress={onContinue}
            />
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, alignItems: "center", padding: spacing.sm })}
            >
              <Text style={{ ...typography.caption, color: colors.textMuted }}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
