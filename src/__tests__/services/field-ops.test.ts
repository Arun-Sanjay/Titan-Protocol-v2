/**
 * Tests for recordFieldOpDay added to close the dead-link bug. The
 * field-ops list pushed users to /field-op/[id] which had no screen;
 * now there's a screen, but the underlying state machine is what
 * actually progresses or fails the op. Pin its rules:
 *
 *   sprint    → any FAIL = failed.
 *   endurance → 2 consecutive FAILs = failed.
 *   any type  → reaching durationDays with the final day passing = completed.
 *   one log per local day (started_at / completed_at slice).
 */

jest.mock("../../db/sqlite/client", () => require("../setup/sqlite-fake"));
jest.mock("../../lib/supabase", () => ({
  supabase: {},
  requireUserId: async () => "u1",
}));
jest.mock("../../lib/error-log", () => ({ logError: jest.fn() }));
// MMKV is not available in node — short-circuit the storage module the
// `lib/field-ops.ts` def lookup pulls in transitively.
jest.mock("../../db/storage", () => ({
  storage: {},
  getJSON: <T,>(_k: string, fb: T) => fb,
  setJSON: () => {},
  nextId: () => 1,
}));
jest.mock("expo-crypto", () => ({
  randomUUID: () => {
    const g = globalThis as { __idCounter?: number };
    g.__idCounter = (g.__idCounter ?? 0) + 1;
    return `test-id-${g.__idCounter}`;
  },
}));
// Stub the static defs so the test doesn't need to know which IDs ship.
jest.mock("../../data/field-ops.json", () => [
  {
    id: "test_sprint",
    name: "Test Sprint",
    description: "...",
    type: "sprint",
    minRank: "initiate",
    durationDays: 3,
    objective: { type: "avg_score", threshold: 70 },
    xpReward: 100,
    statBonus: 0,
    titleReward: null,
  },
  {
    id: "test_endurance",
    name: "Test Endurance",
    description: "...",
    type: "endurance",
    minRank: "initiate",
    durationDays: 5,
    objective: { type: "avg_score", threshold: 60 },
    xpReward: 200,
    statBonus: 0,
    titleReward: null,
  },
]);

import { _resetTestDb, _testDb } from "../setup/sqlite-fake";
import {
  startFieldOp,
  recordFieldOpDay,
  resolveFieldOp,
  getActiveFieldOp,
  getFieldOpCooldown,
} from "../../services/field-ops";

function backdateRow(id: string): void {
  // Push started_at and completed_at well into the past so the same-day
  // guard doesn't block the next log call within a single test.
  _testDb()
    .prepare(
      "UPDATE field_ops SET started_at = ?, completed_at = ? WHERE id = ?",
    )
    .run("2020-01-01T00:00:00.000Z", null, id);
}

describe("field op recordFieldOpDay state machine", () => {
  beforeEach(() => {
    _resetTestDb();
    (globalThis as { __idCounter?: number }).__idCounter = 0;
  });

  test("sprint: any FAIL resolves to failed", async () => {
    const op = await startFieldOp({ fieldOpId: "test_sprint" });
    const res = await recordFieldOpDay({ id: op.id, passed: false });
    expect(res.resolved).toBe("failed");
    expect(res.fieldOp.status).toBe("failed");
  });

  test("sprint: durationDays consecutive PASSes resolve to completed", async () => {
    const op = await startFieldOp({ fieldOpId: "test_sprint" });
    await recordFieldOpDay({ id: op.id, passed: true });
    backdateRow(op.id);
    await recordFieldOpDay({ id: op.id, passed: true });
    backdateRow(op.id);
    const res = await recordFieldOpDay({ id: op.id, passed: true });
    expect(res.resolved).toBe("completed");
    expect(res.fieldOp.status).toBe("completed");
    expect(res.fieldOp.day_results).toEqual([true, true, true]);
  });

  test("endurance: a single FAIL is survivable; 2 consecutive FAILs resolve to failed", async () => {
    const op = await startFieldOp({ fieldOpId: "test_endurance" });
    // Day 1 fail — survives.
    let res = await recordFieldOpDay({ id: op.id, passed: false });
    expect(res.resolved).toBeNull();
    expect(res.fieldOp.status).toBe("active");

    // Day 2 pass — still active.
    backdateRow(op.id);
    res = await recordFieldOpDay({ id: op.id, passed: true });
    expect(res.resolved).toBeNull();

    // Day 3 fail — still active (only one consecutive fail).
    backdateRow(op.id);
    res = await recordFieldOpDay({ id: op.id, passed: false });
    expect(res.resolved).toBeNull();

    // Day 4 fail — 2 consecutive → failed.
    backdateRow(op.id);
    res = await recordFieldOpDay({ id: op.id, passed: false });
    expect(res.resolved).toBe("failed");
    expect(res.fieldOp.status).toBe("failed");
  });

  test("same-day double log returns alreadyLoggedToday and does not advance", async () => {
    const op = await startFieldOp({ fieldOpId: "test_sprint" });
    await recordFieldOpDay({ id: op.id, passed: true });

    const res = await recordFieldOpDay({ id: op.id, passed: true });
    expect(res.alreadyLoggedToday).toBe(true);
    expect(res.resolved).toBeNull();
    expect(res.fieldOp.day_results).toEqual([true]);
  });

  test("recordFieldOpDay on a resolved op is a no-op", async () => {
    const op = await startFieldOp({ fieldOpId: "test_sprint" });
    await recordFieldOpDay({ id: op.id, passed: false }); // → failed

    const res = await recordFieldOpDay({ id: op.id, passed: true });
    expect(res.alreadyLoggedToday).toBe(true);
    expect(res.resolved).toBeNull();
    expect(res.fieldOp.status).toBe("failed");
  });
});

