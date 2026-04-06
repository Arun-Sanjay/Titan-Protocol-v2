/**
 * Phase 2.4F: Tests for date helpers — particularly the local-timezone
 * formatting that the codebase comment in date.ts warns about.
 *
 * Streaks, completions, and protocol days all key off these dateKey
 * strings; getting them wrong (e.g. by using toISOString().slice) would
 * silently break streak calculation in any timezone east of UTC.
 */
import {
  toLocalDateKey,
  getTodayKey,
  addDays,
  formatDateShort,
  getMonthKey,
  getMonthLabel,
} from "../lib/date";

describe("toLocalDateKey", () => {
  it("formats a normal date as YYYY-MM-DD", () => {
    const d = new Date(2026, 3, 6); // April 6, 2026 (month is 0-indexed)
    expect(toLocalDateKey(d)).toBe("2026-04-06");
  });

  it("zero-pads single-digit months and days", () => {
    const d = new Date(2026, 0, 5); // January 5, 2026
    expect(toLocalDateKey(d)).toBe("2026-01-05");
  });

  it("falls back to today on invalid dates", () => {
    const invalid = new Date("not-a-date");
    expect(toLocalDateKey(invalid)).toBe(getTodayKey());
  });
});

describe("addDays", () => {
  it("advances by 1 day", () => {
    expect(addDays("2026-04-06", 1)).toBe("2026-04-07");
  });

  it("retreats by 1 day", () => {
    expect(addDays("2026-04-06", -1)).toBe("2026-04-05");
  });

  it("crosses month boundary forward", () => {
    expect(addDays("2026-04-30", 1)).toBe("2026-05-01");
  });

  it("crosses month boundary backward", () => {
    expect(addDays("2026-04-01", -1)).toBe("2026-03-31");
  });

  it("crosses year boundary forward", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("crosses year boundary backward", () => {
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("handles leap year February 29", () => {
    // 2028 is a leap year
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
  });

  it("handles non-leap year February", () => {
    // 2026 is not a leap year
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("handles week-long jumps", () => {
    expect(addDays("2026-04-06", 7)).toBe("2026-04-13");
    expect(addDays("2026-04-06", 30)).toBe("2026-05-06");
  });
});

describe("getMonthKey / getMonthLabel", () => {
  it("getMonthKey formats as YYYY-MM", () => {
    const d = new Date(2026, 3, 6);
    expect(getMonthKey(d)).toBe("2026-04");
  });

  it("getMonthLabel parses YYYY-MM into a long-form label", () => {
    expect(getMonthLabel("2026-04")).toBe("April 2026");
  });
});

describe("formatDateShort", () => {
  it("returns -- for empty input", () => {
    expect(formatDateShort("")).toBe("--");
  });

  it("returns -- for invalid date", () => {
    expect(formatDateShort("not-a-date")).toBe("--");
  });

  it("returns 'Apr 6' for 2026-04-06", () => {
    expect(formatDateShort("2026-04-06")).toBe("Apr 6");
  });
});
