/**
 * Weekly quest generation from templates
 */

import templates from "../data/quest-templates.json";
import type { Quest, QuestType } from "../stores/useQuestStore";
import { getTodayKey } from "./date";

type QuestTemplate = {
  id: string;
  type: QuestType;
  phase: string;
  identity_tags: string[];
  title: string;
  description: string;
  target_type: string;
  target_engine: string | null;
  target_value: number;
  xp_reward: number;
};

const allTemplates = templates as QuestTemplate[];

/**
 * Generate 3 weekly quests: 1 engine + 1 cross_engine + 1 wildcard.
 *
 * @param phase — current progression phase
 * @param identity — user's archetype
 * @param recentQuestIds — IDs of quests from the last 2 weeks (to avoid repeats)
 */
export function generateWeeklyQuests(
  phase: string,
  identity: string,
  recentQuestIds: string[] = [],
): Quest[] {
  const today = getTodayKey();
  const phaseTemplates = allTemplates.filter((t) => t.phase === phase);

  // Helper: pick best template for a type
  function pickTemplate(type: QuestType): QuestTemplate | null {
    const candidates = phaseTemplates.filter((t) => t.type === type);
    if (candidates.length === 0) return null;

    // Prefer identity-tagged templates, exclude recent
    const fresh = candidates.filter((t) => !recentQuestIds.includes(t.id));
    const pool = fresh.length > 0 ? fresh : candidates;

    // Score: identity match gets priority
    const scored = pool.map((t) => ({
      template: t,
      score: t.identity_tags.length === 0 ? 1 : t.identity_tags.includes(identity) ? 3 : 0,
    }));

    // Sort by score descending, pick from top
    scored.sort((a, b) => b.score - a.score);
    const topScore = scored[0]?.score ?? 0;
    const top = scored.filter((s) => s.score === topScore);

    // Random from top-scored
    const picked = top[Math.floor(Math.random() * top.length)];
    return picked?.template ?? null;
  }

  const engineTemplate = pickTemplate("engine");
  const crossTemplate = pickTemplate("cross_engine");
  const wildcardTemplate = pickTemplate("wildcard");

  const quests: Quest[] = [];
  let counter = 0;

  function templateToQuest(t: QuestTemplate): Quest {
    return {
      id: `quest_${today}_${++counter}`,
      templateId: t.id,
      type: t.type,
      title: t.title,
      description: t.description,
      targetEngine: t.target_engine ?? undefined,
      targetType: t.target_type as Quest["targetType"],
      targetValue: t.target_value,
      currentValue: 0,
      xpReward: t.xp_reward,
      status: "active",
      createdAt: today,
    };
  }

  if (engineTemplate) quests.push(templateToQuest(engineTemplate));
  if (crossTemplate) quests.push(templateToQuest(crossTemplate));
  if (wildcardTemplate) quests.push(templateToQuest(wildcardTemplate));

  return quests;
}

/**
 * Check if a quest's progress should be updated based on current app state.
 * Returns the new currentValue if changed, null otherwise.
 */
export function checkQuestProgress(
  quest: Quest,
  state: {
    protocolStreak: number;
    engineScores: Record<string, number>;
    habitCompletionDays: number;
    journalDays: number;
    mindExercises: number;
  },
): number | null {
  if (quest.status !== "active") return null;

  switch (quest.targetType) {
    case "streak":
      return state.protocolStreak !== quest.currentValue ? state.protocolStreak : null;

    case "completion":
      // Context-dependent: habits, journal, or mind exercises
      if (quest.description.toLowerCase().includes("habit")) {
        return state.habitCompletionDays !== quest.currentValue ? state.habitCompletionDays : null;
      }
      if (quest.description.toLowerCase().includes("journal")) {
        return state.journalDays !== quest.currentValue ? state.journalDays : null;
      }
      if (quest.description.toLowerCase().includes("mind") || quest.description.toLowerCase().includes("bias") || quest.description.toLowerCase().includes("recall")) {
        return state.mindExercises !== quest.currentValue ? state.mindExercises : null;
      }
      return null;

    case "score": {
      // Count days where target engine (or primary) met the threshold
      // This is tracked externally by protocol-completion
      return null; // Updated by protocol-completion directly
    }

    case "rank": {
      // Cross-engine rank checks done externally
      return null;
    }

    default:
      return null;
  }
}
