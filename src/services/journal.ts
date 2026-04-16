import { supabase, requireUserId } from "../lib/supabase";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type JournalEntry = Tables<"journal_entries">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listJournalEntries(): Promise<JournalEntry[]> {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .order("date_key", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getJournalEntry(
  dateKey: string,
): Promise<JournalEntry | null> {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("date_key", dateKey)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertJournalEntry(entry: {
  date_key: string;
  content: string;
}): Promise<JournalEntry> {
  const userId = await requireUserId();

  // Check if entry exists for this date
  const { data: existing } = await supabase
    .from("journal_entries")
    .select("id")
    .eq("date_key", entry.date_key)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("journal_entries")
      .update({ content: entry.content, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from("journal_entries")
      .insert({
        user_id: userId,
        date_key: entry.date_key,
        content: entry.content,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

export async function deleteJournalEntry(entryId: string): Promise<void> {
  const { error } = await supabase
    .from("journal_entries")
    .delete()
    .eq("id", entryId);
  if (error) throw error;
}
