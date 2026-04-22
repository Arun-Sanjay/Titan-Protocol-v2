/**
 * Suggested mission/habit generation based on identity and phase
 */

import templates from "../data/mission-templates.json";
import type { Phase } from "../types/progression-ui";

export type SuggestedHabit = {
  title: string;
  trigger: string;
  duration: string;
  frequency: string;
  engine: string;
  icon: string;
};

export type SuggestedMission = {
  id: string;
  engine: string;
  title: string;
  points: number;
  type: "mission" | "side_quest";
};

const habitTemplates = templates.habits as Record<string, SuggestedHabit[]>;

/**
 * Get suggested habits for an identity archetype.
 */
export function getSuggestedHabits(identity: string): SuggestedHabit[] {
  return habitTemplates[identity] ?? habitTemplates.operator ?? [];
}

// ─── Phase-aware mission suggestions ────────────────────────────────────────

// Missions scale with phase: Foundation=simple, Building=more, Intensify=harder, Sustain=adaptive
const PHASE_MISSIONS: Record<Phase, Record<string, SuggestedMission[]>> = {
  foundation: {
    body: [
      { id: "fm_b1", engine: "body", title: "Complete a workout", points: 2, type: "mission" },
      { id: "fm_b2", engine: "body", title: "Log your meals today", points: 1, type: "side_quest" },
    ],
    mind: [
      { id: "fm_m1", engine: "mind", title: "Read for 20 minutes", points: 2, type: "mission" },
      { id: "fm_m2", engine: "mind", title: "Complete a mind exercise", points: 1, type: "side_quest" },
    ],
    money: [
      { id: "fm_$1", engine: "money", title: "Track today's spending", points: 2, type: "mission" },
      { id: "fm_$2", engine: "money", title: "Review your budget", points: 1, type: "side_quest" },
    ],
    charisma: [
      { id: "fm_c1", engine: "charisma", title: "Start a conversation with someone new", points: 2, type: "mission" },
      { id: "fm_c2", engine: "charisma", title: "Give a genuine compliment to a stranger", points: 1, type: "side_quest" },
    ],
  },
  building: {
    body: [
      { id: "bm_b1", engine: "body", title: "45-min strength session", points: 2, type: "mission" },
      { id: "bm_b2", engine: "body", title: "Hit protein target", points: 1, type: "side_quest" },
      { id: "bm_b3", engine: "body", title: "Track sleep quality", points: 1, type: "side_quest" },
    ],
    mind: [
      { id: "bm_m1", engine: "mind", title: "Deep work: 90 minutes", points: 2, type: "mission" },
      { id: "bm_m2", engine: "mind", title: "Complete 2 mind exercises", points: 1, type: "side_quest" },
      { id: "bm_m3", engine: "mind", title: "Journal reflection", points: 1, type: "side_quest" },
    ],
    money: [
      { id: "bm_$1", engine: "money", title: "Stay under daily budget", points: 2, type: "mission" },
      { id: "bm_$2", engine: "money", title: "Research one investment", points: 1, type: "side_quest" },
      { id: "bm_$3", engine: "money", title: "Track all expenses", points: 1, type: "side_quest" },
    ],
    charisma: [
      { id: "bm_c1", engine: "charisma", title: "Practice a 2-minute speech", points: 2, type: "mission" },
      { id: "bm_c2", engine: "charisma", title: "Have a meaningful conversation", points: 1, type: "side_quest" },
      { id: "bm_c3", engine: "charisma", title: "Practice active listening all day", points: 1, type: "side_quest" },
    ],
  },
  intensify: {
    body: [
      { id: "im_b1", engine: "body", title: "Push past last session", points: 2, type: "mission" },
      { id: "im_b2", engine: "body", title: "Hit all macro targets", points: 2, type: "mission" },
      { id: "im_b3", engine: "body", title: "Active recovery session", points: 1, type: "side_quest" },
    ],
    mind: [
      { id: "im_m1", engine: "mind", title: "3 hours deep work", points: 2, type: "mission" },
      { id: "im_m2", engine: "mind", title: "Complete 3 mind exercises", points: 2, type: "mission" },
      { id: "im_m3", engine: "mind", title: "Teach what you learned", points: 1, type: "side_quest" },
    ],
    money: [
      { id: "im_$1", engine: "money", title: "Increase savings rate", points: 2, type: "mission" },
      { id: "im_$2", engine: "money", title: "Audit subscriptions", points: 2, type: "mission" },
      { id: "im_$3", engine: "money", title: "Read financial news", points: 1, type: "side_quest" },
    ],
    charisma: [
      { id: "im_c1", engine: "charisma", title: "Record and review a 2-minute speech", points: 2, type: "mission" },
      { id: "im_c2", engine: "charisma", title: "Lead a group discussion", points: 2, type: "mission" },
      { id: "im_c3", engine: "charisma", title: "Introduce yourself to 3 new people", points: 1, type: "side_quest" },
    ],
  },
  sustain: {
    body: [
      { id: "sm_b1", engine: "body", title: "Maintain training volume", points: 2, type: "mission" },
      { id: "sm_b2", engine: "body", title: "Recovery protocol", points: 1, type: "side_quest" },
    ],
    mind: [
      { id: "sm_m1", engine: "mind", title: "Deep focus session", points: 2, type: "mission" },
      { id: "sm_m2", engine: "mind", title: "Review & recall", points: 1, type: "side_quest" },
    ],
    money: [
      { id: "sm_$1", engine: "money", title: "Weekly financial review", points: 2, type: "mission" },
      { id: "sm_$2", engine: "money", title: "Optimize one expense", points: 1, type: "side_quest" },
    ],
    charisma: [
      { id: "sm_c1", engine: "charisma", title: "Maintain your networking habit", points: 2, type: "mission" },
      { id: "sm_c2", engine: "charisma", title: "Practice confident body language", points: 1, type: "side_quest" },
    ],
  },
};

