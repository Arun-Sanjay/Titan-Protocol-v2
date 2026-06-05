// Format a Date object as YYYY-MM-DD in LOCAL timezone (not UTC)
// IMPORTANT: Never use d.toISOString().slice(0,10) — it converts to UTC
// and produces wrong dates in timezones east of UTC (e.g. IST, JST)
export function toLocalDateKey(d: Date): string {
  if (isNaN(d.getTime())) return getTodayKey(); // fallback to today for invalid dates
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getTodayKey(): string {
  return toLocalDateKey(new Date());
}

export function formatDateDisplay(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function formatDateShort(dateKey: string): string {
  if (!dateKey) return "--";
  const d = new Date(dateKey + "T00:00:00");
  if (isNaN(d.getTime())) return "--";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function addDays(dateKey: string, days: number): string {
  const d = new Date(dateKey + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toLocalDateKey(d);
}

export function getDayOfWeek(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

export function getMonthKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function getMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ─── ISO date helpers (mirrored from web/src/lib/date.ts) ───────────────────
// The ported scoring + dashboard-stats modules import these by their ISO
// names. All operate on YYYY-MM-DD strings in LOCAL time — never UTC.

export type DateISO = string;

export type DateParts = {
  year: number;
  month: number;
  day: number;
};

export type DateRangeBounds = {
  start: DateISO;
  end: DateISO;
};

export function assertDateISO(dateISO: string): DateISO {
  if (typeof dateISO !== "string") {
    throw new Error("dateISO must be a string");
  }
  const s = dateISO.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`Invalid dateISO: ${dateISO}`);
  }
  return s;
}

export function isDateISO(value: string): boolean {
  if (typeof value !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export function parseDateISO(dateISO: string): DateParts {
  const safe = assertDateISO(dateISO);
  const [year, month, day] = safe.split("-").map(Number);
  return { year, month, day };
}

export function dateKeyFromParts(parts: DateParts): DateISO {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function todayISO(): DateISO {
  return dateToISO(new Date());
}

export function dateFromISO(dateISO: string): Date {
  const { year, month, day } = parseDateISO(dateISO);
  return new Date(year, month - 1, day);
}

export function dateToISO(date: Date): DateISO {
  return dateKeyFromParts({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  });
}

export function addDaysISO(dateISO: string, deltaDays: number): DateISO {
  const next = dateFromISO(dateISO);
  next.setDate(next.getDate() + deltaDays);
  return dateToISO(next);
}

export function subDaysISO(dateISO: string, deltaDays: number): DateISO {
  return addDaysISO(dateISO, -Math.abs(deltaDays));
}

export function monthBounds(dateISO: string): DateRangeBounds {
  const { year, month } = parseDateISO(dateISO);
  const start = dateKeyFromParts({ year, month, day: 1 });
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const end = dateKeyFromParts({ year: nextMonth.year, month: nextMonth.month, day: 1 });
  return { start, end };
}

export function weekStartISO(dateISO: string): DateISO {
  const date = dateFromISO(dateISO);
  const dayOfWeek = date.getDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  date.setDate(date.getDate() - daysSinceMonday);
  return dateToISO(date);
}

export function weekRangeISO(dateISO: string): DateRangeBounds {
  const start = weekStartISO(dateISO);
  const end = addDaysISO(start, 6);
  return { start, end };
}

export function isDateInRangeISO(
  dateISO: string,
  startISO: string,
  endISO: string,
  options?: { endInclusive?: boolean },
): boolean {
  const date = assertDateISO(dateISO);
  const start = assertDateISO(startISO);
  const end = assertDateISO(endISO);
  if (options?.endInclusive === false) {
    return date >= start && date < end;
  }
  return date >= start && date <= end;
}

export function* iterateDateRangeISO(startISO: string, endISO: string): Generator<DateISO> {
  const start = assertDateISO(startISO);
  const end = assertDateISO(endISO);
  if (start > end) return;
  let cursor = start;
  while (cursor <= end) {
    yield cursor;
    cursor = addDaysISO(cursor, 1);
  }
}

export function listDateRangeISO(startISO: string, endISO: string): DateISO[] {
  return Array.from(iterateDateRangeISO(startISO, endISO));
}
