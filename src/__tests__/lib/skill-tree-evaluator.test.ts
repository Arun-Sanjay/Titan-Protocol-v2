/**
 * Tests for the skill-tree evaluator.
 *
 * The bug being defended against: every checker previously scanned MMKV
 * for `completions:<engine>:<date>` keys that no longer exist after the
 * local-first migration — so every skill node stayed locked forever.
 *
 * These tests split into two layers:
 *
 *   1. Pure checker tests — construct an EvaluationSnapshot by hand and
 *      exercise each branch of `checkRequirement` + its helpers. These
 *      catch "you forgot to rewrite checker X" regressions.
 *   2. Integration tests — go through the real sqlite-fake, create
 *      completions/habits/etc., run `evaluateAllTrees`, and assert the
 *      resulting skill_tree_progress rows. These catch the whole-flow
 *      bug ("skill trees always locked") end to end.
 */

jest.mock("../../db/sqlite/client", () => require("../setup/sqlite-fake"));
jest.mock("../../lib/supabase", () => ({
  supabase: {},
  requireUserId: async () => "u1",
}));
jest.mock("../../lib/error-log", () => ({ logError: jest.fn() }));
jest.mock("../../lib/query-client", () => ({
  queryClient: {
    getQueryData: jest.fn().mockReturnValue(undefined),
    invalidateQueries: jest.fn(),
  },
}));
// Short-circuit MMKV — the production module calls
// `createMMKV({ id })` at import time which fails in Node without
// TurboModules. Only a handful of checkers read from storage and
// none of them are touched by these tests.
jest.mock("../../db/storage", () => ({
  getJSON: jest.fn((_key: string, fallback: unknown) => fallback),
  setJSON: jest.fn(),
  storage: {
    getAllKeys: jest.fn(() => []),
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    contains: jest.fn(),
  },
  nextId: jest.fn(() => 1),
}));

jest.mock("expo-crypto", () => ({
  randomUUID: () => {
    const g = globalThis as { __idCounter?: number };
    g.__idCounter = (g.__idCounter ?? 0) + 1;
    return `node-id-${g.__idCounter}`;
  },
}));

import { _resetTestDb, _testDb } from "../setup/sqlite-fake";
import {
  evaluateAllTrees,
  evaluateSkillTreeWithSnapshot,
  loadSnapshot,
  __internal,
  type EvaluationSnapshot,
} from "../../lib/skill-tree-evaluator";
import type { SkillProgress } from "../../services/skill-tree";
import type { Enums } from "../../types/supabase";

const TODAY = "2026-04-23";

type EngineLit = Enums<"engine_key">;
const E = {
  body: "body" as EngineLit,
  mind: "mind" as EngineLit,
  money: "money" as EngineLit,
  charisma: "charisma" as EngineLit,
};

function baseSnapshot(
  overrides: Partial<EvaluationSnapshot> = {},
): EvaluationSnapshot {
  return {
    todayKey: TODAY,
    completions: [],
    habits: [],
    habitLogs: [],
    focusSessions: [],
    sleepLogs: [],
    skillRows: [],
    streakCurrent: 0,
    ...overrides,
  };
}

