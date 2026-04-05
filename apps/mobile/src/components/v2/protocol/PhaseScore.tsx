import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts } from "../../../theme";
import { useProtocolStore, type PhaseResult } from "../../../stores/useProtocolStore";
import { useIdentityStore, selectIdentityMeta } from "../../../stores/useIdentityStore";
import { calculateRank, getRankColor } from "../../../lib/scoring-v2";
import { handleProtocolCompletion } from "../../../lib/protocol-completion";
import { getTodayKey, addDays } from "../../../lib/date";
import { ShareButton } from "../celebrations/ShareButton";
import { RankCeremony } from "../../ui/RankCeremony";
import { RankPromotionCinematic } from "../story/RankPromotionCinematic";
import { getJSON } from "../../../db/storage";
import { useRankStore } from "../../../stores/useRankStore";

function computeProtocolScore(phases: PhaseResult[]): number {
  let score = 0;

  for (const p of phases) {
    switch (p.phase) {
      case "intention":
        if (p.completed) score += 15;
        break;
      case "mind_check":
        if (p.completed) {
          const data = p.data as { correct?: boolean } | undefined;
          score += data?.correct ? 40 : 15;
        }
        break;
      case "engine_pulse":
        if (p.completed) score += 15;
        break;
      case "habit_confirm":
        if (p.completed) {
          const data = p.data as { completed?: number; total?: number } | undefined;
          if (data && data.total && data.total > 0) {
            score += Math.round((data.completed! / data.total) * 30);
          }
        }
        break;
    }
  }

  return Math.min(100, score);
}

