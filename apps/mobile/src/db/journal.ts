import { getDB } from "./database";
import type { JournalEntry } from "./schema";

export async function getJournalEntry(dateKey: string): Promise<JournalEntry | null> {
  const db = await getDB();
  return db.getFirstAsync<JournalEntry>(
    "SELECT * FROM journal_entries WHERE date_key = ?",
    [dateKey]
  );
}

export async function saveJournalEntry(dateKey: string, content: string): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT INTO journal_entries (date_key, content, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(date_key) DO UPDATE SET content = ?, updated_at = ?`,
    [dateKey, content, Date.now(), content, Date.now()]
  );
}

export async function listJournalEntries(limit = 30): Promise<JournalEntry[]> {
  const db = await getDB();
  return db.getAllAsync<JournalEntry>(
    "SELECT * FROM journal_entries ORDER BY date_key DESC LIMIT ?",
    [limit]
  );
}