describe("field op start guards", () => {
  beforeEach(() => {
    _resetTestDb();
    (globalThis as { __idCounter?: number }).__idCounter = 0;
  });

  test("starting an op initialises day_results as an array, not an object", async () => {
    const op = await startFieldOp({ fieldOpId: "test_sprint" });
    expect(Array.isArray(op.day_results)).toBe(true);
    expect(op.day_results).toEqual([]);
  });

  test("a second start while one is active returns the existing active op", async () => {
    const first = await startFieldOp({ fieldOpId: "test_sprint" });
    const second = await startFieldOp({ fieldOpId: "test_endurance" });
    expect(second.id).toBe(first.id);
    // Only one row is visible to the active query.
    const active = await getActiveFieldOp();
    expect(active?.id).toBe(first.id);
  });

  test("start refuses while a cooldown is in effect", async () => {
    const op = await startFieldOp({ fieldOpId: "test_sprint" });
    await resolveFieldOp({ id: op.id, status: "abandoned" });

    // Cooldown row written by the resolve.
    const cooldown = await getFieldOpCooldown();
    expect(cooldown?.cooldown_until).toBeTruthy();

    await expect(
      startFieldOp({ fieldOpId: "test_sprint" }),
    ).rejects.toThrow(/cooldown/i);
  });
});

describe("field op cooldown propagation", () => {
  beforeEach(() => {
    _resetTestDb();
    (globalThis as { __idCounter?: number }).__idCounter = 0;
  });

  test("resolveFieldOp(failed) writes the cooldown row", async () => {
    const op = await startFieldOp({ fieldOpId: "test_sprint" });
    await resolveFieldOp({ id: op.id, status: "failed" });

    const cooldown = await getFieldOpCooldown();
    expect(cooldown).not.toBeNull();
    if (cooldown?.cooldown_until) {
      expect(new Date(cooldown.cooldown_until).getTime()).toBeGreaterThan(
        Date.now() - 1000,
      );
    }
  });

  test("resolveFieldOp(abandoned) writes the cooldown row", async () => {
    const op = await startFieldOp({ fieldOpId: "test_sprint" });
    await resolveFieldOp({ id: op.id, status: "abandoned" });

    const cooldown = await getFieldOpCooldown();
    expect(cooldown?.cooldown_until).toBeTruthy();
  });

  test("resolveFieldOp(completed) does NOT write a cooldown", async () => {
    const op = await startFieldOp({ fieldOpId: "test_sprint" });
    await resolveFieldOp({ id: op.id, status: "completed" });

    const cooldown = await getFieldOpCooldown();
    expect(cooldown).toBeNull();
  });

  test("a sprint failure via recordFieldOpDay also writes the cooldown", async () => {
    const op = await startFieldOp({ fieldOpId: "test_sprint" });
    const res = await recordFieldOpDay({ id: op.id, passed: false });
    expect(res.resolved).toBe("failed");

    const cooldown = await getFieldOpCooldown();
    expect(cooldown?.cooldown_until).toBeTruthy();
  });
});
