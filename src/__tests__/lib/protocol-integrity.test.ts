/**
 * Tests for the engagement-based progress day counter and the integrity
 * gap-handling logic in `src/lib/protocol-integrity.ts`.
 *
 * The behavioural contract this file pins:
 *
 *   1. `recordCompletion()` is idempotent same-local-day. The function
 *      gets called from every engagement chokepoint (task tick, morning
 *      protocol save, evening protocol save), and a tap-storm must NOT
 *      multi-advance the progress counter.
 *
 *   2. The progress day is monotonic. A user who reaches Day 7, then
 *      disappears for a week, then returns sees Day 7 in HQ — not Day 14
 *      (the calendar-based behaviour we replaced) and not Day 1 (a hard
 *      reset). Streak goes to RESET, but progress stays put.
 *
 *   3. Streak gap math (1d = WARNING, 2d = BREACH, 3+d = RESET) and the
 *      3-day recovery mechanic both still work end-to-end now that
 *      `recordCompletion()` is wired into the chokepoints — previously
 *      it was dead code.
 *
 *   4. `resetProgress()` rewinds story state (progress, streak, integrity,
 *      cinematic-played flags, briefing-seen flags) without touching
 *      anything that's outside its key prefix list.
 */

// ─── In-memory MMKV mock ────────────────────────────────────────────────────

const mockMmkv = new Map<string, string>();

