/**
 * Auto-generate transformation story entries from user data.
 *
 * Generates human-readable narrative text for milestone moments.
 * All entries are stored locally via useNarrativeStore.
 */

import type { NarrativeEntryType } from "../stores/useNarrativeStore";

// ─── Types ──────────────────────────────────────────────────────────────────

export type NarrativeTrigger =
  | "first_day"
  | "first_week"
  | "first_s_rank"
  | "first_a_rank"
  | "streak_milestone"
  | "phase_transition"
  | "boss_complete"
  | "skill_unlock"
  | "identity_change"
  | "titan_unlock"
  | "achievement"
  | "century_votes"
  | "perfect_day"
  | "year_one";

export type NarrativeData = {
  dayNumber: number;
  identityName?: string;
  titanScore?: number;
  streak?: number;
  // Trigger-specific
  rank?: string;
  phaseName?: string;
  oldPhaseName?: string;
  bossName?: string;
  bossDays?: number;
  nodeName?: string;
  branchName?: string;
  engineName?: string;
  achievementName?: string;
  achievementRarity?: string;
  xpEarned?: number;
  engineScores?: Record<string, number>;
};

// ─── Generator ──────────────────────────────────────────────────────────────

/**
 * Generate title + body for a narrative milestone entry.
 */
export function generateNarrativeEntry(
  trigger: NarrativeTrigger,
  data: NarrativeData,
): { title: string; body: string; type: NarrativeEntryType } {
  const d = data;
  const day = `Day ${d.dayNumber}`;

  switch (trigger) {
    case "first_day":
      return {
        title: "Day 1",
        body: `${day}: You chose ${d.identityName ?? "your identity"}. Your first Titan Score was ${d.titanScore ?? 0}%.`,
        type: "identity",
      };

    case "first_week":
      return {
        title: "Week 1 Complete",
        body: `${day}: First week done. ${d.streak ?? 0} out of 7 days completed.${d.titanScore ? ` Average: ${d.titanScore}%.` : ""}`,
        type: "milestone",
      };

    case "first_s_rank":
      return {
        title: "First S Rank",
        body: `${day}: S rank achieved for the first time. Titan Score: ${d.titanScore ?? 0}%.`,
        type: "milestone",
      };

    case "first_a_rank":
      return {
        title: "First A Rank",
        body: `${day}: A rank achieved. Titan Score: ${d.titanScore ?? 0}%. The bar is rising.`,
        type: "milestone",
      };

    case "streak_milestone":
      return {
        title: `${d.streak}-Day Streak`,
        body: `${day}: ${d.streak} consecutive days.${(d.streak ?? 0) >= 30 ? " You haven't missed once." : " Keep going."}`,
        type: "streak",
      };

    case "phase_transition":
      return {
        title: `${d.phaseName ?? "New"} Phase`,
        body: `${day}: ${d.oldPhaseName ?? "Previous"} Phase complete.${d.identityName ? ` ${d.identityName}` : " You"} enter${d.identityName ? "s" : ""} ${d.phaseName ?? "the next"} Phase.${d.titanScore ? ` Average improved to ${d.titanScore}%.` : ""}`,
        type: "phase",
      };

    case "boss_complete":
      return {
        title: `${d.bossName ?? "Boss"} Defeated`,
        body: `${day}: ${d.identityName ?? "You"} conquered ${d.bossName ?? "the boss challenge"}. ${d.bossDays ?? 0} days of sustained performance.`,
        type: "boss",
      };

    case "skill_unlock":
      return {
        title: `${d.nodeName ?? "Skill"} Unlocked`,
        body: `${day}: ${d.branchName ?? "Branch"} Level — ${d.nodeName ?? "node"}. ${d.engineName ?? "Engine"} skill tree grows.`,
        type: "skill",
      };

    case "identity_change":
      return {
        title: "New Identity",
        body: `${day}: Identity shifted to ${d.identityName ?? "a new archetype"}. A new chapter begins.`,
        type: "identity",
      };

    case "titan_unlock":
      return {
        title: "Titan Mode Unlocked",
        body: `${day}: Titan Mode unlocked. ${d.streak ?? 30} consecutive days at 85%+. You earned this.`,
        type: "milestone",
      };

    case "achievement":
      return {
        title: `${d.achievementName ?? "Achievement"} Unlocked`,
        body: `${day}: Achievement unlocked — "${d.achievementName ?? ""}."${d.achievementRarity ? ` Rarity: ${d.achievementRarity}.` : ""}`,
        type: "achievement",
      };

    case "century_votes":
      return {
        title: "100 Votes",
        body: `${day}: 100 votes cast as ${d.identityName ?? "your identity"}. This isn't a phase. This is who you are.`,
        type: "milestone",
      };

    case "perfect_day":
      return {
        title: "Perfect Day",
        body: `${day}: 100% across all engines.${d.xpEarned ? ` +${d.xpEarned} XP bonus.` : ""} Flawless.`,
        type: "milestone",
      };

    case "year_one":
      return {
        title: "Year One",
        body: `${day}: One year. 365 days. You are not the same person who started.`,
        type: "milestone",
      };

    default:
      return {
        title: `Day ${d.dayNumber}`,
        body: `${day}: A milestone was reached.`,
        type: "milestone",
      };
  }
}
