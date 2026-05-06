import { AppButton } from "@/components/ui/AppButton";
import { radius, spacing, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import {
  faCheckCircle,
  faLink,
  faMobileAlt,
  faUserCircle,
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

interface InstagramSetupModalProps {
  visible: boolean;
  onClose: () => void;
  onContinue: () => void;
}

const STEPS = [
  {
    icon: faUserCircle,
    title: "Instagram Professional Account",
    body: "Your Instagram must be a Business or Creator account. In Instagram: Profile → Menu → Settings → Account → Switch to Professional Account.",
  },
  {
    icon: faLink,
    title: "Link Instagram to a Facebook Page",
    body: "In Instagram: Settings → Account → Linked Accounts → Facebook. Choose or create a Page you manage. This is required by Meta.",
  },
  {
    icon: faMobileAlt,
    title: "Authorize with Facebook",
    body: "Tap Continue below. A browser will open Facebook Login — approve the requested permissions so SignalSprout can publish on your behalf.",
  },
  {
    icon: faCheckCircle,
    title: "You're all set",
    body: "After approving, SignalSprout will detect your linked Instagram account and show it as connected.",
  },
] as const;

export function InstagramSetupModal({
  visible,
  onClose,
  onContinue,
}: InstagramSetupModalProps) {
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
              Connect Instagram
            </Text>
            <Text style={{ ...typography.caption, color: colors.textMuted }}>
              Meta retired the old Instagram Login in December 2024. Before connecting,
              make sure you&apos;ve completed these steps:
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
                  backgroundColor: "#E1306C1A",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <FontAwesomeIcon icon={step.icon} size={16} color="#E1306C" />
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