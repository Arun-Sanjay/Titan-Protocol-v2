/**
 * Web copy of mobile-saas/src/lib/sleep-helpers.ts — the `notes`-JSON
 * envelope so web + mobile encode bedtime/wakeTime IDENTICALLY into the
 * shared `sleep_logs.notes` column. Web previously dropped bedtime/wakeTime
 * entirely (the page sent them via `as any` to a service that ignored them),
 * so every web sleep entry rendered "0h 0m" and a cross-device read saw a
 * different shape than mobile wrote (audit §5.9). Keep this in sync with the
 * mobile copy.
 *
 * Wrapper shape:  { v: 1, bed: "HH:MM", wake: "HH:MM", note: "..." }
 * Plain text (legacy / note-only rows) decodes as bed/wake = null.
 */
export type SleepNotesPayload = {
  bedtime: string | null;
  wakeTime: string | null;
  note: string;
};

const SLEEP_NOTES_VERSION = 1;

export function packSleepNotes(payload: {
  bedtime?: string | null;
  wakeTime?: string | null;
  note?: string | null;
}): string | null {
  const bed = payload.bedtime?.trim();
  const wake = payload.wakeTime?.trim();
  const note = payload.note?.trim() ?? "";
  if (!bed && !wake) {
    return note.length > 0 ? note : null;
  }
  return JSON.stringify({ v: SLEEP_NOTES_VERSION, bed: bed ?? null, wake: wake ?? null, note });
}

export function unpackSleepNotes(raw: string | null | undefined): SleepNotesPayload {
  if (!raw) return { bedtime: null, wakeTime: null, note: "" };
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return { bedtime: null, wakeTime: null, note: raw };
  try {
    const parsed = JSON.parse(trimmed) as {
      v?: number;
      bed?: string | null;
      wake?: string | null;
      note?: string;
    };
    if (parsed.v !== SLEEP_NOTES_VERSION) return { bedtime: null, wakeTime: null, note: raw };
    return { bedtime: parsed.bed ?? null, wakeTime: parsed.wake ?? null, note: parsed.note ?? "" };
  } catch {
    return { bedtime: null, wakeTime: null, note: raw };
  }
}

export function computeDurationMinutes(bedtime: string, wakeTime: string): number {
  const [bh, bm] = bedtime.split(":").map(Number);
  const [wh, wm] = wakeTime.split(":").map(Number);
  const bedMin = bh * 60 + bm;
  let wakeMin = wh * 60 + wm;
  if (wakeMin <= bedMin) wakeMin += 24 * 60;
  return wakeMin - bedMin;
}
