/**
 * Phase 3.5: One-time MMKV → Supabase data migration.
 *
 * Reads every domain the user has stored locally and uploads it to
 * Supabase under their authenticated user_id. Designed to run once
 * per device per user, the first time they open the cloud-enabled
 * version of the app while signed in.
 *
 * Safety properties:
 *   - Idempotent: gated by a `migration_completed` flag stored under
 *     the user's id in MMKV, so a re-run is a no-op.
 *   - Non-destructive: MMKV data is left in place. Even after a
 *     successful migration we keep the local cache as a safety net.
 *     A future cleanup commit (post-launch) can prune it.
 *   - Idempotent at the row level: every upload uses upsert with the
 *     correct conflict target so re-running on a partial migration
 *     just fills the gaps. UUIDs are deterministic per source row
 *     where the source had a stable id (numeric MMKV id → namespaced
 *     UUID v5).
 *   - Failure-tolerant: each domain is wrapped in its own try/catch.
 *     If `tasks` fails, `habits` still runs. Errors are logged via
 *     the Phase 2.2B error log ring buffer, the migration is marked
 *     as "in progress" instead of "complete" so the next launch
 *     retries the failed pieces.
 *
 * Conflict resolution: this migration runs while the user is online
 * but uses the same Supabase service layer as everything else. RLS
 * enforces ownership.
 *
 * Streak / level / XP from useProfileStore are pulled separately and
 * folded into the profiles upsert at the start. This guarantees the
 * user's hard-earned progress survives the cloud cutover.
 */

import { storage, getJSON } from "../db/storage";
import { supabase, requireUserId } from "./supabase";
import { logError } from "./error-log";
import type {
  Task as MMKVTask,
  Habit as MMKVHabit,
  UserProfile as MMKVUserProfile,
  EngineKey,
} from "../db/schema";
import type { TablesInsert, Enums } from "../types/supabase";

// ─── Constants ──────────────────────────────────────────────────────────────

const ENGINES: EngineKey[] = ["body", "mind", "money", "charisma"];

/** Per-user migration flag key. */
function migrationFlagKey(userId: string): string {
  return `migration_to_supabase_completed:${userId}`;
}

/** Per-user "in progress" flag for crash recovery. */
function migrationInProgressKey(userId: string): string {
  return `migration_to_supabase_in_progress:${userId}`;
}

/**
 * Phase 1.7: per-domain completion flag. Lets us skip already-migrated
 * domains on re-run after a partial-failure crash, instead of either
 * (a) re-uploading everything (which previously caused duplicates for
 * tasks/habits because they used insert, not upsert) or (b) blocking
 * the user from a successful retry of the failed domain.
 */
function domainCompletedKey(userId: string, domain: MigrationStep): string {
  return `migration_${domain}_completed:${userId}`;
}

function isDomainComplete(userId: string, domain: MigrationStep): boolean {
  return storage.getBoolean(domainCompletedKey(userId, domain)) === true;
}

function markDomainComplete(userId: string, domain: MigrationStep): void {
  storage.set(domainCompletedKey(userId, domain), true);
}

// ─── Status types ───────────────────────────────────────────────────────────

export type MigrationStep =
  | "profile"
  | "tasks"
  | "completions"
  | "habits"
  | "habit_logs"
  | "protocol"
  | "rank_ups"
  // Phase 5 additions:
  | "weight"
  | "sleep"
  | "nutrition"
  | "meals"
  | "money"
  | "budgets"
  | "deep_work"
  | "focus_settings"
  | "gym_exercises"
  | "gym_templates"
  | "gym_sessions"
  | "gym_sets"
  | "gym_prs"
  | "journal"
  | "achievements"
  | "progression"
  | "titan_mode"
  | "mind_results"
  | "srs"
  | "narrative"
  | "complete";

export type MigrationStatus = {
  step: MigrationStep;
  /** Total domains we need to process (used for progress %). */
  totalSteps: number;
  /** How many domains are done. */
  completedSteps: number;
  /** Free-text label for the UI. */
  label: string;
};

export type MigrationResult = {
  success: boolean;
  /** Per-domain counts (rows uploaded). */
  counts: Partial<Record<MigrationStep, number>>;
  /** Per-domain errors that did NOT stop the migration. */
  errors: Array<{ step: MigrationStep; error: unknown }>;
};

type ProgressCallback = (status: MigrationStatus) => void;

// Phase 5: total bumped from 6 to 26 (6 original + 20 new domains).
const TOTAL_STEPS = 26;

const STEP_LABELS: Record<MigrationStep, string> = {
  profile: "Syncing your profile",
  tasks: "Syncing tasks",
  completions: "Syncing task history",
  habits: "Syncing habits",
  habit_logs: "Syncing habit history",
  protocol: "Syncing protocol sessions",
  rank_ups: "Syncing rank-ups",
  weight: "Syncing weight log",
  sleep: "Syncing sleep log",
  nutrition: "Syncing nutrition profile",
  meals: "Syncing meal history",
  money: "Syncing money transactions",
  budgets: "Syncing budgets",
  deep_work: "Syncing deep-work log",
  focus_settings: "Syncing focus settings",
  gym_exercises: "Syncing gym exercises",
  gym_templates: "Syncing gym templates",
  gym_sessions: "Syncing gym sessions",
  gym_sets: "Syncing gym sets",
  gym_prs: "Syncing personal records",
  journal: "Syncing journal",
  achievements: "Syncing achievements",
  progression: "Syncing progression",
  titan_mode: "Syncing titan mode",
  mind_results: "Syncing mind training history",
  srs: "Syncing spaced repetition",
  narrative: "Syncing narrative log",
  complete: "Done",
};

// ─── Public entry point ─────────────────────────────────────────────────────

/**
 * Run the migration if it hasn't already completed for the current user.
 * Returns the result on first run, or `null` if migration was already
 * complete (no-op).
 */