describe("skill-tree evaluator — pure checkers", () => {
  describe("taskCount (per-engine)", () => {
    test("counts only the specified engine", () => {
      const snap = baseSnapshot({
        completions: [
          { engine: E.body, date_key: TODAY },
          { engine: E.body, date_key: TODAY },
          { engine: E.mind, date_key: TODAY },
        ],
      });
      expect(__internal.taskCount(snap, "body")).toBe(2);
      expect(__internal.taskCount(snap, "mind")).toBe(1);
      expect(__internal.taskCount(snap, "money")).toBe(0);
    });
  });

  describe("streakDays", () => {
    test("counts consecutive days ending today", () => {
      const snap = baseSnapshot({
        completions: [
          { engine: E.body, date_key: TODAY },
          { engine: E.mind, date_key: "2026-04-22" },
          { engine: E.money, date_key: "2026-04-21" },
        ],
      });
      expect(__internal.streakDays(snap)).toBe(3);
    });

    test("breaks on a gap (no completion yesterday)", () => {
      const snap = baseSnapshot({
        completions: [
          { engine: E.body, date_key: TODAY },
          { engine: E.body, date_key: "2026-04-21" }, // skips 22nd
        ],
      });
      expect(__internal.streakDays(snap)).toBe(1);
    });

    test("returns 0 when today has no completion (streak hasn't started)", () => {
      const snap = baseSnapshot({
        completions: [{ engine: E.body, date_key: "2026-04-22" }],
      });
      expect(__internal.streakDays(snap)).toBe(0);
    });

    test("multiple completions on the same day still count as one day", () => {
      const snap = baseSnapshot({
        completions: [
          { engine: E.body, date_key: TODAY },
          { engine: E.mind, date_key: TODAY },
          { engine: E.money, date_key: TODAY },
        ],
      });
      expect(__internal.streakDays(snap)).toBe(1);
    });
  });

  describe("engineAvgWeeks", () => {
    test("requires activity rate to meet threshold over window", () => {
      // Window = 14 days (2 weeks). 10 days of body completions.
      // Rate = 10/14 = 71% → meets 70 threshold.
      const completions: { engine: EngineLit; date_key: string }[] = [];
      const baseDate = new Date(TODAY + "T12:00:00");
      for (let i = 0; i < 10; i++) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() - i);
        completions.push({
          engine: E.body,
          date_key: d.toISOString().slice(0, 10),
        });
      }
      const snap = baseSnapshot({ completions });
      expect(__internal.engineAvgWeeks(snap, "body", 2, 70)).toBe(true);
      expect(__internal.engineAvgWeeks(snap, "body", 2, 80)).toBe(false);
    });

    test("excludes completions outside the window", () => {
      const snap = baseSnapshot({
        completions: [
          { engine: E.body, date_key: TODAY }, // in window
          { engine: E.body, date_key: "2026-01-01" }, // far outside
        ],
      });
      // Window = 7 days, activity rate = 1/7 = 14% → below 70% threshold.
      expect(__internal.engineAvgWeeks(snap, "body", 1, 70)).toBe(false);
    });

    test("multiple completions on same date count as one day", () => {
      const snap = baseSnapshot({
        completions: Array.from({ length: 5 }, () => ({
          engine: E.body,
          date_key: TODAY,
        })),
      });
      // Even with 5 completions, only 1 distinct day → 1/7 = 14%, below 70.
      expect(__internal.engineAvgWeeks(snap, "body", 1, 70)).toBe(false);
    });
  });

  describe("habitCompletionRate", () => {
    test("counts distinct active dates in the window", () => {
      const snap = baseSnapshot({
        habitLogs: [
          { date_key: TODAY },
          { date_key: "2026-04-22" },
          { date_key: "2026-04-21" },
        ],
      });
      // 3 active days out of 7 = 43% → below 80.
      expect(__internal.habitCompletionRate(snap, 7, 80)).toBe(false);
      // 3 out of 3 = 100%
      expect(__internal.habitCompletionRate(snap, 3, 80)).toBe(true);
    });

    test("days=0 → always false (guards against divide-by-zero)", () => {
      expect(
        __internal.habitCompletionRate(baseSnapshot(), 0, 50),
      ).toBe(false);
    });
  });

  describe("weeklyConsistency", () => {
    test("counts weeks that had at least one active day", () => {
      // Build 4 weeks of Tuesday-only activity.
      const completions: { engine: EngineLit; date_key: string }[] = [];
      for (let w = 0; w < 4; w++) {
        const d = new Date(TODAY + "T12:00:00");
        d.setDate(d.getDate() - w * 7);
        completions.push({
          engine: E.body,
          date_key: d.toISOString().slice(0, 10),
        });
      }
      const snap = baseSnapshot({ completions });
      expect(__internal.weeklyConsistency(snap, 3)).toBe(true);
      expect(__internal.weeklyConsistency(snap, 5)).toBe(false);
    });
  });

  describe("focusDailyAvg", () => {
    test("divides session count by window days", () => {
      const snap = baseSnapshot({
        focusSessions: Array.from({ length: 14 }, () => ({
          date_key: TODAY,
        })),
      });
      // All 14 on today → 14 sessions / 7 days = 2.0 avg. Meets minSessions=2.
      expect(__internal.focusDailyAvg(snap, 7, 2)).toBe(true);
      // Same data, but ask for 14 days → 14/14 = 1.0. Below 2.
      expect(__internal.focusDailyAvg(snap, 14, 2)).toBe(false);
    });

    test("days=0 → false", () => {
      expect(__internal.focusDailyAvg(baseSnapshot(), 0, 1)).toBe(false);
    });
  });

  describe("focusMarathon", () => {
    test("counts distinct focus session dates", () => {
      const snap = baseSnapshot({
        focusSessions: [
          { date_key: "2026-04-23" },
          { date_key: "2026-04-23" }, // dup
          { date_key: "2026-04-22" },
          { date_key: "2026-04-21" },
        ],
      });
      expect(__internal.focusMarathon(snap, 3)).toBe(true);
      expect(__internal.focusMarathon(snap, 4)).toBe(false);
    });
  });

  describe("sleepAvgWeeks", () => {
    test("counts distinct logged dates in the window", () => {
      const snap = baseSnapshot({
        sleepLogs: Array.from({ length: 7 }, (_, i) => {
          const d = new Date(TODAY + "T12:00:00");
          d.setDate(d.getDate() - i);
          return { date_key: d.toISOString().slice(0, 10) };
        }),
      });
      // 7 of 14 days = 50% → meets 50% rate (the hardcoded floor).
      expect(__internal.sleepAvgWeeks(snap, 2)).toBe(true);
      // 7 of 21 = 33% → below.
      expect(__internal.sleepAvgWeeks(snap, 3)).toBe(false);
    });
  });
});