export function PhaseScore() {
  const router = useRouter();
  const phaseResults = useProtocolStore((s) => s.phaseResults);
  const archetype = useIdentityStore((s) => s.archetype);
  const totalVotes = useIdentityStore((s) => s.totalVotes);
  const streakCurrent = useProtocolStore((s) => s.streakCurrent);
  const streakLastDate = useProtocolStore((s) => s.streakLastDate);
  const meta = selectIdentityMeta(archetype);

  // Compute expected streak after completion
  const expectedStreak = useMemo(() => {
    const today = getTodayKey();
    if (!streakLastDate) return 1;
    if (streakLastDate === today) return streakCurrent; // Already recorded today
    const yesterday = addDays(today, -1);
    return streakLastDate === yesterday ? streakCurrent + 1 : 1;
  }, [streakCurrent, streakLastDate]);

  const finalScore = useMemo(() => computeProtocolScore(phaseResults), [phaseResults]);
  const rank = useMemo(() => calculateRank(finalScore), [finalScore]);
  const rankColor = useMemo(() => getRankColor(rank), [rank]);

  // Animated score counter
  const [displayScore, setDisplayScore] = useState(0);
  const rankScale = useSharedValue(1.5);
  const rankOpacity = useSharedValue(0);

  useEffect(() => {
    // Rank letter animation: scale 1.5→1 after score counts up
    rankOpacity.value = withDelay(900, withTiming(1, { duration: 300 }));
    rankScale.value = withDelay(
      900,
      withSequence(
        withTiming(1.5, { duration: 0 }),
        withTiming(1, { duration: 400, easing: Easing.out(Easing.back(2)) }),
      ),
    );

    // Count up score over 800ms
    if (finalScore === 0) {
      setDisplayScore(0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    const duration = 800;
    const stepDuration = duration / finalScore;
    let current = 0;
    const interval = setInterval(() => {
      current++;
      setDisplayScore(current);
      if (current >= finalScore) {
        clearInterval(interval);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [finalScore]);

  const rankStyle = useAnimatedStyle(() => ({
    opacity: rankOpacity.value,
    transform: [{ scale: rankScale.value }],
  }));

  // XP for protocol
  const xpEarned = Math.round(finalScore * 0.5) + 10; // Base 10 + 0.5 per score point

  // Rank ceremony state
  const [showRankCeremony, setShowRankCeremony] = useState(false);
  const [showRankPromotion, setShowRankPromotion] = useState(false);
  const [completionResult, setCompletionResult] = useState<ReturnType<typeof handleProtocolCompletion> | null>(null);

  // Track rank BEFORE protocol completion for promotion detection.
  // Must use a ref because evaluateDay() updates the store during handleDone(),
  // which would change a selector-based value before we can read it.
  const previousRankRef = useRef(useRankStore.getState().rank);

  // Get yesterday's score for rank comparison
  const yesterdayScore = useMemo(() => {
    const yesterday = addDays(getTodayKey(), -1);
    const comp = getJSON<{ score?: number } | null>(`protocol_completions:${yesterday}`, null);
    return comp?.score;
  }, []);

  function handleDone() {
    const result = handleProtocolCompletion(finalScore, xpEarned);
    // Show rank ceremony first, then proceed to celebration cascade
    setCompletionResult(result);
    setShowRankCeremony(true);
  }

  function handleRankCeremonyDismiss() {
    setShowRankCeremony(false);
    if (!completionResult) { router.back(); return; }
    const result = completionResult;

    // Check for progression rank promotion/demotion FIRST
    if (result.rankResult.promoted || result.rankResult.demoted) {
      setShowRankPromotion(true);
      return;
    }

    proceedToCelebrations(result);
  }

  function handleRankPromotionDismiss() {
    setShowRankPromotion(false);
    if (!completionResult) { router.back(); return; }
    proceedToCelebrations(completionResult);
  }

  function proceedToCelebrations(result: ReturnType<typeof handleProtocolCompletion>) {
    if (result.titanUnlocked) {
      router.replace("/(modals)/titan-unlock");
    } else if (result.bossDefeated && result.defeatedBoss) {
      router.replace({
        pathname: "/(modals)/boss-challenge",
        params: {
          title: result.defeatedBoss.title,
          daysRequired: String(result.defeatedBoss.daysRequired),
          xpReward: String(result.defeatedBoss.xpReward),
        },
      });
    } else if (result.phaseTransition) {
      const pt = result.phaseTransition;
      router.replace({
        pathname: "/(modals)/phase-transition",
        params: {
          oldPhase: pt.oldPhase,
          newPhase: pt.newPhase,
          avgScore: String(pt.avgScore),
          daysCompleted: String(pt.daysCompleted),
          totalDays: String(pt.totalDays),
          bestStreak: String(pt.bestStreak),
          bestRank: pt.bestRank,
        },
      });
    } else if (result.perfectDay) {
      router.replace({
        pathname: "/(modals)/perfect-day",
        params: { xp: String(result.perfectDayXP) },
      });
    } else if (result.achievementsUnlocked.length > 0) {
      router.replace("/(modals)/achievement-popup");
    } else {
      router.back();
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        {/* Protocol Complete */}
        <Animated.Text entering={FadeIn.duration(400)} style={styles.title}>
          PROTOCOL COMPLETE
        </Animated.Text>

        {/* Score counter */}
        <Text style={styles.score}>{displayScore}</Text>

        {/* Rank letter */}
        <Animated.Text style={[styles.rank, { color: rankColor }, rankStyle]}>
          {rank}
        </Animated.Text>

        {/* Identity vote */}
        <Animated.View entering={FadeIn.delay(1200).duration(400)} style={styles.voteRow}>
          <Text style={styles.voteText}>
            You showed up as {meta?.name ?? "yourself"} today.
          </Text>
          <Text style={styles.voteCount}>
            Vote {totalVotes + 1}
          </Text>
        </Animated.View>

        {/* Streak */}
        <Animated.View entering={FadeIn.delay(1500).duration(400)} style={styles.streakRow}>
          {expectedStreak >= 3 && <Text style={styles.fire}>🔥</Text>}
          <Text style={styles.streakText}>
            {expectedStreak}-day streak
          </Text>
        </Animated.View>

        {/* XP */}
        <Animated.Text entering={FadeIn.delay(1800).duration(400)} style={styles.xp}>
          +{xpEarned} XP
        </Animated.Text>
      </View>

      {/* Done button */}
      <Animated.View entering={FadeIn.delay(2100).duration(400)}>
        <Pressable style={styles.button} onPress={handleDone}>
          <Text style={styles.buttonText}>DONE</Text>
        </Pressable>
        <ShareButton type="score" title="Protocol Complete" value={`${finalScore}% — ${rank} Rank`} />
      </Animated.View>

      {/* Rank Ceremony overlay (daily D-SS) */}
      {showRankCeremony && (
        <RankCeremony
          score={finalScore}
          previousScore={yesterdayScore}
          onDismiss={handleRankCeremonyDismiss}
        />
      )}

      {/* Rank Promotion Cinematic (progression Initiate→Titan) */}
      {showRankPromotion && completionResult && (
        <RankPromotionCinematic
          previousRank={previousRankRef.current}
          newRank={completionResult.rankResult.promoted
            ? (completionResult.rankResult.newRank ?? previousRankRef.current)
            : (completionResult.rankResult.demotedTo ?? previousRankRef.current)}
          isDemotion={completionResult.rankResult.demoted}
          onDismiss={handleRankPromotionDismiss}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.lg,
  },
  title: {
    ...fonts.kicker,
    fontSize: 12,
    letterSpacing: 4,
    marginBottom: spacing.lg,
  },
  score: {
    ...fonts.monoLarge,
    fontSize: 48,
    fontWeight: "300",
  },
  rank: {
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: 2,
  },
  voteRow: {
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xl,
  },
  voteText: {
    fontSize: 14,
    fontWeight: "400",
    color: colors.textSecondary,
    textAlign: "center",
  },
  voteCount: {
    ...fonts.kicker,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  fire: {
    fontSize: 20,
  },
  streakText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  xp: {
    ...fonts.mono,
    fontSize: 16,
    fontWeight: "700",
    color: colors.success,
  },
  button: {
    paddingVertical: spacing.lg,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    marginBottom: spacing["2xl"],
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.bg,
    letterSpacing: 3,
  },
});
