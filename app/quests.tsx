import React, { useMemo } from "react";
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
// Phase 4.1: weekly quests + boss challenges both cloud-backed
import { useActiveQuests } from "../src/hooks/queries/useQuests";
import {
  useActiveBossChallenges,
  useStartBossChallenge,
} from "../src/hooks/queries/useBossChallenges";
import type { BossChallenge as CloudBoss } from "../src/services/boss-challenges";
import { useProgression } from "../src/hooks/queries/useProgression";
import { useIdentityStore } from "../src/stores/useIdentityStore";
import { useModeStore } from "../src/stores/useModeStore";
import bossDefinitions from "../src/data/boss-challenges.json";

// Local Quest shape for QuestCard component
type LocalQuest = {
  id: string;
  templateId?: string;
  type: "engine" | "cross_engine" | "wildcard";
  title: string;
  description: string;
  targetType: "score" | "streak" | "completion" | "rank";
  targetValue: number;
  currentValue: number;
  xpReward: number;
  status: "active" | "completed" | "failed";
  createdAt: string;
  completedAt?: string;
};

type BossDef = {
  id: string;
  title: string;
  description: string;
  requirement: string;
  phase: string;
  unlockWeek: number | null;
  daysRequired: number;
  xpReward: number;
  titanOnly: boolean;
  evaluator: string;
  evaluatorThreshold: number;
  evaluatorEngine?: string;
};

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

  // Phase 4.1: weekly quests from cloud React Query hook
  const { data: cloudQuests = [] } = useActiveQuests();
  // Map cloud Quest (snake_case) → local Quest shape for QuestCard component
  const weeklyQuests: LocalQuest[] = useMemo(() => cloudQuests.map((q) => ({
    id: q.id,
    templateId: undefined,
    type: (q.type ?? "engine") as LocalQuest["type"],
    title: q.title,
    description: q.description ?? "",
    targetType: "completion" as const,
    targetValue: q.target,
    currentValue: q.progress,
    xpReward: q.xp_reward,
    status: q.status as LocalQuest["status"],
    createdAt: q.created_at,
    completedAt: q.status === "completed" ? q.updated_at : undefined,
  })), [cloudQuests]);

  // Phase 4.1: boss challenges now cloud-backed via React Query
  const { data: activeBosses = [] } = useActiveBossChallenges();
  const startBossMutation = useStartBossChallenge();
  // Map cloud boss to the shape BossChallengeCard expects
  const bossChallenge = useMemo(() => {
    const active = activeBosses[0];
    if (!active) return null;
    const dayResults = Array.isArray(active.day_results) ? (active.day_results as boolean[]) : [];
    return {
      id: active.boss_id,
      title: (bossDefinitions as BossDef[]).find((d) => d.id === active.boss_id)?.title ?? "Boss",
      description: (bossDefinitions as BossDef[]).find((d) => d.id === active.boss_id)?.description ?? "",
      requirement: (bossDefinitions as BossDef[]).find((d) => d.id === active.boss_id)?.requirement ?? "",
      daysRequired: active.days_required,
      currentDay: dayResults.length,
      dayResults,
      xpReward: (bossDefinitions as BossDef[]).find((d) => d.id === active.boss_id)?.xpReward ?? 200,
      active: active.status === "active",
      completed: active.status === "defeated",
      failed: active.status === "failed",
    };
  }, [activeBosses]);

  // Phase 4.1: progression from cloud React Query hook
  const { data: progression } = useProgression();
  const phase = progression?.current_phase ?? "foundation";
  const currentWeek = progression?.current_week ?? 1;

  const archetype = useIdentityStore((s) => s.archetype);
  const isTitanMode = useModeStore((s) => s.mode) === "titan";

  // Phase label derived from cloud progression
  const PHASE_LABELS: Record<string, string> = {
    foundation: "FOUNDATION PHASE",
    building: "BUILDING PHASE",
    intensify: "INTENSIFY PHASE",
    sustain: "SUSTAIN PHASE",
  };
  const phaseLabel = PHASE_LABELS[phase] ?? "FOUNDATION PHASE";

  // Phase 4.1: derive available boss from static definitions
  const availableBoss = useMemo(() => {
    if (bossChallenge && (bossChallenge.active || bossChallenge.completed)) return null;
    const defs = bossDefinitions as BossDef[];
    return defs.find((d) => {
      if (d.titanOnly && !isTitanMode) return false;
      if (d.phase !== phase) return false;
      if (d.unlockWeek !== null && currentWeek < d.unlockWeek) return false;
      // Skip bosses the user already completed
      const alreadyDone = activeBosses.some(
        (b) => b.boss_id === d.id && (b.status === "defeated"),
      );
      return !alreadyDone;
    }) ?? null;
  }, [bossChallenge, phase, currentWeek, isTitanMode, activeBosses]);

  // React Query auto-fetches — no need for useEffect load calls
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
              const def = (bossDefinitions as BossDef[]).find((d) => d.id === bossChallenge.id);
              startBossMutation.mutate({
                bossId: bossChallenge.id,
                daysRequired: bossChallenge.daysRequired,
                evaluatorType: def?.evaluator ?? "titan_score",
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
              startBossMutation.mutate({
                bossId: availableBoss.id,
                daysRequired: availableBoss.daysRequired,
                evaluatorType: availableBoss.evaluator,
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
