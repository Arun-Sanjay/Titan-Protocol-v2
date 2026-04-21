import { requireUserId } from "../lib/supabase";
import {
  newId,
  sqliteDelete,
  sqliteList,
  sqliteUpsert,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type JournalEntry = Tables<"journal_entries">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listJournalEntries(): Promise<JournalEntry[]> {
  return sqliteList<JournalEntry>("journal_entries", {
    order: "date_key DESC",
  });
}

export async function getJournalEntry(
  dateKey: string,
): Promise<JournalEntry | null> {
  const [existing] = await sqliteList<JournalEntry>("journal_entries", {
    where: "date_key = ?",
    params: [dateKey],
    limit: 1,
  });
  return existing ?? null;
}

export async function upsertJournalEntry(entry: {
  date_key: string;
  content: string;
}): Promise<JournalEntry> {
  const userId = await requireUserId();
  const now = new Date().toISOString();

  const existing = await getJournalEntry(entry.date_key);

  if (existing) {
    const merged: JournalEntry = {
      ...existing,
      content: entry.content,
      updated_at: now,
    };
    return sqliteUpsert("journal_entries", merged);
  }

  const row: JournalEntry = {
    id: newId(),
    user_id: userId,
    date_key: entry.date_key,
    content: entry.content,
    created_at: now,
    updated_at: now,
  };
  return sqliteUpsert("journal_entries", row);
}

export async function deleteJournalEntry(entryId: string): Promise<void> {
  await sqliteDelete("journal_entries", { id: entryId });
}
