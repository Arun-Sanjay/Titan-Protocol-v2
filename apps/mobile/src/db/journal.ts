import { getJSON, setJSON } from "./storage";
import type { JournalEntry } from "./schema";

function journalKey(dateKey: string): string {
  return `journal:${dateKey}`;
}

export function getJournalEntry(dateKey: string): JournalEntry | null {
  const entry = getJSON<JournalEntry | null>(journalKey(dateKey), null);
  return entry;
}

export function saveJournalEntry(dateKey: string, content: string): void {
  const entry: JournalEntry = {
    date_key: dateKey,
    content,
    updated_at: Date.now(),
  };
  setJSON(journalKey(dateKey), entry);
}

export function listJournalEntries(limit = 30): JournalEntry[] {
  // MMKV doesn't have range queries, so we scan recent dates
  const entries: JournalEntry[] = [];
  const today = new Date();

  for (let i = 0; i < 90 && entries.length < limit; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().slice(0, 10);
    const entry = getJournalEntry(dateKey);
    if (entry && entry.content) {
      entries.push(entry);
    }
  }

  return entries;
}
