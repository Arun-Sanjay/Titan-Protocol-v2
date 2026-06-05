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
export async function settleStreaks(): Promise<{ streak: number } | null> {
  const userId = await requireUserId();
  const profile = await getProfile();
  const today = todayISO();
  const lastSettled = profile?.streak_last_date ?? null;

  // First day to settle: the morning after the last settled day, or the
  // user's first use. Brand-new accounts have nothing to settle.
  const startDay = lastSettled
    ? addDaysISO(lastSettled, 1)
    : profile?.first_use_date ?? null;
  if (!startDay) return null;

  const endDay = addDaysISO(today, -1); // yesterday — today is still in progress
  if (startDay > endDay) return { streak: profile?.streak_current ?? 0 };

  let streak = profile?.streak_current ?? 0;
  let best = profile?.streak_best ?? 0;
  let lastDay: string = lastSettled ?? startDay;

  for (let d = startDay; d <= endDay; d = addDaysISO(d, 1)) {
    const pct = (await getTitanScoreForDate(d)).percent;
    streak = foldStreak(streak, pct);
    if (streak > best) best = streak;

    const existing = await sqliteGet<XpLog>("xp_log", {
      user_id: userId,
      date_key: d,
    });
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
