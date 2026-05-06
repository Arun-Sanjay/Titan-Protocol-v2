/**
 * Tests for the recordBossDay state machine added to fix the "no resolve
 * path" bug. The card now has pass/fail/abandon actions; this file
 * pins the resolution rules so they don't drift silently.
 *
 *   - any FAIL → status = "failed", resolved_at set
 *   - dayResults.length === days_required AND all true → "defeated"
 *   - otherwise → "active"
 *   - one log per local day (gated on updated_at slice)
 */

jest.mock("../../db/sqlite/client", () => require("../setup/sqlite-fake"));
jest.mock("../../lib/supabase", () => ({
  supabase: {},
  requireUserId: async () => "u1",
}));
jest.mock("../../lib/error-log", () => ({ logError: jest.fn() }));
jest.mock("expo-crypto", () => ({
  randomUUID: () => {
    const g = globalThis as { __idCounter?: number };
    g.__idCounter = (g.__idCounter ?? 0) + 1;
    return `test-id-${g.__idCounter}`;
  },
}));

import { _resetTestDb, _testDb } from "../setup/sqlite-fake";
import {
  startBossChallenge,
  recordBossDay,
  abandonBossChallenge,
  listActiveBossChallenges,
} from "../../services/boss-challenges";

describe("boss challenge state machine", () => {
  beforeEach(() => {
    _resetTestDb();
    (globalThis as { __idCounter?: number }).__idCounter = 0;
  });

  test("first PASS appends to day_results and stays active", async () => {
    const boss = await startBossChallenge({
      boss_id: "bo_seven_day",
      days_required: 7,
      evaluator_type: "titan_score",
    });
    const res = await recordBossDay({ id: boss.id, passed: true });
    expect(res.resolved).toBeNull();
    expect(res.alreadyLoggedToday).toBe(false);
    expect(res.challenge.status).toBe("active");
    expect(res.challenge.day_results).toEqual([true]);
    expect(res.challenge.progress).toBe(1);
  });

  test("a single FAIL resolves the boss to failed (no leniency)", async () => {
    const boss = await startBossChallenge({
      boss_id: "bo_seven_day",
      days_required: 7,
      evaluator_type: "titan_score",
    });
    const res = await recordBossDay({ id: boss.id, passed: false });
    expect(res.resolved).toBe("failed");
    expect(res.challenge.status).toBe("failed");
    expect(res.challenge.resolved_at).not.toBeNull();
  });

  test("days_required consecutive PASSes resolves to defeated", async () => {
    // Tiny boss to keep the test fast — 2-day variant.
    const boss = await startBossChallenge({
      boss_id: "bo_two_day",
      days_required: 2,
      evaluator_type: "titan_score",
    });

    // First PASS — still active. Manually backdate updated_at so the
    // second log isn't gated by the same-day guard.
    await recordBossDay({ id: boss.id, passed: true });
    const db = _testDb();
    db.prepare(
      "UPDATE boss_challenges SET updated_at = ? WHERE id = ?",
    ).run("2020-01-01T00:00:00.000Z", boss.id);

    const res = await recordBossDay({ id: boss.id, passed: true });
    expect(res.resolved).toBe("defeated");
    expect(res.challenge.status).toBe("defeated");
    expect(res.challenge.day_results).toEqual([true, true]);
  });

  test("a same-day second log returns alreadyLoggedToday and does not advance", async () => {
    const boss = await startBossChallenge({
      boss_id: "bo_seven_day",
      days_required: 7,
      evaluator_type: "titan_score",
    });
    await recordBossDay({ id: boss.id, passed: true });

    const res = await recordBossDay({ id: boss.id, passed: true });
    expect(res.alreadyLoggedToday).toBe(true);
    expect(res.resolved).toBeNull();
    expect(res.challenge.day_results).toEqual([true]);
  });

  test("recordBossDay on an already-resolved boss is a no-op", async () => {
    const boss = await startBossChallenge({
      boss_id: "bo_seven_day",
      days_required: 7,
      evaluator_type: "titan_score",
    });
    await recordBossDay({ id: boss.id, passed: false }); // resolves to failed

    const res = await recordBossDay({ id: boss.id, passed: true });
    expect(res.alreadyLoggedToday).toBe(true);
    expect(res.resolved).toBeNull();
    expect(res.challenge.status).toBe("failed");
  });

  test("abandonBossChallenge marks status='abandoned' and removes from active list", async () => {
    const boss = await startBossChallenge({
      boss_id: "bo_seven_day",
      days_required: 7,
      evaluator_type: "titan_score",
    });
    expect((await listActiveBossChallenges()).length).toBe(1);

    await abandonBossChallenge(boss.id);
    const active = await listActiveBossChallenges();
    expect(active.length).toBe(0);
  });
});
