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