/**
 * Get phase-aware suggested missions for an engine.
 *
 * @param identity — user archetype
 * @param phase — current progression phase
 * @param enginePriority — ordered engine list
 * @param weekInPhase — week number within current phase
 */
export function getSuggestedMissions(
  identity: string,
  phase: Phase,
  enginePriority: string[] = ["body", "mind", "money", "charisma"],
  weekInPhase: number = 1,
): SuggestedMission[] {
  const phaseMissions = PHASE_MISSIONS[phase] ?? PHASE_MISSIONS.foundation;
  const missions: SuggestedMission[] = [];

  // For each engine in priority order, add its missions
  for (const engine of enginePriority) {
    const engineMissions = phaseMissions[engine];
    if (engineMissions) {
      missions.push(...engineMissions);
    }
  }

  return missions;
}

/**
 * Get missions for the weakest engine (Sustain phase adaptive behavior).
 *
 * Returns [] when there's no clear weak engine — equal scores across
 * staffed engines, or weakest is already strong enough, etc. (See
 * `selectWeakEngine` in src/lib/engine-scores.ts for the exact rules.)
 * Callers should fall back to a generic mission set when this is empty.
 */
export function getWeakestEngineMissions(
  engineScores: Record<string, number>,
  phase: Phase,
  taskCounts?: Record<string, number>,
): SuggestedMission[] {
  // Lazy import to keep this module tree-shakable; the selectors don't
  // have runtime side-effects but we want the dependency explicit here.
  const {
    ENGINES,
    buildEngineSnapshot,
    selectWeakEngine,
  } = require("./engine-scores") as typeof import("./engine-scores");

  const scores: Record<string, number> = { body: 0, mind: 0, money: 0, charisma: 0 };
  const counts: Record<string, number> = { body: 0, mind: 0, money: 0, charisma: 0 };
  for (const e of ENGINES) {
    scores[e] = engineScores[e] ?? 0;
    // When the caller doesn't know task counts, assume every engine has at
    // least one — this preserves legacy callers while still honoring the
    // tie / gap / ceiling guards.
    counts[e] = taskCounts?.[e] ?? (engineScores[e] !== undefined ? 1 : 0);
  }
  const snapshot = buildEngineSnapshot({
    scores: scores as Record<import("./engine-scores").EngineKey, number>,
    taskCounts: counts as Record<import("./engine-scores").EngineKey, number>,
  });
  const weakest = selectWeakEngine(snapshot);
  if (!weakest) return [];

  const phaseMissions = PHASE_MISSIONS[phase] ?? PHASE_MISSIONS.sustain;
  return phaseMissions[weakest] ?? [];
}