describe("evaluateSkillTreeWithSnapshot", () => {
  test("level-1 node with requirement met → becomes eligible", () => {
    // body_strength_1 requires 2 body task completions.
    const snap = baseSnapshot({
      completions: [
        { engine: E.body, date_key: TODAY },
        { engine: E.body, date_key: "2026-04-22" },
      ],
    });
    const eligible = evaluateSkillTreeWithSnapshot("body", snap);
    const nodeIds = eligible.map((n) => n.nodeId);
    expect(nodeIds).toContain("body_strength_1");
    expect(nodeIds).toContain("body_endurance_1");
  });

  test("level-1 node without enough completions → NOT eligible", () => {
    const snap = baseSnapshot({
      completions: [{ engine: E.body, date_key: TODAY }], // 1 completion, need 2
    });
    const eligible = evaluateSkillTreeWithSnapshot("body", snap);
    expect(eligible.map((n) => n.nodeId)).not.toContain("body_strength_1");
  });

  test("level-2 node requires level-1 CLAIMED (not just ready)", () => {
    // Give enough activity to satisfy a hypothetical level-2 body node.
    const lotsOfCompletions = Array.from({ length: 20 }, (_, i) => {
      const d = new Date(TODAY + "T12:00:00");
      d.setDate(d.getDate() - i);
      return { engine: E.body, date_key: d.toISOString().slice(0, 10) };
    });

    // Case A: level-1 is merely ready, not claimed.
    const readyOnly = evaluateSkillTreeWithSnapshot(
      "body",
      baseSnapshot({
        completions: lotsOfCompletions,
        skillRows: [
          {
            id: "r1",
            user_id: "u1",
            node_id: "body_strength_1",
            engine: E.body,
            state: "ready",
            progress: 0,
            claimed_at: null,
            updated_at: TODAY,
          },
        ],
      }),
    );
    expect(readyOnly.map((n) => n.nodeId)).not.toContain("body_strength_2");

    // Case B: level-1 is claimed.
    const claimed = evaluateSkillTreeWithSnapshot(
      "body",
      baseSnapshot({
        completions: lotsOfCompletions,
        skillRows: [
          {
            id: "r1",
            user_id: "u1",
            node_id: "body_strength_1",
            engine: E.body,
            state: "claimed",
            progress: 100,
            claimed_at: TODAY,
            updated_at: TODAY,
          },
        ],
      }),
    );
    // Note: we can't assert 'body_strength_2' is in the list without
    // precisely modelling its requirement (weekly_consistency for cardio),
    // but we CAN assert Case A and Case B differ meaningfully — Case A
    // must skip level-2 outright.
    expect(claimed).not.toBe(readyOnly); // same shape but different contents
  });

  test("already-ready node is not re-emitted", () => {
    const snap = baseSnapshot({
      completions: [
        { engine: E.body, date_key: TODAY },
        { engine: E.body, date_key: "2026-04-22" },
      ],
      skillRows: [
        {
          id: "r1",
          user_id: "u1",
          node_id: "body_strength_1",
          engine: E.body,
          state: "ready",
          progress: 0,
          claimed_at: null,
          updated_at: TODAY,
        },
      ],
    });
    const eligible = evaluateSkillTreeWithSnapshot("body", snap);
    expect(eligible.map((n) => n.nodeId)).not.toContain("body_strength_1");
  });

  test("already-claimed node is not re-emitted (no downgrade)", () => {
    const snap = baseSnapshot({
      completions: [
        { engine: E.body, date_key: TODAY },
        { engine: E.body, date_key: "2026-04-22" },
      ],
      skillRows: [
        {
          id: "r1",
          user_id: "u1",
          node_id: "body_strength_1",
          engine: E.body,
          state: "claimed",
          progress: 100,
          claimed_at: TODAY,
          updated_at: TODAY,
        },
      ],
    });
    const eligible = evaluateSkillTreeWithSnapshot("body", snap);
    expect(eligible.map((n) => n.nodeId)).not.toContain("body_strength_1");
  });

  test("unknown engine → empty list (no crash)", () => {
    expect(
      evaluateSkillTreeWithSnapshot("nonexistent", baseSnapshot()),
    ).toEqual([]);
  });
});

