/**
 * Pure XP / rank math. Mirrors web's `web/src/lib/__tests__/xp-math.test.ts`
 * (jest globals here, vitest there) — same assertions so the rules can't drift
 * between platforms.
 */
import {
  baseXpForKind,
  streakMultiplier,
  xpForTask,
  levelForXp,
  foldStreak,
} from "../xp-math";
import { rankForLevel, nextRank, levelProgressPct } from "../ranks";

describe("streakMultiplier", () => {
  it("is 1x at 0, 2x at 5, 3x at 10, capped at 3x beyond", () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(5)).toBe(2);
    expect(streakMultiplier(10)).toBe(3);
    expect(streakMultiplier(15)).toBe(3);
    expect(streakMultiplier(-3)).toBe(1);
  });
});

describe("baseXpForKind / xpForTask", () => {
  it("main is 20, secondary 10 at base", () => {
    expect(baseXpForKind("main")).toBe(20);
    expect(baseXpForKind("secondary")).toBe(10);
  });
  it("scales by the streak multiplier", () => {
    expect(xpForTask("main", 0)).toBe(20);
    expect(xpForTask("main", 5)).toBe(40); // 20 * 2
    expect(xpForTask("main", 10)).toBe(60); // 20 * 3
    expect(xpForTask("secondary", 0)).toBe(10);
    expect(xpForTask("secondary", 10)).toBe(30); // 10 * 3
  });
});

describe("levelForXp", () => {
  it("uses 500 XP/level with correct boundaries", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(499)).toBe(1);
    expect(levelForXp(500)).toBe(2);
    expect(levelForXp(999)).toBe(2);
    expect(levelForXp(1000)).toBe(3);
  });
});

describe("foldStreak", () => {
  it("increments on a >=60% day, resets below 60%", () => {
    expect(foldStreak(4, 60)).toBe(5);
    expect(foldStreak(4, 100)).toBe(5);
    expect(foldStreak(4, 59)).toBe(0);
    expect(foldStreak(4, 0)).toBe(0);
    expect(foldStreak(0, 75)).toBe(1);
  });
});

describe("ranks (8-tier)", () => {
  it("maps level to the ladder", () => {
    expect(rankForLevel(1).name).toBe("Initiate");
    expect(rankForLevel(3).name).toBe("Initiate");
    expect(rankForLevel(4).name).toBe("Operative");
    expect(rankForLevel(43).name).toBe("Titan");
    expect(rankForLevel(99).name).toBe("Titan");
  });
  it("nextRank returns the upcoming tier, null at max", () => {
    expect(nextRank(1)?.name).toBe("Operative");
    expect(nextRank(43)).toBeNull();
  });
  it("levelProgressPct is 0-100 within a level", () => {
    expect(levelProgressPct(0)).toBe(0);
    expect(levelProgressPct(250)).toBe(50);
    expect(levelProgressPct(500)).toBe(0);
    expect(levelProgressPct(750)).toBe(50);
  });
});
