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
 * Pin the weight log ordering convention. Both `hub/weight.tsx` and
 * `hub/nutrition.tsx` read `entries[entries.length - 1]` as "latest",
 * so the service must return ascending (oldest first → newest last).
 *
 * The previous DESC ordering matched the literal column name but
 * inverted the UI's expectation, so logging 80 kg yesterday and 79 kg
 * today made every screen think the user was at 80 kg.
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
import { createWeightLog, listWeightLogs } from "../../services/weight";

describe("weight log ordering", () => {
  beforeEach(() => {
    _resetTestDb();
    (globalThis as { __idCounter?: number }).__idCounter = 0;
  });

  test("listWeightLogs returns oldest-first; the last element is the latest", async () => {
    // Insert out-of-order on purpose to test the SQL ORDER BY, not the
    // insertion order.
    await createWeightLog({ date_key: "2026-04-22", weight_kg: 80 });
    await createWeightLog({ date_key: "2026-04-21", weight_kg: 81 });
    await createWeightLog({ date_key: "2026-04-23", weight_kg: 79 });

    const rows = await listWeightLogs();
    expect(rows.map((r) => r.date_key)).toEqual([
      "2026-04-21",
      "2026-04-22",
      "2026-04-23",
    ]);
    // The UI reads rows[rows.length - 1] as "latest". Pin that.
    expect(rows[rows.length - 1].weight_kg).toBe(79);
    expect(rows[0].weight_kg).toBe(81);
  });
});