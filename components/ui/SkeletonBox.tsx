import React, { useEffect } from "react";
import { ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../../hooks/use-theme";

interface SkeletonBoxProps {
  width?: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonBox({
  width = "100%",
  height,
  borderRadius = 8,
  style,
}: SkeletonBoxProps) {
  const { colors } = useTheme();
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.35, {
        duration: 750,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: width as ViewStyle["width"],
          height,
          borderRadius,
          backgroundColor: colors.borderSoft,
        },
        animStyle,
        style,
      ]}
    />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  const { spacing } = require("../../constants/theme");
  return (
    <Animated.View style={{ gap: spacing.sm }}>
      <SkeletonBox height={18} width="60%" />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox key={i} height={14} width={i === lines - 1 ? "40%" : "100%"} />
      ))}
    </Animated.View>
  );
}