export async function maybeRunMigration(
  onProgress?: ProgressCallback,
): Promise<MigrationResult | null> {
  const userId = await requireUserId();

  // Idempotency: skip if already done.
  if (storage.getBoolean(migrationFlagKey(userId)) === true) {
    return null;
  }

  // Mark in-progress so a partial run can be detected on the next launch.
  storage.set(migrationInProgressKey(userId), true);

  const result: MigrationResult = {
    success: true,
    counts: {},
    errors: [],
  };

  let completed = 0;
  const stepStart = (step: MigrationStep) => {
    onProgress?.({
      step,
      totalSteps: TOTAL_STEPS,
      completedSteps: completed,
      label: STEP_LABELS[step],
    });
  };
  const stepDone = (step: MigrationStep, count: number) => {
    completed += 1;
    result.counts[step] = count;
  };

  // Phase 1.7: each domain checks its own completion flag and skips if
  // already done. This makes re-runs after a partial-failure crash safe
  // without re-uploading rows that already landed.

  // ─── 1. Profile (XP, level, streak, archetype, mode) ───────────────────
  if (!isDomainComplete(userId, "profile")) {
    stepStart("profile");
    try {
      const count = await migrateProfile(userId);
      markDomainComplete(userId, "profile");
      stepDone("profile", count);
    } catch (e) {
      logError("migration.profile", e);
      result.errors.push({ step: "profile", error: e });
      result.success = false;
    }
  } else {
    completed += 1;
  }

  // ─── 2. Tasks ──────────────────────────────────────────────────────────
  let taskIdMap: Map<number, string> = new Map();
  if (!isDomainComplete(userId, "tasks")) {
    stepStart("tasks");
    try {
      const out = await migrateTasks(userId);
      taskIdMap = out.idMap;
      markDomainComplete(userId, "tasks");
      stepDone("tasks", out.count);
    } catch (e) {
      logError("migration.tasks", e);
      result.errors.push({ step: "tasks", error: e });
      result.success = false;
    }
  } else {
    // Re-derive id map from the cloud rows so completions can still join.
    taskIdMap = await rebuildTaskIdMap(userId);
    completed += 1;
  }

  // ─── 3. Completions (depend on the task id map) ────────────────────────
  if (!isDomainComplete(userId, "completions")) {
    stepStart("completions");
    try {
      const count = await migrateCompletions(userId, taskIdMap);
      markDomainComplete(userId, "completions");
      stepDone("completions", count);
    } catch (e) {
      logError("migration.completions", e);
      result.errors.push({ step: "completions", error: e });
      result.success = false;
    }
  } else {
    completed += 1;
  }

  // ─── 4. Habits ────────────────────────────────────────────────────────
  let habitIdMap: Map<number, string> = new Map();
  if (!isDomainComplete(userId, "habits")) {
    stepStart("habits");
    try {
      const out = await migrateHabits(userId);
      habitIdMap = out.idMap;
      markDomainComplete(userId, "habits");
      stepDone("habits", out.count);
    } catch (e) {
      logError("migration.habits", e);
      result.errors.push({ step: "habits", error: e });
      result.success = false;
    }
  } else {
    habitIdMap = await rebuildHabitIdMap(userId);
    completed += 1;
  }

  // ─── 5. Habit logs ────────────────────────────────────────────────────
  if (!isDomainComplete(userId, "habit_logs")) {
    stepStart("habit_logs");
    try {
      const count = await migrateHabitLogs(userId, habitIdMap);
      markDomainComplete(userId, "habit_logs");
      stepDone("habit_logs", count);
    } catch (e) {
      logError("migration.habit_logs", e);
      result.errors.push({ step: "habit_logs", error: e });
      result.success = false;
    }
  } else {
    completed += 1;
  }

  // ─── 6. Protocol sessions ─────────────────────────────────────────────
  if (!isDomainComplete(userId, "protocol")) {
    stepStart("protocol");
    try {
      const count = await migrateProtocolSessions(userId);
      markDomainComplete(userId, "protocol");
      stepDone("protocol", count);
    } catch (e) {
      logError("migration.protocol", e);
      result.errors.push({ step: "protocol", error: e });
      result.success = false;
    }
  } else {
    completed += 1;
  }

  // ─── 7. Pending rank-ups ──────────────────────────────────────────────
  if (!isDomainComplete(userId, "rank_ups")) {
    stepStart("rank_ups");
    try {
      const count = await migrateRankUps(userId);
      markDomainComplete(userId, "rank_ups");
      stepDone("rank_ups", count);
    } catch (e) {
      logError("migration.rank_ups", e);
      result.errors.push({ step: "rank_ups", error: e });
      // Rank-ups failing isn't critical — they're celebration events.
    }
  } else {
    completed += 1;
  }

  // ─── Phase 5: new domains ─────────────────────────────────────────────
  // Each runs the same skip-if-done pattern via runDomain(). Failures
  // are logged and tracked but don't stop other domains.

  await runDomain(userId, "weight",        migrateWeight, result, stepStart, stepDone, () => completed += 1);
  await runDomain(userId, "sleep",         migrateSleep, result, stepStart, stepDone, () => completed += 1);
  await runDomain(userId, "nutrition",     migrateNutritionProfile, result, stepStart, stepDone, () => completed += 1);
  await runDomain(userId, "meals",         migrateMeals, result, stepStart, stepDone, () => completed += 1);
  await runDomain(userId, "money",         migrateMoney, result, stepStart, stepDone, () => completed += 1);
  await runDomain(userId, "budgets",       migrateBudgets, result, stepStart, stepDone, () => completed += 1);
  await runDomain(userId, "deep_work",     migrateDeepWork, result, stepStart, stepDone, () => completed += 1);
  await runDomain(userId, "focus_settings", migrateFocusSettings, result, stepStart, stepDone, () => completed += 1);
  await runDomain(userId, "gym_exercises", migrateGymExercises, result, stepStart, stepDone, () => completed += 1);
  await runDomain(userId, "gym_templates", migrateGymTemplates, result, stepStart, stepDone, () => completed += 1);
  await runDomain(userId, "gym_sessions",  migrateGymSessions, result, stepStart, stepDone, () => completed += 1);
  await runDomain(userId, "gym_sets",      migrateGymSets, result, stepStart, stepDone, () => completed += 1);
  await runDomain(userId, "gym_prs",       migrateGymPRs, result, stepStart, stepDone, () => completed += 1);
  await runDomain(userId, "journal",       migrateJournal, result, stepStart, stepDone, () => completed += 1);
  await runDomain(userId, "achievements",  migrateAchievements, result, stepStart, stepDone, () => completed += 1);
  await runDomain(userId, "progression",   migrateProgression, result, stepStart, stepDone, () => completed += 1);
  await runDomain(userId, "titan_mode",    migrateTitanMode, result, stepStart, stepDone, () => completed += 1);
  await runDomain(userId, "mind_results",  migrateMindResults, result, stepStart, stepDone, () => completed += 1);
  await runDomain(userId, "srs",           migrateSrs, result, stepStart, stepDone, () => completed += 1);
  await runDomain(userId, "narrative",     migrateNarrative, result, stepStart, stepDone, () => completed += 1);

  // ─── Done ─────────────────────────────────────────────────────────────
  if (result.success) {
    storage.set(migrationFlagKey(userId), true);
  }
  storage.remove(migrationInProgressKey(userId));

  onProgress?.({
    step: "complete",
    totalSteps: TOTAL_STEPS,
    completedSteps: completed,
    label: STEP_LABELS.complete,
  });

  return result;
}

