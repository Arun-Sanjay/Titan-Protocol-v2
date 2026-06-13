import { requireUserId } from "../lib/session";
import {
  newId,
  cloudDelete,
  sqliteList,
  cloudUpsert,
} from "../db/sqlite/service-helpers";
import type { Tables } from "@titan/shared/types/supabase";
import {
  packSleepNotes,
  unpackSleepNotes,
  computeDurationMinutes,
  type SleepNotesPayload,
} from "../lib/sleep-helpers";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type SleepLog = Tables<"sleep_logs">;

/**
 * The row plus the bedtime/wakeTime/note decoded from the `notes` JSON
 * envelope, and a derived `duration_minutes` — so the UI gets the real sleep
 * window instead of rendering "0h 0m" (audit §5.9). Matches mobile-saas.
 */
export type SleepLogWithSchedule = SleepLog & {
  bedtime: string | null;
  wakeTime: string | null;
  note: string;
  duration_minutes: number;
};

function decorate(log: SleepLog): SleepLogWithSchedule {
  const parsed = unpackSleepNotes(log.notes);
  const duration =
    parsed.bedtime && parsed.wakeTime
      ? computeDurationMinutes(parsed.bedtime, parsed.wakeTime)
      : Math.round((log.hours_slept ?? 0) * 60);
  return {
    ...log,
    bedtime: parsed.bedtime,
    wakeTime: parsed.wakeTime,
    note: parsed.note,
    duration_minutes: duration,
  };
}

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listSleepLogs(): Promise<SleepLogWithSchedule[]> {
  const rows = await sqliteList<SleepLog>("sleep_logs", { order: "date_key DESC" });
  return rows.map(decorate);
}

/**
 * Upsert a sleep log. `bedtime`/`wakeTime` are HH:MM strings packed into the
 * `notes` column as a JSON envelope (same as mobile), and `hours_slept` is
 * derived from the schedule when available so duration survives the round
 * trip and cross-device reads agree. Backward-compatible with plain-text notes.
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

  const existingPayload: SleepNotesPayload = existing
    ? unpackSleepNotes(existing.notes)
    : { bedtime: null, wakeTime: null, note: "" };

  const nextBed = log.bedtime !== undefined ? log.bedtime : existingPayload.bedtime;
  const nextWake = log.wakeTime !== undefined ? log.wakeTime : existingPayload.wakeTime;
  const nextNote = log.notes !== undefined ? log.notes : existingPayload.note;
  const packedNotes = packSleepNotes({ bedtime: nextBed, wakeTime: nextWake, note: nextNote });

  const derivedHours =
    nextBed && nextWake
      ? Math.round((computeDurationMinutes(nextBed, nextWake) / 60) * 10) / 10
      : undefined;

  if (existing) {
    const merged: SleepLog = {
      ...existing,
      hours_slept: log.hours_slept ?? derivedHours ?? existing.hours_slept,
      quality: log.quality ?? existing.quality,
      notes: packedNotes,
    };
    return decorate(await cloudUpsert("sleep_logs", merged));
  }

  const row: SleepLog = {
    id: newId(),
    user_id: userId,
    date_key: log.date_key,
    hours_slept: log.hours_slept ?? derivedHours ?? null,
    quality: log.quality ?? null,
    notes: packedNotes,
    created_at: new Date().toISOString(),
  };
  return decorate(await cloudUpsert("sleep_logs", row));
}

export async function deleteSleepLog(logId: string): Promise<void> {
  await cloudDelete("sleep_logs", { id: logId });
}
