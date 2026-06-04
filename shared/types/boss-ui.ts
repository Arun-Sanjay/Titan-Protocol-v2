import type { Tables } from "./supabase";
import bossDefsJson from "../data/boss-challenges.json";

export type BossDef = {
  id: string;
  title: string;
  description: string;
  requirement?: string;
  daysRequired: number;
  xpReward: number;
};

const BOSS_DEFS: BossDef[] = bossDefsJson as unknown as BossDef[];

/** Shape the UI renders. Cloud rows + static defs are merged into this. */
export type BossChallenge = {
  id: string;
  title: string;
  description: string;
  requirement?: string;
  daysRequired: number;
  currentDay: number;
  dayResults: boolean[];
  active: boolean;
  completed: boolean;
  failed: boolean;
  xpReward: number;
};

export function getBossDef(bossId: string): BossDef | null {
  return BOSS_DEFS.find((d) => d.id === bossId) ?? null;
}

export function mapCloudBossChallenge(
  row: Tables<"boss_challenges">,
): BossChallenge {
  const def = getBossDef(row.boss_id);
  const dayResults = Array.isArray(row.day_results)
    ? (row.day_results as boolean[])
    : [];
  const status = row.status as "active" | "defeated" | "failed" | "abandoned";
  return {
    id: row.id,
    title: def?.title ?? row.boss_id,
    description: def?.description ?? "",
    requirement: def?.requirement,
    daysRequired: row.days_required ?? def?.daysRequired ?? 0,
    currentDay: dayResults.length,
    dayResults,
    active: status === "active",
    completed: status === "defeated",
    failed: status === "failed",
    xpReward: def?.xpReward ?? 0,
  };
}
