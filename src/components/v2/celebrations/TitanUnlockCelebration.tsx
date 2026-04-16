import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  FadeIn,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, fonts } from "../../../theme";
import { ShareButton } from "./ShareButton";

type Props = {
  stats: { days: number; avgScore: number; totalXP: number; totalVotes: number };
  onActivate: () => void;
  onLater: () => void;
};

type Screen = 1 | 2 | 3 | 4;

export function TitanUnlockCelebration({ stats, onActivate, onLater }: Props) {
  const [screen, setScreen] = useState<Screen>(1);

  // Screen 1: auto-advance after 2s
  useEffect(() => {
    if (screen === 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const timer = setTimeout(() => setScreen(2), 2000);
      return () => clearTimeout(timer);
    }
  }, [screen]);

  // Screen 2: auto-advance after 3s
  useEffect(() => {
    if (screen === 2) {
      const timer = setTimeout(() => setScreen(3), 3000);
      return () => clearTimeout(timer);
    }
  }, [screen]);

  // Screen 1: "30 DAYS" + "85%+ AVERAGE"
  if (screen === 1) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Animated.Text entering={FadeIn.duration(600)} style={styles.statBig}>
            30 DAYS
          </Animated.Text>
          <Animated.Text entering={FadeIn.delay(400).duration(600)} style={styles.statSub}>
            85%+ AVERAGE
          </Animated.Text>
        </View>
      </View>
    );
  }

  // Screen 2: Cascading stats
  if (screen === 2) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <StatCascade label="Consecutive Days" value={`${stats.days}`} delay={0} />
          <StatCascade label="Average Score" value={`${stats.avgScore.toFixed(0)}%`} delay={500} />
          <StatCascade label="XP Earned" value={stats.totalXP.toLocaleString()} delay={1000} />
          <StatCascade label="Votes Cast" value={`${stats.totalVotes}`} delay={1500} />
        </View>
      </View>
    );
  }

  // Screen 3: "TITAN MODE" gold reveal
  if (screen === 3) {
    return (
      <View style={styles.container}>
        <Pressable style={styles.center} onPress={() => setScreen(4)}>
          <TitanReveal />
        </Pressable>
      </View>
    );
  }

  // Screen 4: Features + Activate
  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <Animated.Text entering={FadeIn.duration(400)} style={styles.earnedText}>
          You earned this.
        </Animated.Text>

        <Animated.View entering={FadeInUp.delay(300).duration(400)} style={styles.featureList}>
          <FeatureItem text="Equal 25% engine weighting — no hiding" delay={400} />
          <FeatureItem text="85% is the new baseline" delay={550} />
          <FeatureItem text="No streak freezes. Miss a day, reset." delay={700} />
          <FeatureItem text="Exclusive Titan Challenges" delay={850} />
          <FeatureItem text="Deep analytics + weakness detection" delay={1000} />
          <FeatureItem text="Gold accent theme" delay={1150} />
        </Animated.View>
      </View>

      <View style={styles.buttons}>
        <Animated.View entering={FadeIn.delay(1400).duration(400)} style={{ width: "100%" }}>
          <Pressable style={styles.activateBtn} onPress={onActivate}>
            <Text style={styles.activateBtnText}>ACTIVATE TITAN MODE</Text>
          </Pressable>
        </Animated.View>
        <Animated.View entering={FadeIn.delay(1600).duration(400)}>
          <Pressable onPress={onLater}>
            <Text style={styles.laterText}>Later</Text>
          </Pressable>
          <ShareButton type="titan_unlock" title="Titan Mode" subtitle="Unlocked" value={`${stats.days} days at ${stats.avgScore.toFixed(0)}%`} />
        </Animated.View>
      </View>
    </View>
  );
}

function StatCascade({ label, value, delay }: { label: string; value: string; delay: number }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(400)} style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </Animated.View>
  );
}

function TitanReveal() {
  const scale = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      scale.value = withSpring(1, { damping: 6, stiffness: 150 });
      glowOpacity.value = withDelay(
        400,
        withRepeat(
          withSequence(
            withTiming(0.6, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.2, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          false,
        ),
      );
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 400);
    }, 1000);
    return () => {
      clearTimeout(timer);
      cancelAnimation(scale);
      cancelAnimation(glowOpacity);
    };
  }, [scale, glowOpacity]);

  const titleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <View style={styles.revealCenter}>
      <Animated.View style={[styles.glow, glowStyle]} />
      <Animated.Text style={[styles.titanTitle, titleStyle]}>
        TITAN MODE
      </Animated.Text>
      <Animated.Text entering={FadeIn.delay(600).duration(400)} style={styles.unlockedText}>
        UNLOCKED
      </Animated.Text>
    </View>
  );
}

function FeatureItem({ text, delay }: { text: string; delay: number }) {
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(300)} style={styles.featureRow}>
      <Ionicons name="checkmark" size={14} color="#FFD700" />
      <Text style={styles.featureText}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing["2xl"] },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.xl },

  // Screen 1
  statBig: { fontSize: 48, fontWeight: "800", color: "#FFD700", letterSpacing: 6 },
  statSub: { fontSize: 18, fontWeight: "600", color: "rgba(255, 215, 0, 0.70)", letterSpacing: 3 },

  // Screen 2
  statRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder },
  statLabel: { fontSize: 14, fontWeight: "500", color: colors.textSecondary },
  statValue: { ...fonts.mono, fontSize: 18, fontWeight: "700", color: "#FFD700" },

  // Screen 3
  revealCenter: { alignItems: "center", gap: spacing.lg },
  glow: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "#FFD700" },
  titanTitle: { fontSize: 36, fontWeight: "900", color: "#FFD700", letterSpacing: 6 },
  unlockedText: { fontSize: 14, fontWeight: "700", color: "rgba(255, 215, 0, 0.70)", letterSpacing: 4 },

  // Screen 4
  earnedText: { fontSize: 20, fontWeight: "600", color: colors.text, marginBottom: spacing.lg },
  featureList: { width: "100%", gap: spacing.md },
  featureRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  featureText: { fontSize: 14, fontWeight: "400", color: colors.textSecondary, flex: 1 },
  buttons: { alignItems: "center", gap: spacing.lg, marginBottom: spacing["3xl"] },
  activateBtn: { paddingVertical: spacing.lg, borderRadius: 12, backgroundColor: "#FFD700", alignItems: "center", width: "100%" },
  activateBtnText: { fontSize: 16, fontWeight: "700", color: colors.bg, letterSpacing: 3 },
  laterText: { fontSize: 14, fontWeight: "500", color: colors.textMuted },
});
