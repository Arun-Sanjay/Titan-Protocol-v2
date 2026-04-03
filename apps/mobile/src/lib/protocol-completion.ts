/**
 * Protocol completion orchestration
 *
 * Called when the user presses DONE on PhaseScore.
 * Coordinates all post-protocol side effects across stores.
 */

import { useProtocolStore } from "../stores/useProtocolStore";
import { useIdentityStore, selectIdentityMeta } from "../stores/useIdentityStore";
import { useProfileStore, XP_REWARDS } from "../stores/useProfileStore";
import { useModeStore } from "../stores/useModeStore";
import { useTitanModeStore } from "../stores/useTitanModeStore";
import { useProgressionStore } from "../stores/useProgressionStore";
import { useNarrativeStore } from "../stores/useNarrativeStore";
import { useAchievementStore } from "../stores/useAchievementStore";
import { useHabitStore } from "../stores/useHabitStore";
import { useMindTrainingStore } from "../stores/useMindTrainingStore";
import { getJSON, setJSON } from "../db/storage";
import { useQuestStore } from "../stores/useQuestStore";
import { useEngineStore, ENGINES } from "../stores/useEngineStore";
import { calculateWeightedTitanScore } from "./scoring-v2";
import { evaluateAllTrees } from "./skill-tree-evaluator";
import { checkAllAchievements, type AppState as AchievementAppState } from "./achievement-checker";
import { generateNarrativeEntry } from "./narrative-writer";
import { cancelStreakWarning, cancelBossReminder, scheduleQuestDeadline, scheduleBossReminder } from "./notifications";
import { getTodayKey } from "./date";
import { applyMomentum } from "./momentum";
import { recordCompletion as recordIntegrity } from "./protocol-integrity";
import { useStatStore } from "../stores/useStatStore";
import { useRankStore } from "../stores/useRankStore";
import { useTitleStore } from "../stores/useTitleStore";
import { useFieldOpStore } from "../stores/useFieldOpStore";
import achievementDefsJson from "../data/achievements.json";

/**
 * Handle all post-protocol side effects.
 * Should be called from PhaseScore DONE button.
 */
export type DefeatedBossInfo = {
  title: string;
  daysRequired: number;
  dayResults: boolean[];
  xpReward: number;
};

export type ProtocolCompletionResult = {
  bossDefeated: boolean;
  defeatedBoss: DefeatedBossInfo | null;
  perfectDay: boolean;
  perfectDayXP: number;
  phaseTransition: {
    oldPhase: string;
    newPhase: string;
    avgScore: number;
    daysCompleted: number;
    totalDays: number;
    bestStreak: number;
    bestRank: string;
  } | null;
  skillNodesUnlocked: { nodeId: string; name: string; branch: string; level: number; engine: string }[];
  achievementsUnlocked: string[];
  titanUnlocked: boolean;
  momentumMultiplier: number;
  momentumBonusXP: number;
  statMilestones: Array<{ engine: import("../db/schema").EngineKey; milestone: number }>;
  rankResult: {
    promoted: boolean;
    newRank?: import("./ranks-v2").Rank;
    warning: boolean;
    demoted: boolean;
    demotedTo?: import("./ranks-v2").Rank;
  };
  fieldOpResult: string | null;
  titlesUnlocked: Array<{ id: string; name: string; rarity: string }>;
};

