/**
 * Phase 1.3: Tests for the protocol integrity FSM. The previous code
 * incremented the streak on a 1-day miss in BOTH the grace and post-grace
 * branches, which contradicted the module header ("paused, not advanced")
 * and silently rewarded users for missing days. This file pins the
 * corrected behavior.
 *
 * The integrity module touches MMKV via getJSON/setJSON, so we mock the
 * storage layer with an in-mockMemory map. Date helpers (getTodayKey, addDays)
 * stay real because they're pure.
 */

// In-mockMemory MMKV stand-in. Each test resets it via beforeEach.
const mockMemory = new Map<string, string>();

jest.mock("../db/storage", () => ({
  storage: {
    getString: (key: string) => mockMemory.get(key),
    set: (key: string, value: string) => {
      mockMemory.set(key, value);
    },
    getAllKeys: () => Array.from(mockMemory.keys()),
    getNumber: (_key: string) => undefined,
    remove: (key: string) => mockMemory.delete(key),
  },
  getJSON: <T>(key: string, fallback: T): T => {
    const raw = mockMemory.get(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  setJSON: (key: string, value: unknown) => {
    if (value === undefined) return;
    mockMemory.set(key, JSON.stringify(value));
  },
}));

import {
  recordCompletion,
  loadIntegrity,
  getIntegrityLevel,
  type IntegrityState,
} from "../lib/protocol-integrity";
import { addDays, getTodayKey } from "../lib/date";

const INTEGRITY_KEY = "protocol_integrity";

function seed(state: Partial<IntegrityState>): void {
  const full: IntegrityState = {
    streak: 0,
    level: "INITIALIZING",
    status: "ACTIVE",
    lastCompletionDate: null,
    preBreakStreak: 0,
    recoveryDays: 0,
    missedDays: 0,
    ...state,
  };
  mockMemory.set(INTEGRITY_KEY, JSON.stringify(full));
}

beforeEach(() => {
  mockMemory.clear();
});

describe("getIntegrityLevel", () => {
  it("returns INITIALIZING for streaks 0-6", () => {
    expect(getIntegrityLevel(0)).toBe("INITIALIZING");
    expect(getIntegrityLevel(6)).toBe("INITIALIZING");
  });
  it("returns STABLE for streaks 7-13", () => {
    expect(getIntegrityLevel(7)).toBe("STABLE");
    expect(getIntegrityLevel(13)).toBe("STABLE");
  });
  it("returns FORTIFIED for streaks 14-29", () => {
    expect(getIntegrityLevel(14)).toBe("FORTIFIED");
    expect(getIntegrityLevel(29)).toBe("FORTIFIED");
  });
  it("returns HARDENED for streaks 30-59", () => {
    expect(getIntegrityLevel(30)).toBe("HARDENED");
    expect(getIntegrityLevel(59)).toBe("HARDENED");
  });
  it("returns UNBREAKABLE for streaks 60+", () => {
    expect(getIntegrityLevel(60)).toBe("UNBREAKABLE");
    expect(getIntegrityLevel(365)).toBe("UNBREAKABLE");
  });
});

describe("recordCompletion — first ever completion", () => {
  it("starts the streak at 1", () => {
    const result = recordCompletion();
    expect(result.streak).toBe(1);
    expect(result.status).toBe("ACTIVE");
    expect(result.lastCompletionDate).toBe(getTodayKey());
  });
});

describe("recordCompletion — already completed today", () => {
  it("is a no-op", () => {
    seed({ streak: 5, lastCompletionDate: getTodayKey(), status: "ACTIVE" });
    const result = recordCompletion();
    expect(result.streak).toBe(5);
  });
});

describe("recordCompletion — consecutive day", () => {
  it("increments the streak by 1 in the grace period", () => {
    seed({ streak: 3, lastCompletionDate: addDays(getTodayKey(), -1) });
    const result = recordCompletion();
    expect(result.streak).toBe(4);
    expect(result.status).toBe("ACTIVE");
  });

  it("increments the streak by 1 above the grace period", () => {
    seed({ streak: 25, lastCompletionDate: addDays(getTodayKey(), -1) });
    const result = recordCompletion();
    expect(result.streak).toBe(26);
    expect(result.status).toBe("ACTIVE");
  });
});

describe("recordCompletion — 1-day miss (Phase 1.3 fix)", () => {
  it("does NOT advance the streak in the grace period", () => {
    // streak=4 (in grace, <=6), miss exactly 1 day, then complete today
    seed({
      streak: 4,
      lastCompletionDate: addDays(getTodayKey(), -2),
    });
    const result = recordCompletion();
    // Old (buggy) behavior: result.streak === 5
    // Correct behavior: streak is paused, stays at 4
    expect(result.streak).toBe(4);
  });

  it("does NOT advance the streak above the grace period", () => {
    // streak=20 (above grace), miss exactly 1 day
    seed({
      streak: 20,
      lastCompletionDate: addDays(getTodayKey(), -2),
    });
    const result = recordCompletion();
    expect(result.streak).toBe(20);
    expect(result.status).toBe("RECOVERING");
    expect(result.preBreakStreak).toBe(20);
    expect(result.recoveryDays).toBe(1);
  });
});

describe("recordCompletion — 2-day miss (BREACH)", () => {
  it("halves the streak (rounded down) and enters RECOVERING", () => {
    seed({
      streak: 20,
      lastCompletionDate: addDays(getTodayKey(), -3),
    });
    const result = recordCompletion();
    expect(result.streak).toBe(10);
    expect(result.status).toBe("RECOVERING");
    expect(result.preBreakStreak).toBe(20);
    expect(result.recoveryDays).toBe(1);
  });

  it("never reduces below 1 even with a tiny prior streak", () => {
    seed({
      streak: 1,
      lastCompletionDate: addDays(getTodayKey(), -3),
    });
    const result = recordCompletion();
    expect(result.streak).toBe(1);
    expect(result.status).toBe("RECOVERING");
  });
});

describe("recordCompletion — 3+ day miss (RESET)", () => {
  it("resets the streak to 1 and enters RECOVERING", () => {
    seed({
      streak: 50,
      lastCompletionDate: addDays(getTodayKey(), -10),
    });
    const result = recordCompletion();
    expect(result.streak).toBe(1);
    expect(result.status).toBe("RECOVERING");
    expect(result.preBreakStreak).toBe(50);
    expect(result.recoveryDays).toBe(1);
  });
});

describe("recordCompletion — recovery mechanic", () => {
  it("restores 75% of pre-break streak after 3 consecutive days", () => {
    // Simulated: after a breach, recoveryDays=2, preBreakStreak=20.
    // Today is day 3 of recovery → restore to floor(20*0.75) = 15.
    seed({
      streak: 11,
      lastCompletionDate: addDays(getTodayKey(), -1),
      status: "RECOVERING",
      preBreakStreak: 20,
      recoveryDays: 2,
    });
    const result = recordCompletion();
    // newStreak goes from 11 → 12 (consecutive day), then recovery
    // restores to max(12, floor(20*0.75)) = max(12, 15) = 15
    expect(result.streak).toBe(15);
    expect(result.status).toBe("ACTIVE");
    expect(result.preBreakStreak).toBe(0);
    expect(result.recoveryDays).toBe(0);
  });

  it("does not restore if the recovery streak already exceeds 75%", () => {
    seed({
      streak: 18,
      lastCompletionDate: addDays(getTodayKey(), -1),
      status: "RECOVERING",
      preBreakStreak: 20,
      recoveryDays: 2,
    });
    const result = recordCompletion();
    // newStreak = 19, recovery target = floor(20*0.75) = 15.
    // max(19, 15) = 19 — no restoration needed.
    expect(result.streak).toBe(19);
    expect(result.status).toBe("ACTIVE");
  });
});

describe("loadIntegrity — defaults", () => {
  it("returns the default state when nothing is persisted", () => {
    const state = loadIntegrity();
    expect(state.streak).toBe(0);
    expect(state.level).toBe("INITIALIZING");
    expect(state.status).toBe("ACTIVE");
    expect(state.lastCompletionDate).toBeNull();
  });
});
