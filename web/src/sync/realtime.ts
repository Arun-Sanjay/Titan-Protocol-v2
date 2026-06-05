/**
 * Supabase Realtime subscription for the signed-in user.
 *
 * Opens one channel scoped to the user, listens for INSERT / UPDATE / DELETE
 * on every `SYNCED_TABLES` member filtered to `user_id=eq.<userId>`. On each
 * event we:
 *   1. Apply the change to the local SQLite cache (bypassing `cloudUpsert`
 *      because we're receiving FROM cloud, not writing TO it)
 *   2. Invalidate React Query so any open screen re-renders
 *
 * Server-side requirements (one-time, see migration
 * `enable_realtime_publication`):
 *   - Each synced table must be added to the `supabase_realtime` publication
 *   - Each table must have `REPLICA IDENTITY FULL` so DELETE events carry
 *     the full row (we need the primary key from the OLD record to remove
 *     it from SQLite)
 */

import type { RealtimeChannel } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/session";
import { run } from "../db/sqlite/client";
import { rowToSqlite } from "../db/sqlite/coerce";
import { logError } from "../lib/error-log";
import { SYNCED_TABLES, primaryKeyFor } from "./tables";
import { invalidateScoring, tableAffectsScoring } from "../lib/score-invalidation";
import { catchUpResync } from "./resync";

type ChangeEvent =
  | "INSERT"
  | "UPDATE"
  | "DELETE";

interface ChangePayload {
  eventType: ChangeEvent;
  table: string;
  schema: string;
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}

/**
 * Subscribe a user's row changes. Returns a teardown function that closes
 * the channel — call it when the user signs out or the provider unmounts.
 */
export function subscribeUserChanges(
  userId: string,
  queryClient: QueryClient,
): () => void {
  const channel: RealtimeChannel = supabase.channel(`user-${userId}-changes`);

  for (const table of SYNCED_TABLES) {
    const keyCol = REALTIME_KEY_COLUMN[table] ?? "user_id";
    channel.on(
      "postgres_changes" as never,
      {
        event: "*",
        schema: "public",
        table,
        filter: `${keyCol}=eq.${userId}`,
      } as never,
      (payload: unknown) => {
        const p = payload as ChangePayload;
        void handleChange(p, queryClient);
      },
    );
  }

  // Track joins so we can distinguish the first subscribe from a re-subscribe.
  // A re-SUBSCRIBED means the socket was down for a while (sleep, network
  // drop); Realtime does NOT replay postgres_changes missed during the gap,
  // so pull the cloud state back down to catch up.
  let hasJoinedBefore = false;
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      if (hasJoinedBefore) void catchUpResync(queryClient);
      hasJoinedBefore = true;
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      logError("realtime.channel.status", { status, userId });
    }
  });

  return () => {
    void supabase.removeChannel(channel);
  };
}

async function handleChange(
  payload: ChangePayload,
  queryClient: QueryClient,
): Promise<void> {
  const { table, eventType } = payload;

  try {
    if (eventType === "DELETE") {
      const pkCols = primaryKeyFor(table);
      const old = payload.old;
      const whereClause = pkCols.map((c) => `${c} = ?`).join(" AND ");
      await run(
        `DELETE FROM ${table} WHERE ${whereClause}`,
        pkCols.map((c) => old[c]),
      );
    } else {
      const row = payload.new;
      const sqliteReady = rowToSqlite(table, {
        ...row,
        _dirty: 0,
        _deleted: 0,
      });
      const cols = Object.keys(sqliteReady);
      const placeholders = cols.map(() => "?").join(", ");
      await run(
        `INSERT OR REPLACE INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`,
        cols.map((c) => sqliteReady[c]),
      );
    }
  } catch (err) {
    logError("realtime.apply.failed", err, { table, eventType });
    return;
  }

  // Broad invalidation — query keys vary across hooks (some use the
  // table name, some use a shorter root like "habits" for "habit_logs").
  // We invalidate via predicate so any active query gets refetched
  // regardless of its key convention.
  const tableRoot = SHORT_ROOT_FOR_TABLE[table] ?? table;
  queryClient.invalidateQueries({
    predicate: (q) => {
      const first = q.queryKey[0];
      return first === table || first === tableRoot;
    },
  });

  // Score caches (Titan score, engine calendars, week sparklines,
  // analytics) derive from `tasks` + `completions`. A push from another
  // device that changes either must invalidate the score caches too,
  // not just the table-specific keys.
  if (tableAffectsScoring(table)) {
    invalidateScoring(queryClient);
  }
}

/**
 * Per-table override for the postgres_changes filter column. Default is
 * `user_id` (every table follows the standard FK convention). `profiles`
 * is keyed by `id` because the row IS the auth user — adding a `user_id`
 * filter there yields no matches and the channel comes up CHANNEL_ERROR.
 */
const REALTIME_KEY_COLUMN: Partial<Record<string, string>> = {
  profiles: "id",
};

/**
 * Map a Supabase table name → the queryKey root some hooks use. Where the
 * hook uses the table name verbatim (e.g. `["weight_logs"]`), no mapping is
 * needed — the predicate match catches it directly. This map only covers
 * the cases where the hook uses a different short root than the table.
 */
const SHORT_ROOT_FOR_TABLE: Record<string, string> = {
  habit_logs: "habits",
  meal_logs: "nutrition",
  water_logs: "nutrition",
  quick_meals: "nutrition",
  nutrition_profile: "nutrition",
  money_transactions: "money",
  money_loans: "money",
  gym_exercises: "gym",
  gym_personal_records: "gym",
  gym_sessions: "gym",
  gym_sets: "gym",
  gym_templates: "gym",
  deep_work_logs: "deepWork",
  deep_work_sessions: "deepWork",
  deep_work_tasks: "deepWork",
  focus_sessions: "focus",
  focus_settings: "focus",
  mind_training_results: "mindTraining",
  narrative_entries: "narrative",
  narrative_log: "narrative",
  protocol_sessions: "protocol",
  boss_challenges: "bossChallenges",
  field_op_cooldown: "fieldOps",
  field_ops: "fieldOps",
  rank_up_events: "rankUps",
  achievements_unlocked: "achievements",
  skill_tree_progress: "skillTree",
  user_titles: "titles",
  titan_mode_state: "titanMode",
  profiles: "profile",
  // tasks, habits, goals, journal_entries, weight_logs, sleep_logs,
  // budgets, quests, completions, progression, subscriptions — these match
  // the predicate directly via the `table` literal.
};
