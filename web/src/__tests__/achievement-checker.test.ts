import { describe, it, expect } from "vitest";

import {
  ALL_ACHIEVEMENTS,
  checkAllAchievements,
  isSupportedOnWeb,
  type WebAppState,
} from "../lib/achievement-checker";

const ZERO: WebAppState = {
  totalCompletionsCount: 0,
  streakCurrent: 0,
  dayNumber: 1,
  journalEntryCount: 0,
};

function idsFrom(state: WebAppState, already = new Set<string>()): string[] {
  return checkAllAchievements(state, already)
    .map((p) => p.id)
    .sort();
}

describe("achievement-checker (web)", () => {
  it("loads the full 35-achievement catalogue", () => {
    expect(ALL_ACHIEVEMENTS.length).toBe(35);
  });

  it("unlocks nothing on a brand-new, empty account", () => {
    expect(idsFrom(ZERO)).toEqual([]);
  });

  it("unlocks First Blood at the first completion (tasks_completed_total=1)", () => {
    expect(idsFrom({ ...ZERO, totalCompletionsCount: 1 })).toContain(
      "ach_first_blood",
    );
    expect(idsFrom(ZERO)).not.toContain("ach_first_blood");
  });

  it("unlocks streak milestones as the streak climbs", () => {
    // Weekend Warrior is streak_days=8, Consistency King is 14.
    const at8 = idsFrom({ ...ZERO, streakCurrent: 8 });
    expect(at8).toContain("ach_weekend_warrior");
    expect(at8).not.toContain("ach_consistency_king");

    const at14 = idsFrom({ ...ZERO, streakCurrent: 14 });
    expect(at14).toContain("ach_weekend_warrior");
    expect(at14).toContain("ach_consistency_king");
  });

  it("unlocks day-count + journal achievements from their own data", () => {
    expect(idsFrom({ ...ZERO, dayNumber: 90 })).toContain("ach_quarter_century");
    expect(idsFrom({ ...ZERO, journalEntryCount: 7 })).toContain(
      "ach_journal_keeper",
    );
  });

  it("never unlocks mobile-only achievements, even with maxed-out state", () => {
    const maxed: WebAppState = {
      totalCompletionsCount: 100_000,
      streakCurrent: 100_000,
      dayNumber: 100_000,
      journalEntryCount: 100_000,
    };
    const unlocked = new Set(idsFrom(maxed));
    for (const def of ALL_ACHIEVEMENTS) {
      if (!isSupportedOnWeb(def.conditionType)) {
        expect(unlocked.has(def.id)).toBe(false);
      }
    }
  });

  it("does not re-report achievements already unlocked", () => {
    const already = new Set(["ach_first_blood"]);
    expect(idsFrom({ ...ZERO, totalCompletionsCount: 5 }, already)).not.toContain(
      "ach_first_blood",
    );
  });
});
