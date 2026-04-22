import { SYNCED_TABLES as ALL_TABLES } from "../db/sqlite/column-types";

/**
 * Ordered list of tables for the sync engine. The order is the PULL order
 * used by restore — parent tables come before children so foreign
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
 * Primary-key column list per table. Most tables are `['id']`; the
 * exceptions are the two composite-PK tables and the six one-row-per-user
 * tables. Used by the service layer to build WHERE clauses for
 * updates/deletes without hardcoding `id` everywhere.
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

export { ALL_TABLES as SYNCED_TABLES };