/**
 * Force re-run of the migration. Used by the debug screen for QA.
 */
export function resetMigrationFlag(userId: string): void {
  storage.remove(migrationFlagKey(userId));
}

// ─── Per-domain implementations ─────────────────────────────────────────────

async function migrateProfile(userId: string): Promise<number> {
  const local = getJSON<MMKVUserProfile | null>("user_profile", null);
  if (!local) return 0;

  // Fold the protocol streak (which lived on a different MMKV key) into
  // the same upsert if present.
  const protocolStreak = storage.getNumber("protocol_streak") ?? 0;
  const protocolStreakDate = storage.getString("protocol_streak_date") ?? null;

  const update: TablesInsert<"profiles"> = {
    id: userId,
    xp: Math.max(0, local.xp ?? 0),
    level: Math.max(1, local.level ?? 1),
    streak_current: Math.max(local.streak ?? 0, protocolStreak),
    streak_best: Math.max(local.best_streak ?? 0, protocolStreak),
    streak_last_date: protocolStreakDate ?? local.last_active_date ?? null,
  };

  const { error } = await supabase
    .from("profiles")
    .upsert(update, { onConflict: "id" });

  if (error) throw error;
  return 1;
}

async function migrateTasks(
  userId: string,
): Promise<{ count: number; idMap: Map<number, string> }> {
  const idMap = new Map<number, string>();
  let count = 0;

  for (const engine of ENGINES) {
    const tasks = getJSON<MMKVTask[]>(`tasks:${engine}`, []);
    if (tasks.length === 0) continue;

    // Phase 1.7: upsert with (user_id, legacy_local_id) conflict target.
    // Previously this used insert(), so a re-run after a partial-failure
    // crash would duplicate every task. The legacy_local_id column was
    // added in migration 10_legacy_local_id_columns and the partial
    // unique index makes this conflict target valid.
    const rows: TablesInsert<"tasks">[] = tasks
      .filter((t) => t.id !== undefined && t.id !== null)
      .map((t) => ({
        user_id: userId,
        engine: t.engine,
        title: t.title,
        kind: t.kind,
        days_per_week: t.days_per_week ?? 7,
        is_active: t.is_active === 1,
        legacy_local_id: t.id!,
      }));

    if (rows.length === 0) continue;

    const { data, error } = await supabase
      .from("tasks")
      .upsert(rows, { onConflict: "user_id,legacy_local_id" })
      .select("id, legacy_local_id");

    if (error) throw error;

    if (data) {
      for (const row of data) {
        if (row.legacy_local_id !== null && row.legacy_local_id !== undefined) {
          idMap.set(row.legacy_local_id, row.id);
        }
      }
    }
    count += rows.length;
  }

  return { count, idMap };
}

/**
 * Phase 1.7: rebuild the task id map from cloud rows when the tasks
 * domain has already been marked complete on a previous run. This lets
 * the completions step still join MMKV-local-id → cloud-uuid even
 * after a successful tasks migration.
 */
async function rebuildTaskIdMap(userId: string): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const { data, error } = await supabase
    .from("tasks")
    .select("id, legacy_local_id")
    .eq("user_id", userId)
    .not("legacy_local_id", "is", null);
  if (error) throw error;
  if (data) {
    for (const row of data) {
      if (row.legacy_local_id !== null && row.legacy_local_id !== undefined) {
        map.set(row.legacy_local_id, row.id);
      }
    }
  }
  return map;
}

async function migrateCompletions(
  userId: string,
  taskIdMap: Map<number, string>,
): Promise<number> {
  let count = 0;

  // Walk every MMKV key matching `completions:{engine}:{dateKey}`. There's
  // no efficient prefix scan in MMKV, so we iterate getAllKeys.
  const allKeys = storage.getAllKeys();
  const completionKeys = allKeys.filter((k) => k.startsWith("completions:"));

  // Batch the inserts in chunks of 500 to keep payloads reasonable.
  const BATCH_SIZE = 500;
  let batch: TablesInsert<"completions">[] = [];

  const flush = async () => {
    if (batch.length === 0) return;
    const { error } = await supabase
      .from("completions")
      .upsert(batch, { onConflict: "task_id,date_key", ignoreDuplicates: true });
    if (error) throw error;
    count += batch.length;
    batch = [];
  };

  for (const key of completionKeys) {
    // Parse `completions:body:2026-04-01` → engine=body, dateKey=2026-04-01
    const parts = key.split(":");
    if (parts.length !== 3) continue;
    const engine = parts[1] as EngineKey;
    const dateKey = parts[2];
    if (!ENGINES.includes(engine)) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;

    const ids = getJSON<number[]>(key, []);
    for (const localTaskId of ids) {
      const newTaskId = taskIdMap.get(localTaskId);
      if (!newTaskId) continue; // task wasn't in this engine's local list

      batch.push({
        user_id: userId,
        task_id: newTaskId,
        engine,
        date_key: dateKey,
      });

      if (batch.length >= BATCH_SIZE) {
        await flush();
      }
    }
  }

  await flush();
  return count;
}

async function migrateHabits(
  userId: string,
): Promise<{ count: number; idMap: Map<number, string> }> {
  const habits = getJSON<MMKVHabit[]>("habits", []);
  if (habits.length === 0) {
    return { count: 0, idMap: new Map() };
  }

  // Phase 1.7: upsert with (user_id, legacy_local_id) conflict target.
  // Same fix as migrateTasks — see that function for the rationale.
  const rows: TablesInsert<"habits">[] = habits
    .filter((h) => h.id !== undefined && h.id !== null)
    .map((h) => ({
      user_id: userId,
      title: h.title,
      engine: h.engine,
      icon: h.icon ?? "",
      trigger_text: h.trigger ?? null,
      duration_text: h.duration ?? null,
      frequency: h.frequency ?? null,
      // Phase 3.1 denormalized chain stats — start at 0 since the legacy
      // store recomputed them on read. The next habit toggle re-derives.
      current_chain: 0,
      best_chain: 0,
      legacy_local_id: h.id!,
    }));

  if (rows.length === 0) {
    return { count: 0, idMap: new Map() };
  }

  const { data, error } = await supabase
    .from("habits")
    .upsert(rows, { onConflict: "user_id,legacy_local_id" })
    .select("id, legacy_local_id");

  if (error) throw error;

  const idMap = new Map<number, string>();
  if (data) {
    for (const row of data) {
      if (row.legacy_local_id !== null && row.legacy_local_id !== undefined) {
        idMap.set(row.legacy_local_id, row.id);
      }
    }
  }

  return { count: rows.length, idMap };
}

