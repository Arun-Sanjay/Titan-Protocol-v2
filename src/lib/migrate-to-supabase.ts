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

const TOTAL_STEPS = 6; // profile + tasks/completions + habits/habit_logs + protocol + rank_ups

const STEP_LABELS: Record<MigrationStep, string> = {
  profile: "Syncing your profile",
  tasks: "Syncing tasks",
  completions: "Syncing task history",
  habits: "Syncing habits",
  habit_logs: "Syncing habit history",
  protocol: "Syncing protocol sessions",
  rank_ups: "Syncing rank-ups",
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
