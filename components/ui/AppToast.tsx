import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, typography } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";
import { type ToastItem, useToast } from "../../context/toast-context";

function SingleToast({ toast }: { toast: ToastItem }) {
  const { colors } = useTheme();
  const { dismissToast } = useToast();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-12);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 220 });
    translateY.value = withTiming(0, { duration: 220 });

    const timer = setTimeout(() => {
      opacity.value = withSequence(
        withTiming(0, { duration: 250 }, (done) => {
          if (done) runOnJS(dismissToast)(toast.id);
        }),
      );
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const bgColor =
    toast.variant === "success"
      ? colors.success
      : toast.variant === "error"
        ? colors.danger
        : colors.info;

  return (
    <Animated.View style={[styles.toast, { backgroundColor: bgColor }, animStyle]}>
      <Text style={[styles.message, { color: "#FFFFFF" }]} numberOfLines={2}>
        {toast.message}
      </Text>
      <Pressable
        onPress={() => dismissToast(toast.id)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Dismiss notification"
      >
        <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
          ×
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function AppToastContainer() {
  const { toasts } = useToast();
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View
      style={[
        styles.container,
        { top: insets.top + spacing.sm },
      ]}
      pointerEvents="box-none"
    >
      {toasts.map((t) => (
        <SingleToast key={t.id} toast={t} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
    gap: spacing.sm,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 6,
  },
  message: {
    ...typography.caption,
    flex: 1,
    fontWeight: "500",
    color: "#FFFFFF",
  },
});
