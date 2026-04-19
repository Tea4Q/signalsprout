import React, { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, spacing, typography } from "../../constants/theme";
import { useTheme } from "../../hooks/use-theme";

interface AppModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function AppModal({ visible, onClose, title, children }: AppModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 400,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View
        style={[styles.backdrop, { opacity: backdropAnim }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            paddingBottom: Math.max(insets.bottom, spacing.lg),
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Drag handle */}
        <View style={styles.handleContainer}>
          <View
            style={[styles.handle, { backgroundColor: colors.border }]}
          />
        </View>

        {/* Header */}
        {title && (
          <View
            style={[
              styles.header,
              { borderBottomColor: colors.border },
            ]}
          >
            <Text
              style={{
                ...typography.h3,
                color: colors.textPrimary,
                flex: 1,
              }}
            >
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close modal"
              style={({ pressed }) => [
                styles.closeBtn,
                { backgroundColor: pressed ? colors.surfaceAlt : colors.borderSoft },
              ]}
            >
              <Text
                style={{
                  fontSize: 16,
                  color: colors.textSecondary,
                  fontWeight: "600",
                }}
              >
                ✕
              </Text>
            </Pressable>
          </View>
        )}

        {/* Content */}
        <View style={styles.content}>{children}</View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: radius["2xl"],
    borderTopRightRadius: radius["2xl"],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 12,
  },
  handleContainer: {
    alignItems: "center",
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: spacing.xl,
  },
});
