/**
 * Phase 4: Narrative service.
 *
 * Two cloud tables, two distinct concerns:
 *
 *   - narrative_entries (the existing table) holds cinematic-played
 *     flag rows: (id, user_id, flag, seen_at). Used to gate "have I
 *     seen this cinematic yet" without re-firing it.
 *   - narrative_log (added in migration 09_remaining_domain_tables)
 *     holds the rich Day-N entries that lib/narrative-engine.ts writes:
 *     (id, user_id, date_key, type, text, created_at).
 *
 * Two service functions per table to keep the call sites clear.
 */

import { supabase, requireUserId } from "../lib/supabase";
import type { Tables, TablesInsert } from "../types/supabase";

// ─── Cinematic flags ────────────────────────────────────────────────────────

export type NarrativeFlag = Tables<"narrative_entries">;

export async function listSeenFlags(): Promise<NarrativeFlag[]> {
  const { data, error } = await supabase
    .from("narrative_entries")
    .select("*")
    .order("seen_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function markFlagSeen(flag: string): Promise<NarrativeFlag> {
  const userId = await requireUserId();
  const row: TablesInsert<"narrative_entries"> = {
    user_id: userId,
    flag,
  };
  const { data, error } = await supabase
    .from("narrative_entries")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Rich narrative log ─────────────────────────────────────────────────────

export type NarrativeLogEntry = Tables<"narrative_log">;
export type NarrativeEntryType =
  | "protocol"
  | "streak"
  | "neglect"
  | "perfect"
  | "level_up"
  | "skill_node"
  | "phase"
  | "milestone"
  | "day_one"
  | "story";

export async function listNarrativeLog(rangeDays?: number): Promise<NarrativeLogEntry[]> {
  let query = supabase
    .from("narrative_log")
    .select("*")
    .order("date_key", { ascending: false })
    .order("created_at", { ascending: false });

  if (rangeDays && rangeDays > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rangeDays);
    query = query.gte("date_key", cutoff.toISOString().slice(0, 10));
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export type AddNarrativeEntryInput = {
  dateKey: string;
  type: NarrativeEntryType;
  text: string;
};

export async function addNarrativeLogEntry(
  input: AddNarrativeEntryInput,
): Promise<NarrativeLogEntry> {
  const userId = await requireUserId();
  const row: TablesInsert<"narrative_log"> = {
    user_id: userId,
    date_key: input.dateKey,
    type: input.type,
    text: input.text,
  };
  const { data, error } = await supabase
    .from("narrative_log")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteNarrativeLogEntry(id: string): Promise<void> {
  const { error } = await supabase.from("narrative_log").delete().eq("id", id);
  if (error) throw error;
}
