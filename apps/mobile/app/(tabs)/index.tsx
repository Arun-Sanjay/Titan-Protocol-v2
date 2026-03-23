import React, { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "../../src/theme";
import { PowerRing } from "../../src/components/ui/PowerRing";
import { XPBar } from "../../src/components/ui/XPBar";
import { StreakBadge } from "../../src/components/ui/StreakBadge";
import { EngineCard } from "../../src/components/ui/EngineCard";
import { MissionRow } from "../../src/components/ui/MissionRow";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { getTodayKey, getGreeting } from "../../src/lib/date";
import {
  getTotalScore,
  getAllEngineScores,
  getAllTasksForDate,
  toggleTask,
  type TaskWithStatus,
} from "../../src/db/engine";
import {
  getProfile,
  awardXP,
  updateStreak,
  XP_REWARDS,
} from "../../src/db/gamification";
import type { UserProfile } from "../../src/db/schema";
import type { EngineKey } from "../../src/db/schema";

export default function HQScreen() {
  const router = useRouter();
  const dateKey = getTodayKey();

  const [totalScore, setTotalScore] = useState(0);
  const [engineScores, setEngineScores] = useState<Record<EngineKey, number>>({
    body: 0,
    mind: 0,
    money: 0,
    general: 0,
  });
  const [tasks, setTasks] = useState<TaskWithStatus[]>([]);
  const [profile, setProfile] = useState<UserProfile>({
    id: "default",
    xp: 0,
    level: 1,
    streak: 0,
    best_streak: 0,
    last_active_date: "",
  });
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [score, scores, allTasks, prof] = await Promise.all([
        getTotalScore(dateKey),
        getAllEngineScores(dateKey),
        getAllTasksForDate(dateKey),
        getProfile(),
      ]);
      setTotalScore(score);
      setEngineScores(scores);
      setTasks(allTasks);
      setProfile(prof);
    } catch (err) {
      console.error("[HQ] loadData failed:", err);
    }
  }, [dateKey]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleToggle = async (task: TaskWithStatus) => {
    if (busy) return;
    setBusy(true);
    try {
      const completed = await toggleTask(task.engine, task.id!, dateKey);
      if (completed) {
        const xp = task.kind === "main" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST;
        await awardXP(dateKey, "task_complete", xp);
        await updateStreak(dateKey);
      }
      await loadData();
    } catch (err) {
      console.error("[HQ] toggle failed:", err);
    } finally {
      setBusy(false);
    }
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const engineCounts = (engine: EngineKey) => {
    const engineTasks = tasks.filter((t) => t.engine === engine);
    return {
      completed: engineTasks.filter((t) => t.completed).length,
      total: engineTasks.length,
    };
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {/* Greeting */}
        <Text style={styles.greeting}>{getGreeting()}</Text>

        {/* XP Bar */}
        <View style={styles.xpWrap}>
          <XPBar xp={profile.xp} level={profile.level} />
        </View>

        {/* Power Ring */}
        <View style={styles.ringWrap}>
          <PowerRing score={totalScore} size={200} />
        </View>

        {/* Streak */}
        <StreakBadge streak={profile.streak} />

        {/* Engine Cards */}
        <SectionHeader title="Engines" />
        <View style={styles.engineGrid}>
          {(["body", "mind", "money", "general"] as EngineKey[]).map((engine) => {
            const counts = engineCounts(engine);
            return (
              <EngineCard
                key={engine}
                engine={engine}
                score={engineScores[engine]}
                completedCount={counts.completed}
                totalCount={counts.total}
                onPress={() => router.push(`/engine/${engine}`)}
              />
            );
          })}
        </View>

        {/* Today's Missions */}
        <SectionHeader
          title="Today's Missions"
          right={`${completedCount}/${tasks.length}`}
        />

        {tasks.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎯</Text>
            <Text style={styles.emptyText}>No missions yet</Text>
            <Text style={styles.emptyHint}>
              Go to an engine and add your first mission
            </Text>
          </View>
        ) : (
          tasks.map((task) => (
            <MissionRow
              key={task.id}
              title={task.title}
              xp={task.kind === "main" ? XP_REWARDS.MAIN_TASK : XP_REWARDS.SIDE_QUEST}
              completed={task.completed}
              kind={task.kind}
              onToggle={() => handleToggle(task)}
            />
          ))
        )}

        {/* Bottom spacer */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.lg,
  },
  xpWrap: {
    marginTop: spacing.lg,
  },
  ringWrap: {
    alignItems: "center",
    marginTop: spacing["2xl"],
    marginBottom: spacing.lg,
  },
  engineGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  empty: {
    alignItems: "center",
    paddingVertical: spacing["4xl"],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
  emptyHint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
