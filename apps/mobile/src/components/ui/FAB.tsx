import React from "react";
import { StyleSheet, Pressable, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors } from "../../theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  onPress: () => void;
};

export function FAB({ onPress }: Props) {
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotation.value}deg` }],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scale.value = withSequence(
      withTiming(0.85, { duration: 80 }),
      withTiming(1.05, { duration: 120 }),
      withTiming(1, { duration: 100 })
    );
    rotation.value = withSequence(
      withTiming(90, { duration: 200 }),
      withTiming(0, { duration: 0 })
    );
    onPress();
  };

  return (
    <AnimatedPressable onPress={handlePress} style={[styles.fab, animStyle]}>
      <Text style={styles.icon}>+</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  icon: {
    fontSize: 32,
    fontWeight: "300",
    color: "#000",
    marginTop: -2,
  },
});
