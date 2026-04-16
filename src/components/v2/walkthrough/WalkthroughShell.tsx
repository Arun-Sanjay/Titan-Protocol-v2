import React from "react";
import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { HUDBackground } from "../../ui/AnimatedBackground";
import { colors, spacing, fonts, radius } from "../../../theme";
import { useWalkthroughStore } from "../../../stores/useWalkthroughStore";
import { useOnboardingStore } from "../../../stores/useOnboardingStore";
import { IDENTITIES } from "../../../stores/useIdentityStore";
import { getStarterMissions } from "../../../data/starter-missions";
import { WalkthroughIdentity } from "./WalkthroughIdentity";
import { WalkthroughEnginesOverview } from "./WalkthroughEnginesOverview";
import { WalkthroughEngineSetup } from "./WalkthroughEngineSetup";
import { WalkthroughHabits } from "./WalkthroughHabits";
import { WalkthroughJournal } from "./WalkthroughJournal";
import { WalkthroughGoals } from "./WalkthroughGoals";
import { WalkthroughTools } from "./WalkthroughTools";
import { WalkthroughProgression } from "./WalkthroughProgression";
import { WalkthroughSkillTrees } from "./WalkthroughSkillTrees";
import { WalkthroughAchievements } from "./WalkthroughAchievements";
import { WalkthroughSummary } from "./WalkthroughSummary";
import { useEngineStore } from "../../../stores/useEngineStore";
import { useCreateHabit } from "../../../hooks/queries/useHabits";
import { useCreateGoal } from "../../../hooks/queries/useGoals";
import { useIdentityStore } from "../../../stores/useIdentityStore";
import type { EngineKey } from "../../../db/schema";

const TOTAL_PAGES = 14;

const ENGINE_ORDER: EngineKey[] = ["body", "mind", "money", "charisma"];

function getProgressColor(identity: string | null): string {
  if (!identity || identity === "titan") return "#FFFFFF";
  const entry = IDENTITIES.find((i) => i.key === identity);
  if (!entry || entry.primaryEngine === "all") return "#FFFFFF";
  const engineKey = entry.primaryEngine as EngineKey;
  const engineColors: Record<EngineKey, string> = {
    body: colors.body,
    mind: colors.mind,
    money: colors.money,
    charisma: colors.charisma,
  };
  return engineColors[engineKey] ?? "#FFFFFF";
}

export function WalkthroughShell() {
  const router = useRouter();
  const page = useWalkthroughStore((s) => s.page);
  const next = useWalkthroughStore((s) => s.next);
  const back = useWalkthroughStore((s) => s.back);
  const finish = useWalkthroughStore((s) => s.finish);
  const addEngineTask = useWalkthroughStore((s) => s.addEngineTask);
  const engineTasks = useWalkthroughStore((s) => s.engineTasks);
  const habits = useWalkthroughStore((s) => s.habits);
  const goals = useWalkthroughStore((s) => s.goals);
  const pinnedTools = useWalkthroughStore((s) => s.pinnedTools);
  const identity = useOnboardingStore((s) => s.identity);
  const addTaskToEngine = useEngineStore((s) => s.addTask);
  const createHabitMutation = useCreateHabit();
  const createGoalMutation = useCreateGoal();
  const castVote = useIdentityStore((s) => s.castVote);

  const progressColor = getProgressColor(identity);
  const progressWidth = `${((page + 1) / TOTAL_PAGES) * 100}%`;

  const handleSkip = () => {
    Alert.alert(
      "Skip Setup?",
      "We'll load default starter missions for your archetype. You can always customize later.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Skip",
          style: "destructive",
          onPress: () => {
            // Apply default starter missions
            const missions = getStarterMissions(identity ?? "titan");
            for (const m of missions) {
              addEngineTask(m.engine, m);
            }
            finish();
            router.replace("/(tabs)");
          },
        },
      ],
    );
  };

  const handleFinish = () => {
    // 1. Create all engine tasks
    for (const engine of ENGINE_ORDER) {
      for (const task of engineTasks[engine]) {
        addTaskToEngine(engine, task.title, task.kind);
      }
    }
    // 2. Create habits (cloud — fire-and-forget)
    for (const h of habits) {
      createHabitMutation.mutate({
        title: h.title,
        icon: h.icon || "\u2713",
        engine: h.engine,
        triggerText: h.trigger,
      });
    }
    // 3. Create goals (cloud — fire-and-forget)
    for (const g of goals) {
      createGoalMutation.mutate({
        title: g.title,
      });
    }
    // 4. Save pinned tools + mark complete
    finish();
    // 5. Cast first identity vote
    castVote((identity as import("../../../stores/useIdentityStore").Archetype) ?? "titan");
    // 6. Navigate to main app
    router.replace("/(tabs)");
  };

  const renderPage = () => {
    switch (page) {
      case 0:
        return <WalkthroughIdentity onNext={next} />;
      case 1:
        return <WalkthroughEnginesOverview onNext={next} onBack={back} />;
      case 2:
        return <WalkthroughEngineSetup engine="body" onNext={next} onBack={back} />;
      case 3:
        return <WalkthroughEngineSetup engine="mind" onNext={next} onBack={back} />;
      case 4:
        return <WalkthroughEngineSetup engine="money" onNext={next} onBack={back} />;
      case 5:
        return <WalkthroughEngineSetup engine="charisma" onNext={next} onBack={back} />;
      case 6:
        return <WalkthroughHabits onNext={next} onBack={back} />;
      case 7:
        return <WalkthroughJournal onNext={next} onBack={back} />;
      case 8:
        return <WalkthroughGoals onNext={next} onBack={back} />;
      case 9:
        return <WalkthroughTools onNext={next} onBack={back} />;
      case 10:
        return <WalkthroughProgression onNext={next} onBack={back} />;
      case 11:
        return <WalkthroughSkillTrees onNext={next} onBack={back} />;
      case 12:
        return <WalkthroughAchievements onNext={next} onBack={back} />;
      case 13:
        return <WalkthroughSummary onFinish={handleFinish} onBack={back} />;
      default:
        return <View />;
    }
  };

  return (
    <View style={styles.root}>
      <HUDBackground />
      <SafeAreaView style={styles.safeArea}>
        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: progressWidth as any, backgroundColor: progressColor },
            ]}
          />
        </View>

        {/* Top nav row */}
        <View style={styles.topRow}>
          {page > 0 ? (
            <Pressable onPress={back} hitSlop={12} style={styles.backButton}>
              <Text style={styles.backText}>{"<"}</Text>
            </Pressable>
          ) : (
            <View style={styles.backPlaceholder} />
          )}

          <Pressable onPress={handleSkip} hitSlop={12}>
            <Text style={styles.skipText}>Skip Setup</Text>
          </Pressable>
        </View>

        {/* Page content */}
        <View style={styles.content}>{renderPage()}</View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safeArea: {
    flex: 1,
  },
  progressTrack: {
    height: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    width: "100%",
  },
  progressFill: {
    height: 2,
    borderRadius: 1,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  backButton: {
    paddingVertical: spacing.xs,
    paddingRight: spacing.md,
  },
  backText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
  backPlaceholder: {
    width: 30,
  },
  skipText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  content: {
    flex: 1,
  },
});
