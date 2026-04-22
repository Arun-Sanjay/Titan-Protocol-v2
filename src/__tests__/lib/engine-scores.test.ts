/**
 * Tests for the weak/strong engine selectors.
 *
 * These exist because the old "pick lowest score" logic had three
 * silently-wrong cases:
 *   1. An unstaffed engine (0 tasks) would score 0 and be called "weak",
 *      even though the user just hadn't set that engine up.
 *   2. A tie among all four engines still produced a "weakest" due to
 *      stable-sort tie-breaking.
 *   3. A tiny gap (e.g. 95 vs 90) was treated as a weakness.
 *
 * Every test below is written so that its failure points at one of the
 * above regressions, not at a generic API shape issue.
 */

import {
  WEAK_ENGINE_SCORE_CEILING,
  WEAK_ENGINE_MIN_GAP,
  buildEngineSnapshot,
  selectStrongEngine,
  selectWeakEngine,
  type EngineKey,
  type EngineSnapshotMap,
} from "../../lib/engine-scores";

function snap(
  entries: Partial<Record<EngineKey, { score: number; taskCount: number }>>,
): EngineSnapshotMap {
  const zero = { score: 0, taskCount: 0 };
  return {
    body: { ...zero, ...(entries.body ?? {}) },
    mind: { ...zero, ...(entries.mind ?? {}) },
    money: { ...zero, ...(entries.money ?? {}) },
    charisma: { ...zero, ...(entries.charisma ?? {}) },
  };
}

describe("selectWeakEngine", () => {
  test("returns null when no engine has any tasks (brand-new user)", () => {
    expect(selectWeakEngine(snap({}))).toBeNull();
  });

  test("returns null when only one engine is staffed", () => {
    expect(
      selectWeakEngine(snap({ body: { score: 20, taskCount: 3 } })),
    ).toBeNull();
  });

  test("unstaffed engines (taskCount=0) are not candidates for 'weak' — bug 3 root cause", () => {
    // Body: 100% with tasks. Charisma: 0% with no tasks. Naive logic picks
    // charisma. Correct logic returns null — there's only one staffed
    // engine to compare, and the unstaffed one isn't "weak", it's empty.
    const result = selectWeakEngine(
      snap({ body: { score: 100, taskCount: 5 } }),
    );
    expect(result).toBeNull();
  });

  test("all staffed engines tied at 100% → no weak engine", () => {
    // This is the exact case the user reported: "even though I hit 100%
    // task, it does say there is a weak engine". We must return null.
    const result = selectWeakEngine(
      snap({
        body: { score: 100, taskCount: 2 },
        mind: { score: 100, taskCount: 10 },
        money: { score: 100, taskCount: 5 },
        charisma: { score: 100, taskCount: 1 },
      }),
    );
    expect(result).toBeNull();
  });

  test("all staffed engines tied at 60% → no weak engine (ties never pick a loser)", () => {
    const result = selectWeakEngine(
      snap({
        body: { score: 60, taskCount: 1 },
        mind: { score: 60, taskCount: 1 },
        money: { score: 60, taskCount: 1 },
        charisma: { score: 60, taskCount: 1 },
      }),
    );
    expect(result).toBeNull();
  });

  test("gap below threshold → no weak engine", () => {
    // Weakest 79, strongest 95. Gap = 16 < 20. Not meaningful enough.
    expect(WEAK_ENGINE_MIN_GAP).toBe(20);
    const result = selectWeakEngine(
      snap({
        body: { score: 79, taskCount: 1 },
        mind: { score: 95, taskCount: 1 },
        money: { score: 95, taskCount: 1 },
        charisma: { score: 95, taskCount: 1 },
      }),
    );
    expect(result).toBeNull();
  });

  test("weakest at or above ceiling → no weak engine (user is crushing it)", () => {
    // Weakest 80 = ceiling. Strongest 100. Gap 20 meets the gap rule.
    // But ceiling rule forbids calling anyone weak when 80+.
    expect(WEAK_ENGINE_SCORE_CEILING).toBe(80);
    const result = selectWeakEngine(
      snap({
        body: { score: 80, taskCount: 1 },
        mind: { score: 100, taskCount: 1 },
        money: { score: 100, taskCount: 1 },
        charisma: { score: 100, taskCount: 1 },
      }),
    );
    expect(result).toBeNull();
  });

  test("legitimate weakness: clear gap + below ceiling → return the weakest", () => {
    // Body at 20, others at 80. Gap 60, weakest below ceiling.
    const result = selectWeakEngine(
      snap({
        body: { score: 20, taskCount: 3 },
        mind: { score: 80, taskCount: 3 },
        money: { score: 80, taskCount: 3 },
        charisma: { score: 80, taskCount: 3 },
      }),
    );
    expect(result).toBe<EngineKey>("body");
  });

  test("picks weakest among multiple below-ceiling engines", () => {
    const result = selectWeakEngine(
      snap({
        body: { score: 50, taskCount: 3 },
        mind: { score: 30, taskCount: 3 },
        money: { score: 70, taskCount: 3 },
        charisma: { score: 10, taskCount: 3 },
      }),
    );
    expect(result).toBe<EngineKey>("charisma");
  });

  test("unstaffed engines are ignored even when their score is lower than any staffed one", () => {
    // Body has no tasks (score 0). Mind has tasks and scores 50.
    // Staffed = [mind, money]. Among staffed, there's a weak engine? Gap
    // is 30 (mind 50 vs money 80), weakest is mind (50) — below ceiling,
    // clear gap, two staffed → YES, mind is weak.
    const result = selectWeakEngine(
      snap({
        body: { score: 0, taskCount: 0 }, // unstaffed — ignored
        mind: { score: 50, taskCount: 4 },
        money: { score: 80, taskCount: 2 },
      }),
    );
    expect(result).toBe<EngineKey>("mind");
  });

  test("two staffed, tied → no weak engine", () => {
    const result = selectWeakEngine(
      snap({
        body: { score: 70, taskCount: 2 },
        mind: { score: 70, taskCount: 2 },
      }),
    );
    expect(result).toBeNull();
  });

  test("deterministic tie-breaking when two engines share the lowest score", () => {
    // body and mind both at 20. body comes first in ENGINES so it wins.
    const result = selectWeakEngine(
      snap({
        body: { score: 20, taskCount: 1 },
        mind: { score: 20, taskCount: 1 },
        money: { score: 100, taskCount: 1 },
        charisma: { score: 100, taskCount: 1 },
      }),
    );
    expect(result).toBe<EngineKey>("body");
  });
});