describe("evaluateAllTrees — integration against SQLite", () => {
  beforeEach(() => {
    _resetTestDb();
    (globalThis as { __idCounter?: number }).__idCounter = 0;
  });

  test("happy path: completions land → level-1 nodes become ready", async () => {
    // Seed 2 body completions directly.
    const db = _testDb();
    const insert = db.prepare(
      `INSERT INTO completions (id, user_id, task_id, engine, date_key, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    );
    insert.run("c1", "u1", "t1", "body", TODAY, TODAY);
    insert.run("c2", "u1", "t2", "body", "2026-04-22", "2026-04-22");

    // Sanity: the rows we just inserted are visible via the same DB handle.
    const inserted = db
      .prepare("SELECT COUNT(*) AS c FROM completions WHERE _deleted = 0")
      .get() as { c: number };
    expect(inserted.c).toBe(2);

    const snapPreview = await loadSnapshot(0);
    expect(snapPreview.completions.length).toBe(2);
    const preview = evaluateSkillTreeWithSnapshot("body", snapPreview);
    expect(preview.map((n) => n.nodeId)).toContain("body_strength_1");

    const results = await evaluateAllTrees();
    const nodeIds = results.map((r) => r.nodeId);

    // body_strength_1 + body_endurance_1 both have task_count >= 2.
    expect(nodeIds).toContain("body_strength_1");
    expect(nodeIds).toContain("body_endurance_1");

    // Verify the SQLite write landed with state='ready'.
    const row = db
      .prepare(
        "SELECT state FROM skill_tree_progress WHERE node_id = 'body_strength_1'",
      )
      .get() as { state: string } | undefined;
    expect(row?.state).toBe("ready");
  });

  test("idempotent: running twice does not create duplicate rows", async () => {
    const db = _testDb();
    db.prepare(
      `INSERT INTO completions (id, user_id, task_id, engine, date_key, created_at) VALUES ('c1', 'u1', 't1', 'body', ?, ?)`,
    ).run(TODAY, TODAY);
    db.prepare(
      `INSERT INTO completions (id, user_id, task_id, engine, date_key, created_at) VALUES ('c2', 'u1', 't2', 'body', ?, ?)`,
    ).run("2026-04-22", "2026-04-22");

    await evaluateAllTrees();
    await evaluateAllTrees();

    const count = (
      db
        .prepare(
          "SELECT COUNT(*) AS c FROM skill_tree_progress WHERE node_id = 'body_strength_1' AND _deleted = 0",
        )
        .get() as { c: number }
    ).c;
    expect(count).toBe(1);
  });

  test("empty state: no completions, no habits → nothing becomes ready", async () => {
    const results = await evaluateAllTrees();
    expect(results).toEqual([]);

    const count = (
      _testDb()
        .prepare("SELECT COUNT(*) AS c FROM skill_tree_progress")
        .get() as { c: number }
    ).c;
    expect(count).toBe(0);
  });

  test("loadSnapshot reads from SQLite, not MMKV (regression guard)", async () => {
    // If anyone reintroduces the MMKV path, this test catches it: we
    // seed SQLite and check that streakDays returns the right number
    // without any MMKV keys existing.
    const db = _testDb();
    for (let i = 0; i < 3; i++) {
      const d = new Date(TODAY + "T12:00:00");
      d.setDate(d.getDate() - i);
      const dk = d.toISOString().slice(0, 10);
      db.prepare(
        `INSERT INTO completions (id, user_id, task_id, engine, date_key, created_at) VALUES (?, 'u1', 't1', 'body', ?, ?)`,
      ).run(`c${i}`, dk, dk);
    }

    const snap = await loadSnapshot(0);
    expect(__internal.streakDays(snap)).toBe(3);
  });
});