export function handleProtocolCompletion(protocolScore: number, xpEarned: number): ProtocolCompletionResult {
  const today = getTodayKey();

  // 1. Finish protocol (persists completion + updates streak)
  useProtocolStore.getState().finishProtocol(protocolScore);

  // 1b. Record protocol integrity (forgiving streak system)
  recordIntegrity();

  // 2. Cast identity vote
  useIdentityStore.getState().castVote();

  // 3. Award XP with momentum multiplier
  const streak = useProtocolStore.getState().streakCurrent;
  const { finalXP, multiplier: momentumMultiplier, bonusXP: momentumBonusXP } = applyMomentum(xpEarned, streak);
  useProfileStore.getState().awardXP(today, "protocol_complete", finalXP);
  useProfileStore.getState().updateStreak(today);

  // 4. Get current engine scores for Titan Score
  const scores = useEngineStore.getState().scores;
  const engineScores: Record<string, number> = {};
  for (const engine of ENGINES) {
    engineScores[engine] = scores[`${engine}:${today}`] ?? 0;
  }

  // 5. Calculate weighted Titan Score (respecting Focus mode active engines)
  const archetype = useIdentityStore.getState().archetype;
  const mode = useModeStore.getState().mode;
  const focusEngines = useModeStore.getState().focusEngines;
  const isTitanMode = mode === "titan";
  const activeEngines = mode === "focus" && focusEngines.length > 0 ? focusEngines : undefined;
  const titanScore = calculateWeightedTitanScore(engineScores, archetype, isTitanMode, activeEngines);

  // 6. Record day for Titan Mode progress
  const wasUnlockedBefore = useTitanModeStore.getState().unlocked;
  useTitanModeStore.getState().recordDay(titanScore, mode);
  const titanJustUnlockedNow = !wasUnlockedBefore && useTitanModeStore.getState().unlocked;

  // 7. Check progression phase advancement
  const oldPhase = useProgressionStore.getState().currentPhase;
  const newPhase = useProgressionStore.getState().checkWeekAdvancement();
  const phaseAdvanced = newPhase !== null;

  // 8. Add narrative entries for milestones
  const protocolStreak = useProtocolStore.getState().streakCurrent;
  const meta = selectIdentityMeta(archetype);
  const totalVotes = useIdentityStore.getState().totalVotes;
  const addEntry = useNarrativeStore.getState().addEntry;
  const firstUseDate = useProgressionStore.getState().firstUseDate;

  // Calculate day number
  let dayNumber = 1;
  if (firstUseDate) {
    const start = new Date(firstUseDate + "T00:00:00");
    const now = new Date(today + "T00:00:00");
    dayNumber = Math.max(1, Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1);
  }

  // Streak milestones: 7, 14, 21, 30, 60, 100
  const allEntries = useNarrativeStore.getState().entries;
  const streakMilestones = [7, 14, 21, 30, 60, 100];
  if (streakMilestones.includes(protocolStreak)) {
    const title = `${protocolStreak}-Day Streak`;
    if (!allEntries.some((e) => e.title === title)) {
      addEntry({
        date: today,
        dayNumber,
        type: "streak",
        title,
        body: `Day ${dayNumber}: ${protocolStreak} consecutive days. ${protocolStreak >= 30 ? "You haven't missed once." : "Keep going."}`,
        stats: { titanScore, streak: protocolStreak },
      });
    }
  }

  // Phase transition narrative
  if (newPhase) {
    const phaseTitle = `${newPhase.charAt(0).toUpperCase() + newPhase.slice(1)} Phase`;
    if (!allEntries.some((e) => e.title === phaseTitle && e.type === "phase")) {
      addEntry({
        date: today,
        dayNumber,
        type: "phase",
        title: phaseTitle,
        body: `${meta?.name ?? "You"} enters ${newPhase.charAt(0).toUpperCase() + newPhase.slice(1)} Phase.`,
        stats: { titanScore, streak: protocolStreak },
      });
    }
  }

  // Vote milestones: 100
  if (totalVotes === 100 && !allEntries.some((e) => e.title === "100 Votes")) {
    addEntry({
      date: today,
      dayNumber,
      type: "milestone",
      title: "100 Votes",
      body: `100 votes cast as ${meta?.name ?? "your identity"}. This isn't a phase. This is who you are.`,
      stats: { titanScore },
    });
  }

  // 8b. First S rank narrative
  if (titanScore >= 85) {
    const hasFirstS = allEntries.some((e) => e.title === "First S Rank");
    if (!hasFirstS) {
      addEntry({
        date: today,
        dayNumber,
        type: "milestone",
        title: "First S Rank",
        body: `Day ${dayNumber}: S rank achieved for the first time. Titan Score: ${titanScore}%.`,
        stats: { titanScore },
      });
    }
  }

  // 8c. First A rank narrative
  if (titanScore >= 70 && titanScore < 85) {
    const hasFirstA = allEntries.some((e) => e.title === "First A Rank");
    if (!hasFirstA) {
      addEntry({
        date: today,
        dayNumber,
        type: "milestone",
        title: "First A Rank",
        body: `Day ${dayNumber}: A rank achieved. Titan Score: ${titanScore}%. The bar is rising.`,
        stats: { titanScore },
      });
    }
  }

  // 8d. Titan Mode unlock narrative
  const hasTitanNarrative = allEntries.some((e) => e.title === "Titan Mode Unlocked");
  if (titanJustUnlockedNow && !hasTitanNarrative) {
    addEntry({
      date: today,
      dayNumber,
      type: "milestone",
      title: "Titan Mode Unlocked",
      body: `Day ${dayNumber}: Titan Mode unlocked. 30 consecutive days at 85%+. You earned this.`,
      stats: { titanScore, streak: protocolStreak },
    });
  }

  // 8e. Year one narrative (day 365)
  if (dayNumber === 365 && !allEntries.some((e) => e.title === "Year One")) {
    addEntry({
      date: today,
      dayNumber,
      type: "milestone",
      title: "Year One",
      body: `Day 365: One year. You are not the same person who started.`,
      stats: { titanScore, streak: protocolStreak },
    });
  }

  // 9. Check perfect day (all engines 100%)
  const allPerfect = ENGINES.every((e) => (engineScores[e] ?? 0) >= 100);
  if (allPerfect) {
    // Award variable XP between 100 and 500
    const seed = parseInt(today.replace(/-/g, ""), 10);
    const randomXP = 100 + (seed % 401); // 100-500 deterministic
    useProfileStore.getState().awardXP(today, "perfect_day", randomXP);

    // Perfect day narrative (dedup by date)
    if (!allEntries.some((e) => e.title === "Perfect Day" && e.date === today)) {
      addEntry({
        date: today,
        dayNumber,
        type: "milestone",
        title: "Perfect Day",
        body: `Day ${dayNumber}: 100% across all engines. +${randomXP} XP bonus. Flawless.`,
        stats: { titanScore, engineScores },
      });
    }
  }

  // 10. Update quest progress
  const quests = useQuestStore.getState().weeklyQuests;
  const mindStats = useMindTrainingStore.getState().stats;

  for (const quest of quests) {
    if (quest.status !== "active") continue;

    // Streak-based quests
    if (quest.targetType === "streak") {
      useQuestStore.getState().updateQuestProgress(quest.id, protocolStreak);
    }

    // Score-based engine quests
    if (quest.targetType === "score") {
      // Determine engine: use targetEngine, or primary engine if null
      const targetEng = quest.targetEngine ?? (meta?.primaryEngine === "all" ? "body" : meta?.primaryEngine ?? "body");
      const engineScore = engineScores[targetEng] ?? 0;
      // Infer threshold from description (e.g., "60%+", "75%+", "85%+")
      const thresholdMatch = quest.description.match(/(\d+)%\+/);
      const threshold = thresholdMatch ? parseInt(thresholdMatch[1], 10) : 60;
      if (engineScore >= threshold) {
        useQuestStore.getState().updateQuestProgress(quest.id, quest.currentValue + 1);
      }
    }

    // Cross-engine rank quests: infer threshold from description
    if (quest.targetType === "rank" && quest.type === "cross_engine") {
      const rankMatch = quest.description.match(/(\d+)%\+/);
      const threshold = rankMatch ? parseInt(rankMatch[1], 10) : 50;
      const allAbove = ENGINES.every((e) => (engineScores[e] ?? 0) >= threshold);
      if (allAbove) {
        useQuestStore.getState().updateQuestProgress(quest.id, quest.currentValue + 1);
      }
    }

    // Completion-based quests (habits, journal, mind exercises)
    if (quest.targetType === "completion") {
      const desc = quest.description.toLowerCase();
      if (desc.includes("habit")) {
        const habitScore = useHabitStore.getState().getOverallHabitScore(today);
        if (habitScore >= 100) {
          useQuestStore.getState().updateQuestProgress(quest.id, quest.currentValue + 1);
        }
      } else if (desc.includes("journal")) {
        // Check if journal entry exists for today
        const journalEntry = getJSON<unknown>(`journal:${today}`, null);
        if (journalEntry) {
          useQuestStore.getState().updateQuestProgress(quest.id, quest.currentValue + 1);
        }
      } else if (desc.includes("mind") || desc.includes("bias") || desc.includes("recall") || desc.includes("exercise")) {
        // Increment by 1 per protocol completion (each protocol includes 1 mind exercise)
        useQuestStore.getState().updateQuestProgress(quest.id, quest.currentValue + 1);
      }
    }
  }

  // 11. Update boss challenge progress using proper evaluator
  let bossDefeated = false;
  let defeatedBossInfo: DefeatedBossInfo | null = null;
  const bossChallenge = useQuestStore.getState().bossChallenge;
  if (bossChallenge && bossChallenge.active) {
    const primaryEng = meta?.primaryEngine === "all" ? "body" : meta?.primaryEngine ?? "body";
    const dayPassed = useQuestStore.getState().evaluateBossDay(engineScores, primaryEng, protocolStreak);
    useQuestStore.getState().updateBossProgress(dayPassed);
    // Check if boss was just completed
    const updatedBoss = useQuestStore.getState().bossChallenge;
    if (updatedBoss && updatedBoss.completed && !bossChallenge.completed) {
      bossDefeated = true;

      // Claim boss reward here (not in modal) so it's never lost
      // even if another celebration (Titan unlock) takes priority
      useProfileStore.getState().awardXP(today, "boss_complete", updatedBoss.xpReward);

      // Record completed boss ID
      const completedBossIds = getJSON<string[]>("completed_boss_ids", []);
      if (!completedBossIds.includes(updatedBoss.id)) {
        setJSON("completed_boss_ids", [...completedBossIds, updatedBoss.id]);
      }

      // Boss narrative entry
      addEntry({
        date: today,
        dayNumber,
        type: "boss",
        title: `${updatedBoss.title} Defeated`,
        body: `${meta?.name ?? "You"} conquered ${updatedBoss.title}. ${updatedBoss.daysRequired} days of sustained performance.`,
        stats: { streak: updatedBoss.daysRequired },
      });

      // Capture boss data for celebration modal before clearing
      defeatedBossInfo = {
        title: updatedBoss.title,
        daysRequired: updatedBoss.daysRequired,
        dayResults: updatedBoss.dayResults,
        xpReward: updatedBoss.xpReward,
      };

      // Clear boss from store so new bosses can be offered
      useQuestStore.getState().clearBoss();
    }
  }

  // 12. Generate weekly quests if Monday and none exist
  const dayOfWeek = new Date(today + "T00:00:00").getDay();
  if (dayOfWeek === 1 && quests.length === 0) {
    const phase = useProgressionStore.getState().currentPhase;
    useQuestStore.getState().generateWeeklyQuests(phase, archetype ?? "operator");
  }

  // Build phase transition data if phase advanced
  let phaseTransition: ProtocolCompletionResult["phaseTransition"] = null;
  if (phaseAdvanced && newPhase) {
    const phaseHistory = useProgressionStore.getState().phaseHistory;
    const lastHistory = phaseHistory[phaseHistory.length - 1];
    phaseTransition = {
      oldPhase,
      newPhase,
      avgScore: lastHistory?.stats.avgScore ?? 0,
      daysCompleted: lastHistory?.stats.daysCompleted ?? 0,
      totalDays: lastHistory?.stats.totalDays ?? 28,
      bestStreak: protocolStreak,
      bestRank: titanScore >= 95 ? "SS" : titanScore >= 85 ? "S" : titanScore >= 70 ? "A" : titanScore >= 50 ? "B" : titanScore >= 30 ? "C" : "D",
    };
  }

  // 13. Evaluate skill tree progress
  const skillNodesUnlocked = evaluateAllTrees();

  // Add narrative entries for skill unlocks
  for (const node of skillNodesUnlocked) {
    addEntry({
      date: today,
      dayNumber,
      type: "skill",
      title: `${node.name} Unlocked`,
      body: `${node.branch} Level ${node.level} — ${node.name}. ${node.engine.charAt(0).toUpperCase() + node.engine.slice(1)} engine skill tree grows.`,
    });
  }

  // 14. Check achievements
  const achievementState: AchievementAppState = {
    titanScore,
    engineScores,
    protocolStreak,
    protocolCompleteToday: true,
    protocolCompletionHour: new Date().getHours(),
    dayNumber,
  };
  const achievementsUnlocked = checkAllAchievements(achievementState);

  // Add narrative for achievements (look up each achievement by ID from JSON)
  for (const achId of achievementsUnlocked) {
    const achDef = (achievementDefsJson as { id: string; name: string; rarity: string }[]).find((d) => d.id === achId);
    if (achDef) {
      addEntry({
        date: today,
        dayNumber,
        type: "achievement",
        title: `${achDef.name} Unlocked`,
        body: `Day ${dayNumber}: Achievement unlocked — "${achDef.name}." Rarity: ${achDef.rarity}.`,
      });
    }
  }

  // 15. Record daily stats + check milestones
  const statMilestones = useStatStore.getState().recordDaily(today, engineScores as Record<import("../db/schema").EngineKey, number>);

  // 16. Evaluate rank progression (E→S)
  const rankResult = useRankStore.getState().evaluateDay(titanScore);

  // 17. Evaluate field op progress
  let fieldOpResult: string | null = null;
  const activeOp = useFieldOpStore.getState().activeFieldOp;
  if (activeOp) {
    const opEval = useFieldOpStore.getState().evaluateDay(engineScores, titanScore);
    fieldOpResult = opEval;

    // If field op just completed, finalize it: award XP, apply stat bonus
    if (opEval === "completed") {
      const completedDef = useFieldOpStore.getState().complete();
      if (completedDef) {
        // Award field op XP reward
        useProfileStore.getState().awardXP(today, "field_op", completedDef.xpReward);

        // Apply stat bonus (split evenly across all 4 engines)
        if (completedDef.statBonus > 0) {
          const bonusPerEngine = completedDef.statBonus / 4;
          const currentStats = useStatStore.getState().stats;
          for (const eng of ENGINES) {
            const key = eng as import("../db/schema").EngineKey;
            setJSON(`stat:${key}`, (currentStats[key] ?? 0) + bonusPerEngine);
          }
          // Reload stat store to reflect changes
          useStatStore.getState().load(today);
        }
      }
    }
  }

  // 18. Check titles
  const titleContext = {
    streak: protocolStreak,
    titanScore,
    engineScores,
    stats: useStatStore.getState().stats,
    totalOutput: useStatStore.getState().totalOutput,
    rank: useRankStore.getState().rank,
    fieldOpsCleared: useFieldOpStore.getState().getClearedCount(),
    dayNumber,
    protocolCompleteToday: true,
  };
  const titlesUnlocked = useTitleStore.getState().checkAndUnlock(titleContext);

  // 19. Update notifications
  cancelStreakWarning(); // Protocol done — no streak warning needed
  if (bossDefeated) cancelBossReminder(); // Boss done — no more reminders
  scheduleQuestDeadline(); // Refresh quest deadline with updated progress
  scheduleBossReminder(); // Refresh boss reminder if still active

  return {
    bossDefeated,
    defeatedBoss: defeatedBossInfo,
    perfectDay: allPerfect,
    perfectDayXP: allPerfect ? (100 + (parseInt(today.replace(/-/g, ""), 10) % 401)) : 0,
    phaseTransition,
    skillNodesUnlocked,
    achievementsUnlocked,
    titanUnlocked: titanJustUnlockedNow,
    momentumMultiplier,
    momentumBonusXP,
    statMilestones,
    rankResult,
    fieldOpResult,
    titlesUnlocked: titlesUnlocked.map((t) => ({ id: t.id, name: t.name, rarity: t.rarity })),
  };
}

/**
 * Check if protocol is available for the current mode.
 */
export function isProtocolAvailable(): boolean {
  return useModeStore.getState().isFeatureVisible("protocol");
}
