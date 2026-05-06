/**
 * Tests for src/services/sleep.ts persisting bedtime/wakeTime through
 * the JSON envelope in `notes`. The bug closed: the UI collected
 * bedtime + wake time but the service threw them away, so a later
 * read fabricated a 7am wake from `hours_slept`.
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
  upsertSleepLog,
  listSleepLogs,
} from "../../services/sleep";

describe("sleep service — bedtime/wakeTime round-trip", () => {
  beforeEach(() => {
    _resetTestDb();
    (globalThis as { __idCounter?: number }).__idCounter = 0;
  });

  test("upsert persists bedtime + wakeTime; list returns them parsed", async () => {
    const saved = await upsertSleepLog({
      date_key: "2026-04-23",
      hours_slept: 8,
      quality: 4,
      bedtime: "23:00",
      wakeTime: "07:00",
      notes: "deep sleep",
    });
    expect(saved.bedtime).toBe("23:00");
    expect(saved.wakeTime).toBe("07:00");
    expect(saved.note).toBe("deep sleep");

    const [round] = await listSleepLogs();
    expect(round.bedtime).toBe("23:00");
    expect(round.wakeTime).toBe("07:00");
    expect(round.note).toBe("deep sleep");
    expect(round.hours_slept).toBe(8);
    expect(round.quality).toBe(4);
  });

  test("partial update preserves the previously-saved schedule", async () => {
    await upsertSleepLog({
      date_key: "2026-04-23",
      hours_slept: 7,
      quality: 3,
      bedtime: "01:00",
      wakeTime: "08:00",
      notes: "ok",
    });
    // Edit just quality — bedtime/wake should NOT be wiped.
    await upsertSleepLog({
      date_key: "2026-04-23",
      quality: 5,
    });

    const [row] = await listSleepLogs();
    expect(row.bedtime).toBe("01:00");
    expect(row.wakeTime).toBe("08:00");
    expect(row.note).toBe("ok");
    expect(row.quality).toBe(5);
  });

  test("a log written without bed/wake decodes as null on read", async () => {
    await upsertSleepLog({
      date_key: "2026-04-23",
      hours_slept: 6,
      quality: 2,
      notes: "tossed all night",
    });
    const [row] = await listSleepLogs();
    expect(row.bedtime).toBeNull();
    expect(row.wakeTime).toBeNull();
    expect(row.note).toBe("tossed all night");
  });
});