describe("selectStrongEngine", () => {
  test("returns null when fewer than 2 staffed", () => {
    expect(selectStrongEngine(snap({}))).toBeNull();
    expect(
      selectStrongEngine(snap({ body: { score: 100, taskCount: 5 } })),
    ).toBeNull();
  });

  test("returns null when all tied", () => {
    const result = selectStrongEngine(
      snap({
        body: { score: 70, taskCount: 2 },
        mind: { score: 70, taskCount: 2 },
        money: { score: 70, taskCount: 2 },
      }),
    );
    expect(result).toBeNull();
  });

  test("returns the highest-scoring staffed engine", () => {
    const result = selectStrongEngine(
      snap({
        body: { score: 30, taskCount: 1 },
        mind: { score: 95, taskCount: 1 },
        money: { score: 60, taskCount: 1 },
      }),
    );
    expect(result).toBe<EngineKey>("mind");
  });

  test("unstaffed engines can't be 'strong' either — fairness, both sides", () => {
    // If charisma has 0 tasks and somehow score 100, it shouldn't be
    // called the strong engine. (Shouldn't happen in practice —
    // computeEngineScore returns 0 for empty — but the selector should
    // still be defensive.)
    const result = selectStrongEngine(
      snap({
        body: { score: 30, taskCount: 2 },
        mind: { score: 50, taskCount: 2 },
        charisma: { score: 100, taskCount: 0 },
      }),
    );
    expect(result).toBe<EngineKey>("mind");
  });
});

describe("buildEngineSnapshot", () => {
  test("clamps scores into [0, 100]", () => {
    const s = buildEngineSnapshot({
      scores: { body: 150, mind: -20, money: 50, charisma: 80.6 },
      taskCounts: { body: 1, mind: 1, money: 1, charisma: 1 },
    });
    expect(s.body.score).toBe(100);
    expect(s.mind.score).toBe(0);
    expect(s.money.score).toBe(50);
    expect(s.charisma.score).toBe(81); // rounded
  });

  test("clamps negative task counts to 0", () => {
    const s = buildEngineSnapshot({
      scores: { body: 0, mind: 0, money: 0, charisma: 0 },
      taskCounts: { body: -5, mind: 0, money: 3, charisma: 0 },
    });
    expect(s.body.taskCount).toBe(0);
    expect(s.money.taskCount).toBe(3);
  });

  test("defaults missing engines to zero", () => {
    const s = buildEngineSnapshot({
      scores: { body: 40 } as Record<EngineKey, number>,
      taskCounts: { body: 2 } as Record<EngineKey, number>,
    });
    expect(s.mind).toEqual({ score: 0, taskCount: 0 });
    expect(s.money).toEqual({ score: 0, taskCount: 0 });
    expect(s.charisma).toEqual({ score: 0, taskCount: 0 });
  });
});

describe("regression: the exact scenario the user reported", () => {
  test("100% task completion across engines with different task counts → null weak, null strong", () => {
    // User had: Body 2/2, Mind 10/10, Money 5/5, Charisma 1/1. All 100%.
    // The BROKEN behavior was "there is a weak engine, which is [one of
    // these], just because I had a lesser number of tasks". The correct
    // behavior is: no weak engine, no strong engine — it's flat-line good.
    const s = snap({
      body: { score: 100, taskCount: 2 },
      mind: { score: 100, taskCount: 10 },
      money: { score: 100, taskCount: 5 },
      charisma: { score: 100, taskCount: 1 },
    });
    expect(selectWeakEngine(s)).toBeNull();
    expect(selectStrongEngine(s)).toBeNull();
  });
});
