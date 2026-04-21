import { SYNCED_TABLES as ALL_TABLES } from "../db/sqlite/column-types";

/**
 * Ordered list of tables for the sync engine. The order is the PULL order
 * used by `initialSeed` — parent tables come before children so foreign
 * references exist by the time dependent rows land. Push order doesn't
 * matter (Supabase only cares about RLS + NOT NULL).
 *
 * The source order here is tuned so `profiles` lands first (the FK parent
 * for every other user-scoped table). The remaining tables follow in
 * alphabetical order — exact pull order doesn't matter for child tables
 * since we don't declare FKs in SQLite.
 */
export const PULL_ORDER: readonly string[] = [
  "profiles",
  ...ALL_TABLES.filter((t) => t !== "profiles").sort(),
];

/**
 * React Query key roots per table. After a pull populates new rows we
 * invalidate the matching key so the UI refetches from SQLite. Keys that
 * aren't listed fall back to invalidating `[tableName]` as the root.
 *
 * NOTE: React Query `invalidateQueries({ queryKey: [X] })` matches any
 * query whose key STARTS WITH `[X]`, so listing the root segment is
 * sufficient — we don't need to enumerate every sub-key.
 */
export const TABLE_QUERY_KEY_ROOTS: Record<string, readonly string[]> = {
  tasks: ["tasks"],
  completions: ["completions"],
  habits: ["habits"],
  habit_logs: ["habit_logs"],
  profiles: ["profile"],
  progression: ["progression"],
  rank_up_events: ["rank_up_events"],
  titan_mode_state: ["titan_mode"],
  user_titles: ["titles"],
  field_ops: ["field_ops"],
  field_op_cooldown: ["field_ops"],
  skill_tree_progress: ["skill_tree"],
  protocol_sessions: ["protocol"],
  budgets: ["budgets"],
  money_transactions: ["money"],
  money_loans: ["money"],
  journal_entries: ["journal"],
  achievements_unlocked: ["achievements"],
  goals: ["goals"],
  quests: ["quests"],
  boss_challenges: ["boss_challenges"],
  mind_training_results: ["mind_training"],
  srs_cards: ["srs"],
  deep_work_tasks: ["deep_work"],
  deep_work_sessions: ["deep_work"],
  deep_work_logs: ["deep_work"],
  focus_sessions: ["focus"],
  focus_settings: ["focus"],
  narrative_entries: ["narrative"],
  narrative_log: ["narrative"],
  gym_sessions: ["gym"],
  gym_sets: ["gym"],
  gym_exercises: ["gym"],
  gym_templates: ["gym"],
  gym_personal_records: ["gym"],
  nutrition_profile: ["nutrition"],
  meal_logs: ["nutrition"],
  quick_meals: ["nutrition"],
  water_logs: ["nutrition"],
  sleep_logs: ["sleep"],
  weight_logs: ["weight"],
  subscriptions: ["subscriptions"],
};

export function queryKeysFor(table: string): readonly string[] {
  return TABLE_QUERY_KEY_ROOTS[table] ?? [table];
}

/**
 * Primary-key column list per table. Most tables are `['id']`; the
 * exceptions are the two composite-PK tables and the six one-row-per-user
 * tables. Used by the sync engine + service layer to build WHERE clauses
 * for updates/deletes without hardcoding `id` everywhere.
 */
export const PRIMARY_KEYS: Record<string, readonly string[]> = {
  srs_cards: ["user_id", "exercise_id"],
  user_titles: ["user_id", "title_id"],
  field_op_cooldown: ["user_id"],
  focus_settings: ["user_id"],
  nutrition_profile: ["user_id"],
  progression: ["user_id"],
  subscriptions: ["user_id"],
  titan_mode_state: ["user_id"],
};

export function primaryKeyFor(table: string): readonly string[] {
  return PRIMARY_KEYS[table] ?? ["id"];
}

/**
 * Build a stable string identifier for a row from its PK column(s).
 * Used as `pending_mutations.row_id` and part of the mutation `id`.
 */
export function rowIdentifier(table: string, row: Record<string, unknown>): string {
  const pkCols = primaryKeyFor(table);
  return pkCols.map((c) => String(row[c] ?? "")).join("/");
}

export { ALL_TABLES as SYNCED_TABLES };