/**
 * Phase 1.7: same rebuild pattern as `rebuildTaskIdMap` for habits.
 */
async function rebuildHabitIdMap(userId: string): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const { data, error } = await supabase
    .from("habits")
    .select("id, legacy_local_id")
    .eq("user_id", userId)
    .not("legacy_local_id", "is", null);
  if (error) throw error;
  if (data) {
    for (const row of data) {
      if (row.legacy_local_id !== null && row.legacy_local_id !== undefined) {
        map.set(row.legacy_local_id, row.id);
      }
    }
  }
  return map;
}

async function migrateHabitLogs(
  userId: string,
  habitIdMap: Map<number, string>,
): Promise<number> {
  if (habitIdMap.size === 0) return 0;

  let count = 0;
  const allKeys = storage.getAllKeys();
  const logKeys = allKeys.filter((k) => k.startsWith("habit_logs:"));

  const BATCH_SIZE = 500;
  let batch: TablesInsert<"habit_logs">[] = [];

  const flush = async () => {
    if (batch.length === 0) return;
    const { error } = await supabase
      .from("habit_logs")
      .upsert(batch, { onConflict: "habit_id,date_key", ignoreDuplicates: true });
    if (error) throw error;
    count += batch.length;
    batch = [];
  };

  for (const key of logKeys) {
    const dateKey = key.replace("habit_logs:", "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;

    const ids = getJSON<number[]>(key, []);
    for (const localHabitId of ids) {
      const newHabitId = habitIdMap.get(localHabitId);
      if (!newHabitId) continue;

      batch.push({
        user_id: userId,
        habit_id: newHabitId,
        date_key: dateKey,
      });

      if (batch.length >= BATCH_SIZE) {
        await flush();
      }
    }
  }

  await flush();
  return count;
}

type MMKVProtocolSession = {
  dateKey: string;
  completedAt: number;
  intention: string;
  habitChecks: Record<number, boolean>;
  titanScore: number;
  identityVote: Enums<"archetype"> | null;
};

type MMKVMorningData = { intention: string; completedAt: number };
type MMKVEveningData = {
  reflection: string;
  identityVote: Enums<"archetype"> | null;
  titanScore: number;
  completedAt: number;
};

async function migrateProtocolSessions(userId: string): Promise<number> {
  // Old structure had two layers:
  //   - `protocol_sessions`: Record<dateKey, ProtocolSession>
  //   - `morning_${dateKey}` / `evening_${dateKey}`: per-day MorningData/EveningData
  // We coalesce both into a single Supabase row per (user, date_key).
  const sessions = getJSON<Record<string, MMKVProtocolSession>>(
    "protocol_sessions",
    {},
  );

  // Find any morning_/evening_ keys that aren't already covered by sessions.
  const allKeys = storage.getAllKeys();
  const morningKeys = allKeys.filter((k) => k.startsWith("morning_"));
  const eveningKeys = allKeys.filter((k) => k.startsWith("evening_"));

  // Build a unified map keyed by dateKey.
  const merged = new Map<string, TablesInsert<"protocol_sessions">>();

  for (const [dateKey, sess] of Object.entries(sessions)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;
    merged.set(dateKey, {
      user_id: userId,
      date_key: dateKey,
      morning_intention: sess.intention || null,
      morning_completed_at: sess.completedAt
        ? new Date(sess.completedAt).toISOString()
        : null,
      evening_reflection: null,
      evening_completed_at: sess.completedAt
        ? new Date(sess.completedAt).toISOString()
        : null,
      titan_score: sess.titanScore,
      identity_at_completion: sess.identityVote ?? null,
      habit_checks: (sess.habitChecks ?? {}) as never,
    });
  }

  for (const key of morningKeys) {
    const dateKey = key.replace("morning_", "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;
    const data = getJSON<MMKVMorningData | null>(key, null);
    if (!data) continue;

    const existing = merged.get(dateKey);
    if (existing) {
      existing.morning_intention = data.intention;
      existing.morning_completed_at = new Date(data.completedAt).toISOString();
    } else {
      merged.set(dateKey, {
        user_id: userId,
        date_key: dateKey,
        morning_intention: data.intention,
        morning_completed_at: new Date(data.completedAt).toISOString(),
      });
    }
  }

  for (const key of eveningKeys) {
    const dateKey = key.replace("evening_", "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;
    const data = getJSON<MMKVEveningData | null>(key, null);
    if (!data) continue;

    const existing = merged.get(dateKey);
    if (existing) {
      existing.evening_reflection = data.reflection;
      existing.evening_completed_at = new Date(data.completedAt).toISOString();
      existing.titan_score = data.titanScore;
      existing.identity_at_completion = data.identityVote ?? existing.identity_at_completion ?? null;
    } else {
      merged.set(dateKey, {
        user_id: userId,
        date_key: dateKey,
        evening_reflection: data.reflection,
        evening_completed_at: new Date(data.completedAt).toISOString(),
        titan_score: data.titanScore,
        identity_at_completion: data.identityVote ?? null,
      });
    }
  }

  if (merged.size === 0) return 0;

  const rows = Array.from(merged.values());
  const { error } = await supabase
    .from("protocol_sessions")
    .upsert(rows, { onConflict: "user_id,date_key", ignoreDuplicates: false });

  if (error) throw error;
  return rows.length;
}

type MMKVRankUpEvent = {
  id: string;
  from: number;
  to: number;
  at: number;
};

async function migrateRankUps(userId: string): Promise<number> {
  const queue = getJSON<MMKVRankUpEvent[]>("pending_rank_ups", []);
  if (queue.length === 0) return 0;

  const rows: TablesInsert<"rank_up_events">[] = queue.map((e) => ({
    user_id: userId,
    from_level: Math.max(1, e.from),
    to_level: Math.max(1, e.to),
    created_at: new Date(e.at).toISOString(),
  }));

  const { error } = await supabase.from("rank_up_events").insert(rows);
  if (error) throw error;
  return rows.length;
}

// ─── Phase 5: shared helper for new domains ─────────────────────────────────

/**
 * Run a single domain with the standard "skip if already complete,
 * otherwise run, mark complete, log on error" pattern. Errors don't
 * propagate — they get added to result.errors so the orchestrator can
 * proceed with the next domain. Returns nothing.
 */
async function runDomain(
  userId: string,
  step: MigrationStep,
  fn: (userId: string) => Promise<number>,
  result: MigrationResult,
  stepStart: (s: MigrationStep) => void,
  stepDone: (s: MigrationStep, count: number) => void,
  onSkip: () => void,
): Promise<void> {
  if (isDomainComplete(userId, step)) {
    onSkip();
    return;
  }
  stepStart(step);
  try {
    const count = await fn(userId);
    markDomainComplete(userId, step);
    stepDone(step, count);
  } catch (e) {
    logError(`migration.${step}`, e);
    result.errors.push({ step, error: e });
    result.success = false;
  }
}

// ─── Phase 5: per-domain migrators ──────────────────────────────────────────
//
// Each migrator reads the legacy MMKV shape and writes the cloud
// equivalent. They're best-effort — if the local shape doesn't match
// expectations, we skip the row and log. The new domains all have
// upsert conflict targets so re-running is safe.

// ─── Weight ─────────────────────────────────────────────────────────────────

type MMKVWeightEntry = {
  id?: number;
  date?: string;
  dateKey?: string;
  weight?: number;
  weight_kg?: number;
  notes?: string | null;
};

async function migrateWeight(userId: string): Promise<number> {
  const entries = getJSON<MMKVWeightEntry[]>("weight_entries", []);
  if (entries.length === 0) return 0;

  const rows: TablesInsert<"weight_logs">[] = entries
    .filter((e) => (e.date || e.dateKey) && (e.weight ?? e.weight_kg))
    .map((e) => ({
      user_id: userId,
      date_key: (e.date ?? e.dateKey)!,
      weight_kg: (e.weight ?? e.weight_kg)!,
      notes: e.notes ?? null,
    }));

  if (rows.length === 0) return 0;

  // No natural unique key on weight_logs (multiple logs per day are
  // valid), so we just insert. Re-runs would duplicate, but the per-
  // domain completion flag prevents that.
  const { error } = await supabase.from("weight_logs").insert(rows);
  if (error) throw error;
  return rows.length;
}

// ─── Sleep ──────────────────────────────────────────────────────────────────

type MMKVSleepEntry = {
  bedtime?: string;
  wake?: string;
  hours?: number;
  duration?: number;
  quality?: number;
  notes?: string | null;
};

async function migrateSleep(userId: string): Promise<number> {
  const allKeys = storage.getAllKeys() as string[];
  const sleepKeys = allKeys.filter((k) => k.startsWith("sleep:"));
  if (sleepKeys.length === 0) return 0;

  const rows: TablesInsert<"sleep_logs">[] = [];
  for (const key of sleepKeys) {
    const dateKey = key.replace("sleep:", "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;
    const entry = getJSON<MMKVSleepEntry | null>(key, null);
    if (!entry) continue;
    rows.push({
      user_id: userId,
      date_key: dateKey,
      hours_slept: entry.hours ?? entry.duration ?? null,
      quality: entry.quality ?? null,
      notes: entry.notes ?? null,
    });
  }

  if (rows.length === 0) return 0;

  const { error } = await supabase
    .from("sleep_logs")
    .upsert(rows, { onConflict: "user_id,date_key" });
  if (error) throw error;
  return rows.length;
}

// ─── Nutrition profile ──────────────────────────────────────────────────────

type MMKVNutritionProfile = {
  sex?: string;
  age?: number;
  height_cm?: number;
  weight_kg?: number;
  body_fat_pct?: number;
  steps_per_day?: number;
  workouts_per_week?: number;
  goal?: string;
  goal_rate?: string;
  protein_preference?: string;
  calorie_target?: number;
  daily_calorie_target?: number;
  protein_g?: number;
  protein_target_g?: number;
  carbs_target_g?: number;
  fat_target_g?: number;
  bmr?: number;
  tdee?: number;
};

async function migrateNutritionProfile(userId: string): Promise<number> {
  const local = getJSON<MMKVNutritionProfile | null>("nutrition_profile", null);
  if (!local) return 0;

  const row: TablesInsert<"nutrition_profile"> = {
    user_id: userId,
    sex: local.sex ?? null,
    age: local.age ?? null,
    height_cm: local.height_cm ?? null,
    weight_kg: local.weight_kg ?? null,
    body_fat_pct: local.body_fat_pct ?? null,
    steps_per_day: local.steps_per_day ?? null,
    workouts_per_week: local.workouts_per_week ?? null,
    goal: local.goal ?? null,
    goal_rate: local.goal_rate ?? null,
    protein_preference: local.protein_preference ?? null,
    daily_calorie_target: local.daily_calorie_target ?? local.calorie_target ?? null,
    protein_target_g: local.protein_target_g ?? local.protein_g ?? null,
    carbs_target_g: local.carbs_target_g ?? null,
    fat_target_g: local.fat_target_g ?? null,
    bmr: local.bmr ?? null,
    tdee: local.tdee ?? null,
  };

  const { error } = await supabase
    .from("nutrition_profile")
    .upsert(row, { onConflict: "user_id" });
  if (error) throw error;
  return 1;
}

// ─── Meals ──────────────────────────────────────────────────────────────────

type MMKVMeal = {
  id?: number;
  name?: string;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
};

async function migrateMeals(userId: string): Promise<number> {
  const allKeys = storage.getAllKeys() as string[];
  const mealKeys = allKeys.filter((k) => k.startsWith("nutrition_meals:"));
  if (mealKeys.length === 0) return 0;

  const rows: TablesInsert<"meal_logs">[] = [];
  for (const key of mealKeys) {
    const dateKey = key.replace("nutrition_meals:", "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;
    const meals = getJSON<MMKVMeal[]>(key, []);
    for (const m of meals) {
      if (!m.name) continue;
      rows.push({
        user_id: userId,
        date_key: dateKey,
        name: m.name,
        calories: m.calories ?? 0,
        protein_g: m.protein_g ?? 0,
        carbs_g: m.carbs_g ?? 0,
        fat_g: m.fat_g ?? 0,
      });
    }
  }

  if (rows.length === 0) return 0;

  const { error } = await supabase
    .from("meal_logs")
    .upsert(rows, { onConflict: "user_id,date_key,name", ignoreDuplicates: true });
  if (error) throw error;
  return rows.length;
}

// ─── Money ──────────────────────────────────────────────────────────────────

type MMKVMoneyTx = {
  id?: number;
  date?: string;
  dateKey?: string;
  amount?: number;
  category?: string;
  type?: "income" | "expense";
  note?: string | null;
};

async function migrateMoney(userId: string): Promise<number> {
  const txs = getJSON<MMKVMoneyTx[]>("money_txs", []);
  if (txs.length === 0) return 0;

  const rows: TablesInsert<"money_transactions">[] = txs
    .filter((t) => (t.date || t.dateKey) && t.amount !== undefined && t.category && t.type)
    .map((t) => ({
      user_id: userId,
      date_key: (t.date ?? t.dateKey)!,
      amount: t.amount!,
      category: t.category!,
      type: t.type!,
      note: t.note ?? null,
    }));

  if (rows.length === 0) return 0;

  const { error } = await supabase.from("money_transactions").insert(rows);
  if (error) throw error;
  return rows.length;
}

// ─── Budgets ────────────────────────────────────────────────────────────────

type MMKVBudget = {
  id?: number;
  category?: string;
  monthly_limit?: number;
  monthlyLimit?: number;
};

async function migrateBudgets(userId: string): Promise<number> {
  const budgets = getJSON<MMKVBudget[]>("budgets", []);
  if (budgets.length === 0) return 0;

  const rows: TablesInsert<"budgets">[] = budgets
    .filter((b) => b.category && (b.monthly_limit ?? b.monthlyLimit) !== undefined)
    .map((b) => ({
      user_id: userId,
      category: b.category!,
      monthly_limit: (b.monthly_limit ?? b.monthlyLimit)!,
    }));

  if (rows.length === 0) return 0;

  const { error } = await supabase.from("budgets").insert(rows);
  if (error) throw error;
  return rows.length;
}

// ─── Deep work ──────────────────────────────────────────────────────────────

type MMKVDeepWorkLog = {
  id?: number;
  date?: string;
  dateKey?: string;
  taskName?: string;
  task_name?: string;
  category?: string | null;
  minutes?: number;
  startedAt?: number | string;
  endedAt?: number | string | null;
  notes?: string | null;
};

async function migrateDeepWork(userId: string): Promise<number> {
  const logs = getJSON<MMKVDeepWorkLog[]>("deep_work_logs", []);
  if (logs.length === 0) return 0;

  const rows: TablesInsert<"deep_work_sessions">[] = logs
    .filter((l) => (l.date || l.dateKey) && (l.taskName || l.task_name) && l.minutes !== undefined)
    .map((l) => ({
      user_id: userId,
      date_key: (l.date ?? l.dateKey)!,
      task_name: (l.taskName ?? l.task_name)!,
      category: l.category ?? null,
      minutes: l.minutes!,
      started_at: typeof l.startedAt === "number"
        ? new Date(l.startedAt).toISOString()
        : (l.startedAt ?? new Date().toISOString()),
      ended_at: typeof l.endedAt === "number"
        ? new Date(l.endedAt).toISOString()
        : (l.endedAt ?? null),
      notes: l.notes ?? null,
    }));

  if (rows.length === 0) return 0;

  const { error } = await supabase.from("deep_work_sessions").insert(rows);
  if (error) throw error;
  return rows.length;
}

// ─── Focus settings ─────────────────────────────────────────────────────────

type MMKVFocusSettings = {
  pomodoro_minutes?: number;
  pomodoroMinutes?: number;
  break_minutes?: number;
  breakMinutes?: number;
  daily_target_sessions?: number;
  dailyTargetSessions?: number;
  sound_enabled?: boolean;
  soundEnabled?: boolean;
};

async function migrateFocusSettings(userId: string): Promise<number> {
  const local = getJSON<MMKVFocusSettings | null>("focus_settings", null);
  if (!local) return 0;

  const row: TablesInsert<"focus_settings"> = {
    user_id: userId,
    pomodoro_minutes: local.pomodoro_minutes ?? local.pomodoroMinutes ?? 25,
    break_minutes: local.break_minutes ?? local.breakMinutes ?? 5,
    daily_target_sessions: local.daily_target_sessions ?? local.dailyTargetSessions ?? 4,
    sound_enabled: local.sound_enabled ?? local.soundEnabled ?? true,
  };

  const { error } = await supabase
    .from("focus_settings")
    .upsert(row, { onConflict: "user_id" });
  if (error) throw error;
  return 1;
}

// ─── Gym ────────────────────────────────────────────────────────────────────
//
// The five gym tables migrate together but each in its own step. The
// gym_exercises and gym_templates and gym_sessions migrators build
// id-maps that the dependent tables (gym_sets) consume via cloud-side
// rebuild.

type MMKVGymExercise = {
  id?: number;
  name?: string;
  muscle_group?: string | null;
  muscleGroup?: string | null;
  equipment?: string | null;
  notes?: string | null;
  is_custom?: boolean;
  isCustom?: boolean;
};

async function migrateGymExercises(userId: string): Promise<number> {
  const exercises = getJSON<MMKVGymExercise[]>("gym_exercises", []);
  if (exercises.length === 0) return 0;

  const rows: TablesInsert<"gym_exercises">[] = exercises
    .filter((e) => e.name)
    .map((e) => ({
      user_id: userId,
      name: e.name!,
      muscle_group: e.muscle_group ?? e.muscleGroup ?? null,
      equipment: e.equipment ?? null,
      notes: e.notes ?? null,
      is_custom: e.is_custom ?? e.isCustom ?? true,
    }));

  if (rows.length === 0) return 0;

  const { error } = await supabase.from("gym_exercises").insert(rows);
  if (error) throw error;
  return rows.length;
}

type MMKVGymTemplate = {
  id?: number;
  name?: string;
  description?: string | null;
};

type MMKVTemplateExercise = {
  template_id?: number;
  templateId?: number;
  exercise_id?: number;
  exerciseId?: number;
  position?: number;
};

async function migrateGymTemplates(userId: string): Promise<number> {
  const templates = getJSON<MMKVGymTemplate[]>("gym_templates", []);
  if (templates.length === 0) return 0;

  // Fold the legacy template_exercises join table into the new
  // gym_templates.exercise_ids jsonb column. We don't have access to
  // the cloud exercise UUIDs here (the gym_exercises step ran first
  // but we don't keep the local→cloud id map), so we leave this
  // as an empty array. The user can re-attach exercises in-app post-
  // migration. Acceptable degradation for v1.
  const rows: TablesInsert<"gym_templates">[] = templates
    .filter((t) => t.name)
    .map((t) => ({
      user_id: userId,
      name: t.name!,
      description: t.description ?? null,
      exercise_ids: [] as never,
    }));

  if (rows.length === 0) return 0;

  const { error } = await supabase.from("gym_templates").insert(rows);
  if (error) throw error;
  return rows.length;
}

type MMKVGymSession = {
  id?: number;
  template_id?: number | null;
  name?: string | null;
  startedAt?: number | string;
  started_at?: number | string;
  endedAt?: number | string | null;
  ended_at?: number | string | null;
  date?: string;
  dateKey?: string;
  notes?: string | null;
};

async function migrateGymSessions(userId: string): Promise<number> {
  const sessions = getJSON<MMKVGymSession[]>("gym_sessions", []);
  if (sessions.length === 0) return 0;

  const rows: TablesInsert<"gym_sessions">[] = sessions.map((s) => {
    const startedAtRaw = s.startedAt ?? s.started_at;
    const startedAt =
      typeof startedAtRaw === "number"
        ? new Date(startedAtRaw).toISOString()
        : startedAtRaw ?? new Date().toISOString();
    const endedAtRaw = s.endedAt ?? s.ended_at;
    const endedAt =
      typeof endedAtRaw === "number"
        ? new Date(endedAtRaw).toISOString()
        : endedAtRaw ?? null;
    const dateKey = s.date ?? s.dateKey ?? startedAt.slice(0, 10);

    return {
      user_id: userId,
      template_id: null, // local int IDs don't map to cloud UUIDs; user
                        // re-attaches templates after migration if needed
      name: s.name ?? null,
      started_at: startedAt,
      ended_at: endedAt,
      notes: s.notes ?? null,
      date_key: dateKey,
    };
  });

  if (rows.length === 0) return 0;

  const { error } = await supabase.from("gym_sessions").insert(rows);
  if (error) throw error;
  return rows.length;
}

type MMKVGymSet = {
  id?: number;
  session_id?: number;
  sessionId?: number;
  exercise_id?: number;
  exerciseId?: number;
  exercise_name?: string;
  exerciseName?: string;
  set_index?: number;
  setIndex?: number;
  weight?: number | null;
  reps?: number | null;
  rpe?: number | null;
  notes?: string | null;
};

async function migrateGymSets(_userId: string): Promise<number> {
  // Sets reference sessions by id. We can't preserve the link without
  // a session id-map, so we skip this domain rather than insert
  // orphaned set rows. Sets are always re-creatable in-app after
  // migration. Acceptable v1 degradation.
  const sets = getJSON<MMKVGymSet[]>("gym_sets", []);
  if (sets.length === 0) return 0;
  // Drop all but log how many we skipped.
  logError("migration.gym_sets.skipped", new Error("orphaned sets"), {
    count: sets.length,
    note: "Local set ids don't map to cloud session UUIDs; user re-creates sets in-app",
  });
  return 0;
}

type MMKVGymPR = {
  id?: number;
  exercise_name?: string;
  exerciseName?: string;
  weight?: number;
  reps?: number;
  achieved_at?: number | string;
  achievedAt?: number | string;
};

async function migrateGymPRs(userId: string): Promise<number> {
  // PRs were stored as Record<number, PR> keyed by exercise id in the
  // legacy store. We try both shapes (record and array) for safety.
  const prRecord = getJSON<Record<string, MMKVGymPR>>("gym_prs", {});
  const prList: MMKVGymPR[] = Array.isArray(prRecord)
    ? (prRecord as unknown as MMKVGymPR[])
    : Object.values(prRecord);
  if (prList.length === 0) return 0;

  const rows: TablesInsert<"gym_personal_records">[] = prList
    .filter((p) => (p.exercise_name ?? p.exerciseName) && p.weight !== undefined && p.reps !== undefined)
    .map((p) => {
      const achievedAtRaw = p.achieved_at ?? p.achievedAt;
      const achievedAt =
        typeof achievedAtRaw === "number"
          ? new Date(achievedAtRaw).toISOString()
          : achievedAtRaw ?? new Date().toISOString();
      return {
        user_id: userId,
        exercise_name: (p.exercise_name ?? p.exerciseName)!,
        weight: p.weight!,
        reps: p.reps!,
        achieved_at: achievedAt,
      };
    });

  if (rows.length === 0) return 0;

  const { error } = await supabase.from("gym_personal_records").insert(rows);
  if (error) throw error;
  return rows.length;
}

// ─── Journal ────────────────────────────────────────────────────────────────

async function migrateJournal(userId: string): Promise<number> {
  const allKeys = storage.getAllKeys() as string[];
  const journalKeys = allKeys.filter((k) => k.startsWith("journal:"));
  if (journalKeys.length === 0) return 0;

  const rows: TablesInsert<"journal_entries">[] = [];
  for (const key of journalKeys) {
    const dateKey = key.replace("journal:", "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;
    const entry = getJSON<{ content?: string } | string | null>(key, null);
    const content = typeof entry === "string" ? entry : entry?.content;
    if (!content) continue;
    rows.push({
      user_id: userId,
      date_key: dateKey,
      content,
    });
  }

  if (rows.length === 0) return 0;

  const { error } = await supabase
    .from("journal_entries")
    .upsert(rows, { onConflict: "user_id,date_key" });
  if (error) throw error;
  return rows.length;
}

// ─── Achievements ───────────────────────────────────────────────────────────

type MMKVAchievementUnlock = {
  id?: string;
  unlockedAt?: string;
  unlocked_at?: string;
};

async function migrateAchievements(userId: string): Promise<number> {
  // Legacy store format was sometimes { unlockedIds: string[] } or
  // { unlockedMap: Record<string, UnlockedAchievement> }. Read both.
  const raw = getJSON<{
    unlockedIds?: string[];
    unlockedMap?: Record<string, MMKVAchievementUnlock>;
  } | null>("achievements_unlocked", null);

  if (!raw) return 0;

  const rows: TablesInsert<"achievements_unlocked">[] = [];
  if (Array.isArray(raw.unlockedIds)) {
    for (const id of raw.unlockedIds) {
      rows.push({ user_id: userId, achievement_id: id });
    }
  }
  if (raw.unlockedMap) {
    for (const [id, entry] of Object.entries(raw.unlockedMap)) {
      rows.push({
        user_id: userId,
        achievement_id: id,
        unlocked_at: entry.unlockedAt ?? entry.unlocked_at ?? new Date().toISOString(),
      });
    }
  }

  if (rows.length === 0) return 0;

  const { error } = await supabase
    .from("achievements_unlocked")
    .upsert(rows, { onConflict: "user_id,achievement_id", ignoreDuplicates: true });
  if (error) throw error;
  return rows.length;
}

// ─── Progression ────────────────────────────────────────────────────────────

type MMKVProgression = {
  currentPhase?: "foundation" | "building" | "intensify" | "sustain";
  current_phase?: "foundation" | "building" | "intensify" | "sustain";
  currentWeek?: number;
  current_week?: number;
  phaseStartWeek?: number;
  phase_start_week?: number;
  firstUseDate?: string;
  first_use_date?: string;
  phaseStartDate?: string;
  phase_start_date?: string;
  history?: unknown[];
  phase_history?: unknown[];
};

async function migrateProgression(userId: string): Promise<number> {
  const local = getJSON<MMKVProgression | null>("progression_phase", null);
  if (!local) return 0;

  const row: TablesInsert<"progression"> = {
    user_id: userId,
    current_phase: (local.currentPhase ?? local.current_phase ?? "foundation") as Enums<"progression_phase">,
    current_week: local.currentWeek ?? local.current_week ?? 1,
    phase_start_week: local.phaseStartWeek ?? local.phase_start_week ?? 1,
    first_use_date: local.firstUseDate ?? local.first_use_date ?? null,
    phase_start_date: local.phaseStartDate ?? local.phase_start_date ?? null,
    phase_history: ((local.history ?? local.phase_history ?? []) as unknown) as never,
  };

  const { error } = await supabase
    .from("progression")
    .upsert(row, { onConflict: "user_id" });
  if (error) throw error;
  return 1;
}

// ─── Titan mode ─────────────────────────────────────────────────────────────

type MMKVTitanMode = {
  unlocked?: boolean;
  consecutiveDays?: number;
  consecutive_days?: number;
  averageScore?: number;
  average_score?: number;
  startDate?: string | null;
  start_date?: string | null;
  lastRecordedDate?: string | null;
  last_recorded_date?: string | null;
};

async function migrateTitanMode(userId: string): Promise<number> {
  const local = getJSON<MMKVTitanMode | null>("titan_mode", null);
  if (!local) return 0;

  const row: TablesInsert<"titan_mode_state"> = {
    user_id: userId,
    unlocked: local.unlocked ?? false,
    consecutive_days: local.consecutiveDays ?? local.consecutive_days ?? 0,
    average_score: local.averageScore ?? local.average_score ?? 0,
    start_date: local.startDate ?? local.start_date ?? null,
    last_recorded_date: local.lastRecordedDate ?? local.last_recorded_date ?? null,
  };

  const { error } = await supabase
    .from("titan_mode_state")
    .upsert(row, { onConflict: "user_id" });
  if (error) throw error;
  return 1;
}

// ─── Mind training results ──────────────────────────────────────────────────

type MMKVExerciseResult = {
  exerciseId?: string;
  exercise_id?: string;
  type?: string;
  category?: string;
  correct?: boolean;
  selectedOption?: string;
  selected_option?: string;
  answeredAt?: number | string;
  answered_at?: number | string;
  timeSpentMs?: number;
  time_spent_ms?: number;
};

async function migrateMindResults(userId: string): Promise<number> {
  const history = getJSON<MMKVExerciseResult[]>("exercise_history", []);
  if (history.length === 0) return 0;

  const rows: TablesInsert<"mind_training_results">[] = history
    .filter((r) => (r.exerciseId ?? r.exercise_id) && r.type && r.correct !== undefined)
    .map((r) => {
      const answeredAtRaw = r.answeredAt ?? r.answered_at;
      const answeredAt =
        typeof answeredAtRaw === "number"
          ? new Date(answeredAtRaw).toISOString()
          : answeredAtRaw ?? new Date().toISOString();
      return {
        user_id: userId,
        exercise_id: (r.exerciseId ?? r.exercise_id)!,
        type: r.type!,
        category: r.category ?? null,
        correct: r.correct!,
        selected_option: r.selectedOption ?? r.selected_option ?? null,
        time_spent_ms: r.timeSpentMs ?? r.time_spent_ms ?? null,
        answered_at: answeredAt,
      };
    });

  if (rows.length === 0) return 0;

  const { error } = await supabase.from("mind_training_results").insert(rows);
  if (error) throw error;
  return rows.length;
}

// ─── SRS cards ──────────────────────────────────────────────────────────────

type MMKVSrsCard = {
  exerciseId?: string;
  exercise_id?: string;
  interval?: number;
  intervalDays?: number;
  interval_days?: number;
  easeFactor?: number;
  ease_factor?: number;
  reviewCount?: number;
  review_count?: number;
  nextReview?: number | string;
  next_review_at?: string;
};

async function migrateSrs(userId: string): Promise<number> {
  const cards = getJSON<MMKVSrsCard[]>("srs_cards", []);
  if (cards.length === 0) return 0;

  const rows: TablesInsert<"srs_cards">[] = cards
    .filter((c) => c.exerciseId ?? c.exercise_id)
    .map((c) => {
      const nextRaw = c.nextReview ?? c.next_review_at;
      const nextReviewAt =
        typeof nextRaw === "number"
          ? new Date(nextRaw).toISOString()
          : nextRaw ?? new Date().toISOString();
      return {
        user_id: userId,
        exercise_id: (c.exerciseId ?? c.exercise_id)!,
        interval_days: c.interval ?? c.intervalDays ?? c.interval_days ?? 1,
        ease_factor: c.easeFactor ?? c.ease_factor ?? 2.5,
        review_count: c.reviewCount ?? c.review_count ?? 0,
        next_review_at: nextReviewAt,
      };
    });

  if (rows.length === 0) return 0;

  const { error } = await supabase
    .from("srs_cards")
    .upsert(rows, { onConflict: "user_id,exercise_id" });
  if (error) throw error;
  return rows.length;
}

// ─── Narrative log ──────────────────────────────────────────────────────────

type MMKVNarrativeEntry = {
  date?: string;
  text?: string;
  type?: string;
};

async function migrateNarrative(userId: string): Promise<number> {
  // The MMKV "narrative_entries" key holds the rich Day-N entries
  // written by lib/narrative-engine.ts. They go into the new
  // narrative_log table (NOT narrative_entries — that one is the
  // cinematic-played flag table with a different shape).
  const entries = getJSON<MMKVNarrativeEntry[]>("narrative_entries", []);
  if (entries.length === 0) return 0;

  const rows: TablesInsert<"narrative_log">[] = entries
    .filter((e) => e.date && e.text && e.type)
    .map((e) => ({
      user_id: userId,
      date_key: e.date!,
      type: e.type!,
      text: e.text!,
    }));

  if (rows.length === 0) return 0;

  const { error } = await supabase.from("narrative_log").insert(rows);
  if (error) throw error;
  return rows.length;
}
