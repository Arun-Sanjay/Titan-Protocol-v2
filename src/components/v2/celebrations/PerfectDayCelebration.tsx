import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withSequence, withTiming, withDelay, Easing } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts } from "../../../theme";
import { ShareButton } from "./ShareButton";

type Props = {
  xpAmount: number;
  onClaim: () => void;
};

export function PerfectDayCelebration({ xpAmount, onClaim }: Props) {
  const [displayXP, setDisplayXP] = useState(0);
  const titleScale = useSharedValue(0);

  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    titleScale.value = withDelay(
      400,
      withSequence(
        withTiming(1.2, { duration: 300, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 200 }),
      ),
    );

    // Slot machine counter: overshoot then settle
    const overshoot = xpAmount + Math.floor(Math.random() * 100) + 50;
    const stepDuration = 15;
    let current = 0;
    const phase1Duration = 800; // Count up to overshoot
    const steps1 = Math.floor(phase1Duration / stepDuration);
    const increment1 = overshoot / steps1;

    const timer = setTimeout(() => {
      let step = 0;
      const interval = setInterval(() => {
        step++;
        if (step <= steps1) {
          current = Math.round(increment1 * step);
          setDisplayXP(current);
        } else if (step <= steps1 + 10) {
          // Settle down to actual value
          const progress = (step - steps1) / 10;
          current = Math.round(overshoot - (overshoot - xpAmount) * progress);
          setDisplayXP(current);
        } else {
          setDisplayXP(xpAmount);
          clearInterval(interval);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }, stepDuration);
    }, 600);

    return () => clearTimeout(timer);
  }, [xpAmount]);

  const titleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: titleScale.value }],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <Animated.Text style={[styles.title, titleStyle]}>
          PERFECT DAY
        </Animated.Text>

        <Animated.Text entering={FadeIn.delay(800).duration(400)} style={styles.subtitle}>
          100% across all engines
        </Animated.Text>

        <Animated.View entering={FadeIn.delay(600).duration(400)} style={styles.xpContainer}>
          <Text style={styles.xpPlus}>+</Text>
          <Text style={styles.xpValue}>{displayXP}</Text>
          <Text style={styles.xpLabel}>XP</Text>
        </Animated.View>

        <Animated.Text entering={FadeIn.delay(1800).duration(400)} style={styles.flavor}>
          Flawless execution.
        </Animated.Text>
      </View>

      <Animated.View entering={FadeIn.delay(2200).duration(400)}>
        <Pressable style={styles.button} onPress={onClaim}>
          <Text style={styles.buttonText}>CLAIM</Text>
        </Pressable>
        <ShareButton type="perfect_day" title="Perfect Day" subtitle="100% across all engines" value={`+${xpAmount} XP`} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing["2xl"] },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.xl },
  title: { fontSize: 32, fontWeight: "800", color: colors.warning, letterSpacing: 6 },
  subtitle: { fontSize: 16, fontWeight: "400", color: colors.textSecondary },
  xpContainer: { flexDirection: "row", alignItems: "baseline", gap: spacing.xs },
  xpPlus: { ...fonts.monoLarge, fontSize: 32, color: colors.success },
  xpValue: { ...fonts.monoLarge, fontSize: 56, color: colors.success },
  xpLabel: { fontSize: 18, fontWeight: "700", color: colors.success },
  flavor: { fontSize: 14, fontWeight: "400", fontStyle: "italic", color: colors.textMuted },
  button: { paddingVertical: spacing.lg, borderRadius: 12, backgroundColor: colors.warning, alignItems: "center", marginBottom: spacing["3xl"] },
  buttonText: { fontSize: 16, fontWeight: "700", color: colors.bg, letterSpacing: 3 },
});
