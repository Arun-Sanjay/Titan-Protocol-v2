import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSequence,
  withSpring,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, fonts } from "../../../theme";
import { ShareButton } from "./ShareButton";
import type { BossChallenge } from "../../../types/boss-ui";

type Props = {
  challenge: BossChallenge;
  onClaim: () => void;
};

export function BossDefeatCelebration({ challenge, onClaim }: Props) {
  const [showContent, setShowContent] = useState(false);

  // Title animation: scale 2→1 with spring
  const titleScale = useSharedValue(2);
  const titleOpacity = useSharedValue(0);

  // Badge glow pulse
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    // 500ms pause, then slam in
    const timer = setTimeout(() => {
      setShowContent(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      titleOpacity.value = withDelay(0, withTiming(1, { duration: 200 }));
      titleScale.value = withDelay(0, withSpring(1, { damping: 8, stiffness: 200 }));

      // Badge glow starts after title
      glowOpacity.value = withDelay(600, withTiming(0.6, { duration: 400 }));
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ scale: titleScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  if (!showContent) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        {/* BOSS DEFEATED */}
        <Animated.Text style={[styles.title, titleStyle]}>
          BOSS DEFEATED
        </Animated.Text>

        {/* Challenge name */}
        <Animated.Text entering={FadeIn.delay(400).duration(400)} style={styles.challengeName}>
          {challenge.title}
        </Animated.Text>

        {/* Badge with glow */}
        <Animated.View entering={FadeIn.delay(600).duration(400)} style={styles.badgeWrap}>
          <Animated.View style={[styles.glow, glowStyle]} />
          <View style={styles.badge}>
            <Ionicons name="trophy" size={48} color={colors.warning} />
          </View>
        </Animated.View>

        {/* Stats */}
        <View style={styles.stats}>
          <StatRow label="Days" value={`${challenge.daysRequired}`} delay={800} />
          <StatRow label="Average" value={`${Math.round(challenge.dayResults.filter(Boolean).length / challenge.daysRequired * 100)}%`} delay={950} />
          <StatRow label="XP Earned" value={`+${challenge.xpReward}`} delay={1100} />
        </View>
      </View>

      {/* Claim button */}
      <Animated.View entering={FadeIn.delay(1400).duration(400)}>
        <Pressable style={styles.button} onPress={onClaim}>
          <Text style={styles.buttonText}>CLAIM REWARD</Text>
        </Pressable>
        <ShareButton type="boss" title={challenge.title} subtitle="Boss Defeated" value={`+${challenge.xpReward} XP`} />
      </Animated.View>
    </View>
  );
}

function StatRow({ label, value, delay }: { label: string; value: string; delay: number }) {
  return (
    <Animated.View entering={FadeIn.delay(delay).duration(300)} style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    paddingHorizontal: spacing["2xl"],
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.warning,
    letterSpacing: 4,
    textAlign: "center",
  },
  challengeName: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
  },
  badgeWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 100,
    height: 100,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 50,
    backgroundColor: colors.warning,
  },
  badge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    borderWidth: 2,
    borderColor: colors.warning,
    alignItems: "center",
    justifyContent: "center",
  },
  stats: {
    width: "100%",
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  statValue: {
    ...fonts.mono,
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  button: {
    paddingVertical: spacing.lg,
    borderRadius: 12,
    backgroundColor: colors.warning,
    alignItems: "center",
    marginBottom: spacing["3xl"],
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.bg,
    letterSpacing: 3,
  },
});
