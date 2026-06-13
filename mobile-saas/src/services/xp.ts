/**
 * XP / rank-up service — the DB-aware half of the rank system. Pure math lives
 * in `lib/xp-math.ts`; the rolling totals (xp/level/streak) live on `profiles`
 * and the per-day ledger lives in `xp_log`.
 *
 *   - awardXpForCompletion: award XP for one task completion, honoring the
 *     10/day cap + the current streak multiplier, and bump profiles.xp/level.
 *   - refundXpForUncomplete: symmetric refund when a counted task is un-done
 *     (anti-gaming — never refunds below the live completion count).
 *   - settleStreaks: consistency-based daily streak settlement (>=60% Titan
 *     score) for every past, unsettled day.
 *
 * All writes go cloud-first via `cloudUpsert` (Supabase → SQLite mirror →
 * Realtime to other devices). The Realtime subscriber only MIRRORS rows; it
 * never re-runs this logic, so XP is awarded exactly once — on the acting
 * device — and the day's counter is a single shared value across devices.
 *
 * Mirrors web's `web/src/services/xp.ts` — keep them in lockstep.
 */
import { requireUserId } from "../lib/supabase";
import {
  sqliteGet,
  sqliteCount,
  cloudUpsert,
} from "../db/sqlite/service-helpers";
import { getProfile, upsertProfile } from "./profile";
import { getTitanScoreForDate } from "../lib/scoring";
import { todayISO, addDaysISO } from "../lib/date";
import {
  xpForTask,
  streakMultiplier,
  levelForXp,
  foldStreak,
  DAILY_XP_TASK_CAP,
  type TaskKind,
} from "../lib/xp-math";
import type { Tables } from "../types/supabase";

export type XpLog = Tables<"xp_log">;

export async function getXpLogForDate(dateKey: string): Promise<XpLog | null> {
  const userId = await requireUserId();
  return sqliteGet<XpLog>("xp_log", { user_id: userId, date_key: dateKey });
}

/** Resolve a task's kind (drives the XP amount). Defaults to "main". */
async function taskKind(taskId: string): Promise<TaskKind> {
  const task = await sqliteGet<{ kind: string | null }>("tasks", { id: taskId });
  return task?.kind === "secondary" ? "secondary" : "main";
}

/** Merge a patch onto a day's xp_log row and persist it cloud-first. */
async function writeXpLog(
  userId: string,
  dateKey: string,
  prev: XpLog | null,
  patch: Partial<XpLog>,
): Promise<void> {
  const now = new Date().toISOString();
  await cloudUpsert("xp_log", {
    user_id: userId,
    date_key: dateKey,
    tasks_counted: prev?.tasks_counted ?? 0,
    xp_earned: prev?.xp_earned ?? 0,
    consistency: prev?.consistency ?? 0,
    streak_value: prev?.streak_value ?? 0,
    multiplier: prev?.multiplier ?? 1,
    settled: prev?.settled ?? false,
    created_at: prev?.created_at ?? now,
    updated_at: now,
    ...patch,
  });
}

export type AwardResult =
  | { awarded: false; reason: "cap_reached" }
  | {
      awarded: true;
      xpGained: number;
      leveledUp: boolean;
      fromLevel: number;
      toLevel: number;
    };

/**
 * Award XP for ONE task completion. Call this only when a NEW completion row
 * was actually inserted (toggleCompletion returned added=true) so each award
 * maps to one real completion. Enforces the 10/day cap and the streak
 * multiplier (read from profiles.streak_current).
 */
export async function awardXpForCompletion(
  dateKey: string,
  taskId: string,
): Promise<AwardResult> {
  const userId = await requireUserId();
  const profile = await getProfile();
  const streak = profile?.streak_current ?? 0;

  const today = await sqliteGet<XpLog>("xp_log", {
    user_id: userId,
    date_key: dateKey,
  });
  const counted = today?.tasks_counted ?? 0;
  if (counted >= DAILY_XP_TASK_CAP) {
    return { awarded: false, reason: "cap_reached" };
  }

  const kind = await taskKind(taskId);
  const xpGained = xpForTask(kind, streak);

  // 1) day ledger — the authoritative cap counter.
  await writeXpLog(userId, dateKey, today, {
    tasks_counted: counted + 1,
    xp_earned: (today?.xp_earned ?? 0) + xpGained,
    streak_value: streak,
    multiplier: streakMultiplier(streak),
  });

  // 2) rolling totals on profiles (reuse xp/level).
  const oldXp = profile?.xp ?? 0;
  const oldLevel = profile?.level ?? 1;
  const newXp = oldXp + xpGained;
  const newLevel = levelForXp(newXp);
  await upsertProfile({ xp: newXp, level: newLevel });

  return {
    awarded: true,
    xpGained,
    leveledUp: newLevel > oldLevel,
    fromLevel: oldLevel,
    toLevel: newLevel,
  };
}

