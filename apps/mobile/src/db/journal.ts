import { db } from "./database";
import type { JournalEntry } from "./schema";

export function getJournalEntry(dateKey: string): JournalEntry | null {
  return db.getFirstSync<JournalEntry>(
    "SELECT * FROM journal_entries WHERE date_key = ?",
    [dateKey]
  );
}

export function saveJournalEntry(dateKey: string, content: string): void {
  db.runSync(
    `INSERT INTO journal_entries (date_key, content, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(date_key) DO UPDATE SET content = ?, updated_at = ?`,
    [dateKey, content, Date.now(), content, Date.now()]
  );
}

export function listJournalEntries(limit = 30): JournalEntry[] {
  return db.getAllSync<JournalEntry>(
    "SELECT * FROM journal_entries ORDER BY date_key DESC LIMIT ?",
    [limit]
  );
}
