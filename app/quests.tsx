import React, { useEffect, useMemo } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import { colors, spacing, fonts } from "../src/theme";
import { PageHeader } from "../src/components/ui/PageHeader";
import { SectionHeader } from "../src/components/ui/SectionHeader";
import { QuestCard } from "../src/components/v2/quests/QuestCard";
import { BossChallengeCard } from "../src/components/v2/quests/BossChallengeCard";
import { useQuestStore } from "../src/stores/useQuestStore";
import { useProgressionStore } from "../src/stores/useProgressionStore";
import { useIdentityStore } from "../src/stores/useIdentityStore";
import { useModeStore } from "../src/stores/useModeStore";
import { getTodayKey } from "../src/lib/date";

function getWeekLabel(): string {
  const now = new Date();
  const monday = new Date(now);
  const day = monday.getDay();
  const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
  monday.setDate(diff);
  return monday.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function QuestsScreen() {
  const router = useRouter();
  const weeklyQuests = useQuestStore((s) => s.weeklyQuests);
  const bossChallenge = useQuestStore((s) => s.bossChallenge);
  const generateQuests = useQuestStore((s) => s.generateWeeklyQuests);
  const startBoss = useQuestStore((s) => s.startBossChallenge);
  const phase = useProgressionStore((s) => s.currentPhase);
  const archetype = useIdentityStore((s) => s.archetype);
  const phaseLabel = useProgressionStore((s) => s.getPhaseInfo().label);
  const currentWeek = useProgressionStore((s) => s.currentWeek);
  const isTitanMode = useModeStore((s) => s.mode) === "titan";
  const getAvailableBoss = useQuestStore((s) => s.getAvailableBoss);
  const availableBoss = useMemo(
    () => (!bossChallenge || (!bossChallenge.active && !bossChallenge.completed))
      ? getAvailableBoss(phase, currentWeek, isTitanMode)
      : null,
    [bossChallenge, phase, currentWeek, isTitanMode],
  );

  // Auto-generate quests if none exist
  useEffect(() => {
    if (weeklyQuests.length === 0 && archetype) {
      generateQuests(phase, archetype);
    }
  }, [weeklyQuests.length, phase, archetype]);

  const activeQuests = useMemo(() => weeklyQuests.filter((q) => q.status === "active"), [weeklyQuests]);
  const completedQuests = useMemo(() => weeklyQuests.filter((q) => q.status === "completed"), [weeklyQuests]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PageHeader
          kicker="QUEST BOARD"
          title="Quests"
          subtitle={`Week of ${getWeekLabel()} · ${phaseLabel}`}
        />

        {/* Active Quests */}
        {activeQuests.length > 0 && (
          <>
            <SectionHeader title="ACTIVE" right={`${activeQuests.length}`} />
            {activeQuests.map((q, idx) => (
              <View key={q.id} style={styles.questWrap}>
                <QuestCard quest={q} delay={idx * 80} />
              </View>
            ))}
          </>
        )}

        {/* Completed Quests */}
        {completedQuests.length > 0 && (
          <>
            <SectionHeader title="COMPLETED" right={`${completedQuests.length}`} />
            {completedQuests.map((q, idx) => (
              <View key={q.id} style={styles.questWrap}>
                <QuestCard quest={q} delay={idx * 80 + 300} />
              </View>
            ))}
          </>
        )}

        {/* Empty state */}
        {weeklyQuests.length === 0 && (
          <Animated.View entering={FadeIn.duration(400)} style={styles.empty}>
            <Ionicons name="flag-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No quests this week</Text>
            <Text style={styles.emptyHint}>Quests generate every Monday</Text>
          </Animated.View>
        )}

        {/* Boss Challenge */}
        <SectionHeader title="BOSS CHALLENGE" />
        {bossChallenge && (bossChallenge.active || bossChallenge.completed) ? (
          <BossChallengeCard challenge={bossChallenge} delay={400} />
        ) : bossChallenge && bossChallenge.failed ? (
          <BossChallengeCard
            challenge={bossChallenge}
            onAccept={() => {
              startBoss({
                id: bossChallenge.id,
                title: bossChallenge.title,
                description: bossChallenge.description,
                requirement: bossChallenge.requirement,
                daysRequired: bossChallenge.daysRequired,
                xpReward: bossChallenge.xpReward,
              });
            }}
            delay={400}
          />
        ) : availableBoss ? (
          <BossChallengeCard
            challenge={{
              id: availableBoss.id,
              title: availableBoss.title,
              description: availableBoss.description,
              requirement: availableBoss.requirement,
              daysRequired: availableBoss.daysRequired,
              currentDay: 0,
              dayResults: [],
              xpReward: availableBoss.xpReward,
              active: false,
              completed: false,
              failed: false,
            }}
            onAccept={() => {
              startBoss({
                id: availableBoss.id,
                title: availableBoss.title,
                description: availableBoss.description,
                requirement: availableBoss.requirement,
                daysRequired: availableBoss.daysRequired,
                xpReward: availableBoss.xpReward,
              });
            }}
            delay={400}
          />
        ) : (
          <Animated.View entering={FadeIn.delay(400).duration(400)} style={styles.bossLocked}>
            <Ionicons name="lock-closed-outline" size={24} color={colors.textMuted} />
            <Text style={styles.bossLockedText}>
              {phase === "foundation" ? "Next boss: Week 6 (Building Phase)" : "No boss available yet"}
            </Text>
          </Animated.View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg },
  questWrap: { marginBottom: spacing.md },
  empty: { alignItems: "center", paddingVertical: spacing["4xl"], gap: spacing.md },
  emptyText: { fontSize: 16, fontWeight: "600", color: colors.text },
  emptyHint: { fontSize: 13, color: colors.textMuted },
  bossLocked: {
    alignItems: "center", paddingVertical: spacing["3xl"], gap: spacing.md,
    borderRadius: 12, borderWidth: 1, borderColor: colors.surfaceBorder, borderStyle: "dashed",
  },
  bossLockedText: { fontSize: 13, color: colors.textMuted },
});
