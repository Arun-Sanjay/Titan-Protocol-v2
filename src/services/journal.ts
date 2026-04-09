/**
 * Phase 4: Journal entries service.
 *
 * One row per (user, date_key). Upsert pattern so the UI can autosave
 * blindly without checking existence.
 */

import { supabase, requireUserId } from "../lib/supabase";
import type { Tables, TablesInsert } from "../types/supabase";

export type JournalEntry = Tables<"journal_entries">;

export async function listJournalEntries(rangeDays?: number): Promise<JournalEntry[]> {
  let query = supabase
    .from("journal_entries")
    .select("*")
    .order("date_key", { ascending: false });

  if (rangeDays && rangeDays > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rangeDays);
    query = query.gte("date_key", cutoff.toISOString().slice(0, 10));
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getJournalEntry(dateKey: string): Promise<JournalEntry | null> {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("date_key", dateKey)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type UpsertJournalInput = {
  dateKey: string;
  content: string;
};

export async function upsertJournalEntry(
  input: UpsertJournalInput,
): Promise<JournalEntry> {
  const userId = await requireUserId();
  const row: TablesInsert<"journal_entries"> = {
    user_id: userId,
    date_key: input.dateKey,
    content: input.content,
  };
  const { data, error } = await supabase
    .from("journal_entries")
    .upsert(row, { onConflict: "user_id,date_key" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteJournalEntry(dateKey: string): Promise<void> {
  const { error } = await supabase
    .from("journal_entries")
    .delete()
    .eq("date_key", dateKey);
  if (error) throw error;
}
