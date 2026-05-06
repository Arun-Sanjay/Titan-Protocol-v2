import { requireUserId } from "../lib/supabase";
import {
  newId,
  sqliteDelete,
  sqliteList,
  sqliteUpsert,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";
import {
  packSleepNotes,
  unpackSleepNotes,
  type SleepNotesPayload,
} from "../lib/sleep-helpers";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type SleepLog = Tables<"sleep_logs">;

/**
 * Convenience wrapper that exposes the parsed bedtime/wakeTime/note from
 * the `notes` JSON envelope so callers don't have to remember the
 * encoding. The raw `notes` column is preserved on the row.
 */
export type SleepLogWithSchedule = SleepLog & {
  bedtime: string | null;
  wakeTime: string | null;
  note: string;
};

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listSleepLogs(): Promise<SleepLogWithSchedule[]> {
  const rows = await sqliteList<SleepLog>("sleep_logs", {
    order: "date_key DESC",
  });
  return rows.map(decorate);
}

function decorate(log: SleepLog): SleepLogWithSchedule {
  const parsed = unpackSleepNotes(log.notes);
  return {
    ...log,
    bedtime: parsed.bedtime,
    wakeTime: parsed.wakeTime,
    note: parsed.note,
  };
}

/**
 * Upsert a sleep log. `bedtime` and `wakeTime` are HH:MM strings —
 * they're stashed into the `notes` column as a JSON envelope so the
 * actual sleep window survives the round trip. Without this, the UI
 * collected schedule data but the service threw it away, and a later
 * read invented a 7 am wake time, fabricating timeline + consistency
 * metrics.
 *
 * Backward-compatible: rows whose `notes` is plain text continue to
 * decode as `{ bedtime: null, wakeTime: null, note: "<text>" }`.
 */
export async function upsertSleepLog(log: {
  date_key: string;
  hours_slept?: number;
  quality?: number;
  bedtime?: string | null;
  wakeTime?: string | null;
  notes?: string;
}): Promise<SleepLogWithSchedule> {
  const userId = await requireUserId();
  const [existing] = await sqliteList<SleepLog>("sleep_logs", {
    where: "date_key = ?",
    params: [log.date_key],
    limit: 1,
  });

  // If the caller didn't supply bed/wake/notes, preserve whatever the
  // existing row had so a partial edit (e.g. just the quality) doesn't
  // blow away the schedule we already saved.
  const existingPayload: SleepNotesPayload = existing
    ? unpackSleepNotes(existing.notes)
    : { bedtime: null, wakeTime: null, note: "" };

  const nextBed =
    log.bedtime !== undefined ? log.bedtime : existingPayload.bedtime;
  const nextWake =
    log.wakeTime !== undefined ? log.wakeTime : existingPayload.wakeTime;
  const nextNote =
    log.notes !== undefined ? log.notes : existingPayload.note;
  const packedNotes = packSleepNotes({
    bedtime: nextBed,
    wakeTime: nextWake,
    note: nextNote,
  });

  if (existing) {
    const merged: SleepLog = {
      ...existing,
      hours_slept: log.hours_slept ?? existing.hours_slept,
      quality: log.quality ?? existing.quality,
      notes: packedNotes,
    };
    const saved = await sqliteUpsert("sleep_logs", merged);
    return decorate(saved);
  }

  const row: SleepLog = {
    id: newId(),
    user_id: userId,
    date_key: log.date_key,
    hours_slept: log.hours_slept ?? null,
    quality: log.quality ?? null,
    notes: packedNotes,
    created_at: new Date().toISOString(),
  };
  const saved = await sqliteUpsert("sleep_logs", row);
  return decorate(saved);
}

export async function deleteSleepLog(logId: string): Promise<void> {
  await sqliteDelete("sleep_logs", { id: logId });
}