jest.mock("../../db/storage", () => ({
  getJSON: <T,>(key: string, fallback: T): T => {
    const raw = mockMmkv.get(key);
    if (raw === undefined) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  setJSON: (key: string, value: unknown) => {
    mockMmkv.set(key, JSON.stringify(value));
  },
  storage: {
    getAllKeys: () => Array.from(mockMmkv.keys()),
    remove: (key: string) => mockMmkv.delete(key),
  },
}));

// Mock today's date so the streak-gap math is deterministic. The helper
// functions below set `mockToday.value` and the mock looks at it.
const mockToday = { value: "2026-05-01" };
jest.mock("../../lib/date", () => ({
  getTodayKey: () => mockToday.value,
  toLocalDateKey: (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  },
  addDays: (dateKey: string, days: number) => {
    const d = new Date(dateKey + "T00:00:00");
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  },
}));

import {
  recordCompletion,
  checkIntegrityStatus,
  getProgressDay,
  setProgressDay,
  resetProgress,
  loadIntegrity,
} from "../../lib/protocol-integrity";

function setToday(dateKey: string): void {
  mockToday.value = dateKey;
}

beforeEach(() => {
  mockMmkv.clear();
  setToday("2026-05-01");
});

// ─── Progress day basics ────────────────────────────────────────────────────

describe("getProgressDay / setProgressDay", () => {
  test("defaults to 1 on a fresh install", () => {
    expect(getProgressDay()).toBe(1);
  });

  test("setProgressDay round-trips, clamped at 1", () => {
    setProgressDay(7);
    expect(getProgressDay()).toBe(7);
    setProgressDay(0);
    expect(getProgressDay()).toBe(1);
    setProgressDay(-5);
    expect(getProgressDay()).toBe(1);
  });
});

// ─── recordCompletion semantics ─────────────────────────────────────────────

describe("recordCompletion", () => {
  test("first-ever call seeds lastCompletionDate without touching progress_day", () => {
    // Onboarding has stamped progress_day = 1. The user's very first
    // task tick lands on the same calendar day as onboarding finished,
    // so we must NOT advance the counter to 2.
    setProgressDay(1);
    setToday("2026-05-01");

    const state = recordCompletion();

    expect(getProgressDay()).toBe(1);
    expect(state.lastCompletionDate).toBe("2026-05-01");
    expect(state.streak).toBe(1);
  });

  test("second call same-day is a no-op (idempotency)", () => {
    setProgressDay(1);
    setToday("2026-05-01");
    recordCompletion();
    recordCompletion();
    recordCompletion();

    expect(getProgressDay()).toBe(1);
    expect(loadIntegrity().streak).toBe(1);
  });

  test("first call on a new day advances progress and increments streak", () => {
    setProgressDay(1);
    setToday("2026-05-01");
    recordCompletion();

    setToday("2026-05-02");
    const state = recordCompletion();

    expect(getProgressDay()).toBe(2);
    expect(state.streak).toBe(2);
    expect(state.lastCompletionDate).toBe("2026-05-02");
  });

  test("seven consecutive days reach Day 7 with streak 7", () => {
    setProgressDay(1);
    for (let i = 0; i < 7; i++) {
      setToday(`2026-05-0${i + 1}`);
      recordCompletion();
    }
    expect(getProgressDay()).toBe(7);
    expect(loadIntegrity().streak).toBe(7);
  });
});

// ─── The motivating scenario: gap returns ───────────────────────────────────

describe("user disappears for a few days and returns", () => {
  function buildBaselineThroughDay2(): void {
    // Day 1 onboarding seeds counter.
    setProgressDay(1);
    // Day 1 first task tick.
    setToday("2026-05-01");
    recordCompletion();
    // Day 2 first task tick.
    setToday("2026-05-02");
    recordCompletion();
  }

  test("after 1 day off the gap-check returns WARNING", () => {
    buildBaselineThroughDay2();
    // User skips 2026-05-03, opens app on 2026-05-04. That's a one-day
    // gap (one fully-skipped day).
    setToday("2026-05-04");
    const status = checkIntegrityStatus();

    expect(status.status).toBe("WARNING");
    expect(status.missedDays).toBe(1);
    // Progress is untouched until the user actually engages.
    expect(getProgressDay()).toBe(2);
  });

  test("after 2 days off the gap-check returns BREACH", () => {
    buildBaselineThroughDay2();
    // Skip 03 + 04, open on 05.
    setToday("2026-05-05");
    const status = checkIntegrityStatus();

    expect(status.status).toBe("BREACH");
    expect(status.missedDays).toBe(2);
    expect(getProgressDay()).toBe(2);
  });

  test("after 5 days off the gap-check returns RESET and progress stays at Day 2", () => {
    buildBaselineThroughDay2();
    // Skip 03..07, open on 08. Five fully-missed days.
    setToday("2026-05-08");
    const status = checkIntegrityStatus();

    expect(status.status).toBe("RESET");
    expect(status.missedDays).toBe(5);
    // The user is still on Day 2 in the narrative — that's the
    // engagement-based contract. The streak is what takes the hit.
    expect(getProgressDay()).toBe(2);
  });

  test("returning and engaging after a 5-day gap advances Day 2 → Day 3 (and zeroes streak)", () => {
    buildBaselineThroughDay2();
    setToday("2026-05-08");

    // First engagement after the gap.
    const state = recordCompletion();

    // Progress moves forward by exactly one — even though five calendar
    // days were skipped, the user's narrative position moves from Day 2
    // to Day 3.
    expect(getProgressDay()).toBe(3);
    // Streak resets to 1 because the gap was 5 days (RESET branch).
    expect(state.streak).toBe(1);
    // We're now in RECOVERING status with the pre-break streak captured
    // for the comeback restoration.
    expect(state.status).toBe("RECOVERING");
    expect(state.preBreakStreak).toBe(2);
  });
});

// ─── Recovery mechanic ──────────────────────────────────────────────────────

describe("recovery after a break", () => {
  test("3 consecutive days post-RESET restore 75% of the pre-break streak", () => {
    // Manufacture an 8-day streak, then a 5-day gap, then come back.
    setProgressDay(1);
    for (let i = 0; i < 8; i++) {
      setToday(`2026-05-0${i + 1}`);
      recordCompletion();
    }
    expect(loadIntegrity().streak).toBe(8);

    // 5-day gap.
    setToday("2026-05-14");
    const post = recordCompletion();
    expect(post.status).toBe("RECOVERING");
    expect(post.streak).toBe(1);
    expect(post.preBreakStreak).toBe(8);

    // Two more consecutive days; the third recovery day completes the
    // restoration to floor(8 * 0.75) = 6.
    setToday("2026-05-15");
    recordCompletion();
    setToday("2026-05-16");
    const final = recordCompletion();

    expect(final.status).toBe("ACTIVE");
    // floor(8 * 0.75) = 6.
    expect(final.streak).toBe(6);
    // Progress advanced to 11 (8 baseline + 3 recovery days).
    expect(getProgressDay()).toBe(11);
  });
});

// ─── Reset Progress ─────────────────────────────────────────────────────────

describe("resetProgress", () => {
  test("rewinds progress / streak / cinematic flags but keeps unrelated keys", () => {
    // Seed engagement state.
    setProgressDay(1);
    setToday("2026-05-01");
    recordCompletion();
    setToday("2026-05-02");
    recordCompletion();

    // Seed a bunch of story / playback flags.
    const { setJSON } = jest.requireMock("../../db/storage") as {
      setJSON: (k: string, v: unknown) => void;
    };
    setJSON("cinematic_day_2", true);
    setJSON("cinematic_day_7", true);
    setJSON("briefing_seen_2026-05-02", true);
    setJSON("integrity_cinematic_2026-05-02", true);
    setJSON("comeback_shown_2026-05-02", true);
    setJSON("first_active_date", "2026-05-01");
    setJSON("max_day_reached", 7);
    setJSON("protocol_streak", 2);
    // Seed something that should SURVIVE the reset (user data, prefs).
    setJSON("haptics_enabled", true);
    setJSON("dev_day_offset", 0);

    resetProgress();

    expect(getProgressDay()).toBe(1);
    expect(loadIntegrity().streak).toBe(0);
    expect(loadIntegrity().lastCompletionDate).toBeNull();

    // Story flags are gone.
    const { getJSON } = jest.requireMock("../../db/storage") as {
      getJSON: <T,>(k: string, fallback: T) => T;
    };
    expect(getJSON("cinematic_day_2", null)).toBeNull();
    expect(getJSON("cinematic_day_7", null)).toBeNull();
    expect(getJSON("briefing_seen_2026-05-02", null)).toBeNull();
    expect(getJSON("integrity_cinematic_2026-05-02", null)).toBeNull();
    expect(getJSON("comeback_shown_2026-05-02", null)).toBeNull();
    expect(getJSON("first_active_date", null)).toBeNull();
    expect(getJSON("max_day_reached", null)).toBeNull();
    expect(getJSON("protocol_streak", null)).toBeNull();

    // Unrelated prefs are NOT touched.
    expect(getJSON("haptics_enabled", null)).toBe(true);
    expect(getJSON("dev_day_offset", null)).toBe(0);
  });
});