/**
 * Refund XP when a counted task is un-completed. Anti-gaming: only decrements
 * when the day's `tasks_counted` exceeds the remaining live completions, so
 * toggle-churn can never net more than the cap. Refunds at the multiplier the
 * day was recorded with.
 */
export async function refundXpForUncomplete(
  dateKey: string,
  taskId: string,
): Promise<void> {
  const userId = await requireUserId();
  const today = await sqliteGet<XpLog>("xp_log", {
    user_id: userId,
    date_key: dateKey,
  });
  if (!today || today.tasks_counted <= 0) return;

  // Distinct live completions remaining for the day (the unique index keeps
  // these one-per-task). If a counted task wasn't actually removed, no refund.
  const liveCount = await sqliteCount("completions", {
    where: "date_key = ?",
    params: [dateKey],
  });
  if (today.tasks_counted <= liveCount) return;

  const kind = await taskKind(taskId);
  const refund = xpForTask(kind, today.streak_value);
  await writeXpLog(userId, dateKey, today, {
    tasks_counted: Math.max(0, today.tasks_counted - 1),
    xp_earned: Math.max(0, today.xp_earned - refund),
  });

  const profile = await getProfile();
  const newXp = Math.max(0, (profile?.xp ?? 0) - refund);
  await upsertProfile({ xp: newXp, level: levelForXp(newXp) });
}

/**
 * Consistency-based streak settlement. Runs on app open: for each past,
 * unsettled day (from the day after streak_last_date up to YESTERDAY — never
 * today), score the day's Titan % and fold it into the streak (>=60% → +1,
 * else reset to 0). Records each day's consistency on its xp_log row and
 * advances profiles.streak_current / streak_best / streak_last_date.
 */
/** Cap on how many past days one settlement run will fold. A gap longer
 *  than this means weeks of empty days — the streak is mathematically 0
 *  well before the cutoff — so folding them one-by-one would only burn
 *  time and one cloud write per idle day. */
const SETTLE_WINDOW_DAYS = 30;

export async function settleStreaks(): Promise<{ streak: number } | null> {
  const userId = await requireUserId();
  const profile = await getProfile();
  const today = todayISO();
  const lastSettled = profile?.streak_last_date ?? null;
  const yesterday = addDaysISO(today, -1);

  // First day to (re)settle. Normally the morning after the last settled day.
  // BUT when the last settled day is still inside the grace window
  // (yesterday), RE-FOLD it: if the user checks off yesterday's tasks this
  // morning, re-scoring lets the streak recover instead of staying locked as
  // a miss (audit §3.5). We re-derive the streak as it stood ENTERING that
  // day from the prior day's settled ledger row.
  let startDay: string | null;
  let streak = profile?.streak_current ?? 0;
  if (lastSettled && lastSettled >= yesterday) {
    startDay = lastSettled;
    const prevRow = await sqliteGet<XpLog>("xp_log", {
      user_id: userId,
      date_key: addDaysISO(lastSettled, -1),
    });
    streak = prevRow?.streak_value ?? 0;
  } else {
    startDay = lastSettled
      ? addDaysISO(lastSettled, 1)
      : profile?.first_use_date ?? null;
  }
  if (!startDay) {
    // No anchor — this account's first session on the streak system.
    // Seed first_use_date (device-local today) so settlement starts
    // folding from tomorrow. Nothing else writes first_use_date; without
    // this seed settleStreaks bailed here forever and the whole
    // streak/multiplier system never activated for any account.
    if (profile) {
      await upsertProfile({ first_use_date: today });
    }
    return { streak: profile?.streak_current ?? 0 };
  }

  const endDay = yesterday; // today is still in progress
  if (startDay > endDay) return { streak: profile?.streak_current ?? 0 };

  let best = profile?.streak_best ?? 0;
  let lastDay: string = lastSettled ?? startDay;

  // Clamp the catch-up window: jump the cursor and reset the streak
  // instead of folding months of dead air day by day.
  const windowStart = addDaysISO(today, -SETTLE_WINDOW_DAYS);
  if (startDay < windowStart) {
    startDay = windowStart;
    streak = 0;
  }

  for (let d = startDay; d <= endDay; d = addDaysISO(d, 1)) {
    const pct = (await getTitanScoreForDate(d)).percent;
    const streakBefore = streak;
    streak = foldStreak(streak, pct);
    if (streak > best) best = streak;

    const existing = await sqliteGet<XpLog>("xp_log", {
      user_id: userId,
      date_key: d,
    });
    // Don't mint ledger rows for dead air: a day with no existing row,
    // no qualifying score, and a streak that was already 0 records
    // nothing — skipping it keeps a long-absent user's catch-up to a
    // single profile write instead of one cloud upsert per idle day.
    if (!existing && streakBefore === 0 && streak === 0) {
      lastDay = d;
      continue;
    }
    await writeXpLog(userId, d, existing, {
      consistency: pct,
      streak_value: streak,
      settled: true,
    });
    lastDay = d;
  }

  await upsertProfile({
    streak_current: streak,
    streak_best: best,
    streak_last_date: lastDay,
  });
  return { streak };
}
