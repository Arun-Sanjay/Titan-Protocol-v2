import { db, type FocusSettings, type FocusDaily } from "./db";
import { assertDateISO } from "./date";

// ---- defaults ----
const DEFAULT_SETTINGS: FocusSettings = {
  id: "default",
  focusMinutes: 50,
  breakMinutes: 10,
  longBreakMinutes: 15,
  longBreakAfter: 4,
  dailyTarget: 4,
};

// ---- settings ----

export async function getFocusSettings(): Promise<FocusSettings> {
  const existing = await db.focus_settings.get("default");
  return existing ?? { ...DEFAULT_SETTINGS };
}

export async function updateFocusSettings(
  patch: Partial<Omit<FocusSettings, "id">>,
): Promise<FocusSettings> {
  const current = await getFocusSettings();
  const next: FocusSettings = {
    ...current,
    ...patch,
    id: "default",
  };
  await db.focus_settings.put(next);
  return next;
}

// ---- daily record ----

export async function getFocusDailyRecord(
  dateKey: string,
): Promise<FocusDaily> {
  const safe = assertDateISO(dateKey);
  const existing = await db.focus_daily.get(safe);
  return existing ?? { dateKey: safe, completedSessions: 0 };
}

export async function incrementFocusSessions(
  dateKey: string,
): Promise<FocusDaily> {
  const safe = assertDateISO(dateKey);
  const existing = await db.focus_daily.get(safe);
  const next: FocusDaily = {
    dateKey: safe,
    completedSessions: (existing?.completedSessions ?? 0) + 1,
  };
  await db.focus_daily.put(next);
  return next;
}

// ---- weekly aggregate ----

export async function getFocusWeekSessions(): Promise<number> {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 6);
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const records = await db.focus_daily
    .where("dateKey")
    .between(fmt(weekAgo), fmt(today), true, true)
    .toArray();
  return records.reduce((sum, rec) => sum + rec.completedSessions, 0);
}
