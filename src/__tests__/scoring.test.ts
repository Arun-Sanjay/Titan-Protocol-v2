/**
 * Phase 2.4F: Tests for the weighted Titan score and rank grade logic.
 *
 * Scoring is the most safety-critical pure-function module in the app —
 * a regression here would silently miscalculate every user's daily
 * score. This file pins the behavior so the Phase 3 Supabase refactor
 * (which will recompute scores against rows pulled from the server)
 * can't drift the math.
 */
import {
  calculateWeightedTitanScore,
  calculateRank,
} from "../lib/scoring-v2";

describe("calculateWeightedTitanScore", () => {
  describe("with no identity (equal weights)", () => {
    it("returns 0 when all engines are 0", () => {
      const score = calculateWeightedTitanScore(
        { body: 0, mind: 0, money: 0, charisma: 0 },
        null,
      );
      expect(score).toBe(0);
    });

    it("returns 100 when all engines are 100", () => {
      const score = calculateWeightedTitanScore(
        { body: 100, mind: 100, money: 100, charisma: 100 },
        null,
      );
      expect(score).toBe(100);
    });

    it("returns the average when scores are mixed and weights are equal", () => {
      // Equal 25% weights, scores 80/60/40/20 → avg 50
      const score = calculateWeightedTitanScore(
        { body: 80, mind: 60, money: 40, charisma: 20 },
        null,
      );
      expect(score).toBe(50);
    });

    it("treats missing engine scores as 0", () => {
      const score = calculateWeightedTitanScore(
        { body: 100, mind: 100 }, // money and charisma absent
        null,
      );
      // 25 + 25 + 0 + 0 = 50
      expect(score).toBe(50);
    });
  });

  describe("with identity-weighted archetypes", () => {
    it("athlete heavily weights body (40%)", () => {
      // Body 100, others 0 → 40 (40% of 100)
      const athlete = calculateWeightedTitanScore(
        { body: 100, mind: 0, money: 0, charisma: 0 },
        "athlete",
      );
      expect(athlete).toBe(40);
    });

    it("scholar heavily weights mind (45%)", () => {
      const scholar = calculateWeightedTitanScore(
        { body: 0, mind: 100, money: 0, charisma: 0 },
        "scholar",
      );
      expect(scholar).toBe(45);
    });

    it("hustler heavily weights money (40%)", () => {
      const hustler = calculateWeightedTitanScore(
        { body: 0, mind: 0, money: 100, charisma: 0 },
        "hustler",
      );
      expect(hustler).toBe(40);
    });

    it("showman heavily weights charisma (45%)", () => {
      const showman = calculateWeightedTitanScore(
        { body: 0, mind: 0, money: 0, charisma: 100 },
        "showman",
      );
      expect(showman).toBe(45);
    });

    it("titan archetype uses equal weights", () => {
      const titan = calculateWeightedTitanScore(
        { body: 100, mind: 0, money: 0, charisma: 0 },
        "titan",
      );
      expect(titan).toBe(25);
    });
  });

  describe("with isTitanMode override", () => {
    it("isTitanMode overrides identity to equal weights", () => {
      // Athlete would weight body 40%, but Titan Mode forces 25%.
      const score = calculateWeightedTitanScore(
        { body: 100, mind: 0, money: 0, charisma: 0 },
        "athlete",
        true, // isTitanMode
      );
      expect(score).toBe(25);
    });
  });

  describe("with active engines (Focus mode)", () => {
    it("renormalizes weights to sum to 1 over active engines", () => {
      // Focus mode: only body and mind active. Athlete weights body 40%, mind 20%.
      // Renormalized: body = 40/60 ≈ 0.667, mind = 20/60 ≈ 0.333.
      // Body 100, mind 100 → 100.
      const score = calculateWeightedTitanScore(
        { body: 100, mind: 100, money: 0, charisma: 0 },
        "athlete",
        false,
        ["body", "mind"],
      );
      expect(score).toBe(100);
    });

    it("returns 0 if active engines list is empty", () => {
      const score = calculateWeightedTitanScore(
        { body: 100, mind: 100, money: 100, charisma: 100 },
        "athlete",
        false,
        [],
      );
      expect(score).toBe(0);
    });

    it("body alone in focus mode returns the body score", () => {
      const score = calculateWeightedTitanScore(
        { body: 75, mind: 0, money: 0, charisma: 0 },
        "athlete",
        false,
        ["body"],
      );
      expect(score).toBe(75);
    });
  });
});

describe("calculateRank", () => {
  it.each([
    [0, "D"],
    [29, "D"],
    [30, "C"],
    [49, "C"],
    [50, "B"],
    [69, "B"],
    [70, "A"],
    [84, "A"],
    [85, "S"],
    [94, "S"],
    [95, "SS"],
    [100, "SS"],
  ])("score %i returns rank %s", (score, expected) => {
    expect(calculateRank(score)).toBe(expected);
  });
});
