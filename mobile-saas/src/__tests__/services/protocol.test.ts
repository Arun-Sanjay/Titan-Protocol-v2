jest.mock("../../db/sqlite/service-helpers", () => {
  const actual = jest.requireActual("../../db/sqlite/service-helpers");
  return {
    ...actual,
    cloudUpsert: actual.sqliteUpsert,
    cloudUpsertMany: actual.sqliteUpsertMany,
    cloudDelete: actual.sqliteDelete,
  };
});

/**
 * Regression tests for the idempotency fix in src/services/protocol.ts.
 *
 * The bug: a deep-link replay or back-stack revisit could re-call
 * saveMorningSession / saveEveningSession after the day was already
 * completed. The service stomped morning_completed_at / evening_completed_at
 * with a fresh timestamp, the screen awarded XP again, and the user could
 * farm rank progression by repeatedly opening /protocol.
 *
 * The fix: the service short-circuits when the *_completed_at column is
 * already set, returning the existing row + alreadyCompleted: true.
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

import { _resetTestDb } from "../setup/sqlite-fake";
import {
  saveMorningSession,
  saveEveningSession,
  getProtocolSession,
} from "../../services/protocol";

describe("protocol completion idempotency", () => {
  beforeEach(() => {
    _resetTestDb();
    (globalThis as { __idCounter?: number }).__idCounter = 0;
  });

  test("saveMorningSession is idempotent — second call returns existing row + alreadyCompleted", async () => {
    const first = await saveMorningSession({
      dateKey: "2026-04-23",
      intention: "Ship the fix without cutting corners",
    });
    expect(first.alreadyCompleted).toBe(false);
    expect(first.session.morning_intention).toBe(
      "Ship the fix without cutting corners",
    );
    const firstStamp = first.session.morning_completed_at;
    expect(firstStamp).not.toBeNull();

    // Pretend a deep-link replay fires the save with a different
    // intention. The service must NOT overwrite the original.
    await new Promise((r) => setTimeout(r, 5));
    const second = await saveMorningSession({
      dateKey: "2026-04-23",
      intention: "DIFFERENT — should not land",
    });
    expect(second.alreadyCompleted).toBe(true);
    expect(second.session.morning_intention).toBe(
      "Ship the fix without cutting corners",
    );
    expect(second.session.morning_completed_at).toBe(firstStamp);
  });

  test("saveEveningSession is idempotent on evening_completed_at", async () => {
    await saveMorningSession({
      dateKey: "2026-04-23",
      intention: "set up morning first",
    });
    const first = await saveEveningSession({
      dateKey: "2026-04-23",
      reflection: "good day",
      titanScore: 80,
    });
    expect(first.alreadyCompleted).toBe(false);
    expect(first.session.titan_score).toBe(80);
    const firstStamp = first.session.evening_completed_at;

    await new Promise((r) => setTimeout(r, 5));
    const second = await saveEveningSession({
      dateKey: "2026-04-23",
      reflection: "DIFFERENT REFLECTION",
      titanScore: 9999, // attempt to inflate
    });
    expect(second.alreadyCompleted).toBe(true);
    expect(second.session.evening_reflection).toBe("good day");
    expect(second.session.titan_score).toBe(80);
    expect(second.session.evening_completed_at).toBe(firstStamp);
  });

  test("morning save then evening save coexist on the same row", async () => {
    await saveMorningSession({
      dateKey: "2026-04-23",
      intention: "morning intention",
    });
    await saveEveningSession({
      dateKey: "2026-04-23",
      reflection: "evening reflection",
      titanScore: 70,
    });
    const row = await getProtocolSession("2026-04-23");
    expect(row?.morning_intention).toBe("morning intention");
    expect(row?.evening_reflection).toBe("evening reflection");
    expect(row?.morning_completed_at).not.toBeNull();
    expect(row?.evening_completed_at).not.toBeNull();
  });
});