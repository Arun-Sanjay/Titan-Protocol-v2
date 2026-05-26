import { requireUserId } from "../lib/supabase";
import {
  newId,
  sqliteGet,
  sqliteList,
  cloudUpsert,
  transaction,
} from "../db/sqlite/service-helpers";
import type { Tables, Enums } from "../types/supabase";
import type { Json } from "../types/supabase";
import { getTodayKey, toLocalDateKey } from "../lib/date";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type BossChallenge = Tables<"boss_challenges">;
export type BossStatus = Enums<"boss_status">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listActiveBossChallenges(): Promise<BossChallenge[]> {
  return sqliteList<BossChallenge>("boss_challenges", {
    where: "status = ?",
    params: ["active"],
    order: "started_at DESC",
  });
}

export async function startBossChallenge(boss: {
  boss_id: string;
  days_required: number;
  evaluator_type: string;
}): Promise<BossChallenge> {
  const userId = await requireUserId();
  const now = new Date().toISOString();
  const row: BossChallenge = {
    id: newId(),
    user_id: userId,
    boss_id: boss.boss_id,
    days_required: boss.days_required,
    evaluator_type: boss.evaluator_type,
    status: "active" as BossStatus,
    progress: 0,
    day_results: [] as unknown as Json,
    resolved_at: null,
    started_at: now,
    updated_at: now,
  };
  return cloudUpsert("boss_challenges", row);
}

/**
 * Append today's pass/fail to an active boss challenge.
 *
 * Atomic via SQLite transaction so two near-simultaneous logs (e.g. a
 * double-tap) can't both append.
 *
 * Resolution rules — the bosses defined in `data/boss-challenges.json`
 * all require N consecutive successes. So:
 *   - any FAIL → status = "failed", resolved_at = now
 *   - dayResults.length === days_required AND all true → status = "defeated"
 *   - else → still "active"
 *
 * Returns the updated row, plus a `resolved` flag the caller uses to
 * decide whether to award XP / fire celebration cinematics.
 */
export async function recordBossDay(params: {
  id: string;
  passed: boolean;
}): Promise<{
  challenge: BossChallenge;
  resolved: "defeated" | "failed" | null;
  alreadyLoggedToday: boolean;
}> {
  return transaction(async () => {
    const existing = await sqliteGet<BossChallenge>("boss_challenges", {
      id: params.id,
    });
    if (!existing) throw new Error("Boss challenge not found");
    if (existing.status !== "active") {
      // Caller's UI shouldn't allow this, but guard anyway so a stale
      // tap on an already-resolved boss doesn't mutate state.
      return {
        challenge: existing,
        resolved: null,
        alreadyLoggedToday: true,
      };
    }

    const dayResults = Array.isArray(existing.day_results)
      ? [...(existing.day_results as boolean[])]
      : [];

    // One log per local day, gated by the row's updated_at — without
    // this a user could fire-and-forget log multiple "passes" in one day
    // and instantly close out a 7-day boss in 7 taps. We compare local
    // date keys (not ISO slices) so a user crossing midnight doesn't
    // double-log a day that already exists in the row.
    const today = getTodayKey();
    const lastUpdate =
      typeof existing.updated_at === "string"
        ? toLocalDateKey(new Date(existing.updated_at))
        : null;
    if (dayResults.length > 0 && lastUpdate === today) {
      return {
        challenge: existing,
        resolved: null,
        alreadyLoggedToday: true,
      };
    }

    dayResults.push(params.passed);

    let nextStatus: BossStatus = "active";
    if (!params.passed) {
      nextStatus = "failed";
    } else if (dayResults.length >= existing.days_required) {
      nextStatus = "defeated";
    }

    const now = new Date().toISOString();
    const merged: BossChallenge = {
      ...existing,
      day_results: dayResults as unknown as Json,
      progress: dayResults.filter(Boolean).length,
      status: nextStatus,
      resolved_at: nextStatus === "active" ? null : now,
      updated_at: now,
    };
    const saved = await cloudUpsert("boss_challenges", merged);
    return {
      challenge: saved,
      resolved: nextStatus === "active" ? null : nextStatus,
      alreadyLoggedToday: false,
    };
  });
}

/**
 * Manually abandon an active boss challenge. Marks it `abandoned` so
 * the next available boss can be offered to the user.
 */
export async function abandonBossChallenge(id: string): Promise<BossChallenge> {
  return transaction(async () => {
    const existing = await sqliteGet<BossChallenge>("boss_challenges", { id });
    if (!existing) throw new Error("Boss challenge not found");
    const now = new Date().toISOString();
    const merged: BossChallenge = {
      ...existing,
      status: "abandoned" as BossStatus,
      resolved_at: now,
      updated_at: now,
    };
    return cloudUpsert("boss_challenges", merged);
  });
}
