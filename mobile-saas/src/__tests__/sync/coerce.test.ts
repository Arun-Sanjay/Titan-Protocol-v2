import {
  rowFromSqlite,
  rowToSqlite,
  stripSyncColumns,
  valueFromSqlite,
  valueToSqlite,
} from "../../db/sqlite/coerce";

describe("valueToSqlite / valueFromSqlite", () => {
  test("booleans round-trip through 0/1", () => {
    expect(valueToSqlite("boolean", true)).toBe(1);
    expect(valueToSqlite("boolean", false)).toBe(0);
    expect(valueFromSqlite("boolean", 1)).toBe(true);
    expect(valueFromSqlite("boolean", 0)).toBe(false);
  });

  test("json round-trip through strings", () => {
    const obj = { a: 1, b: [true, false] };
    const stored = valueToSqlite("json", obj);
    expect(typeof stored).toBe("string");
    expect(valueFromSqlite("json", stored)).toEqual(obj);
  });

  test("null passes through unchanged", () => {
    expect(valueToSqlite("boolean", null)).toBeNull();
    expect(valueFromSqlite("json", null)).toBeNull();
    expect(valueToSqlite("json", undefined)).toBeUndefined();
  });

  test("text / integer / real pass through untouched", () => {
    expect(valueToSqlite("text", "hello")).toBe("hello");
    expect(valueToSqlite("integer", 42)).toBe(42);
    expect(valueToSqlite("real", 1.5)).toBe(1.5);
    expect(valueFromSqlite("text", "hello")).toBe("hello");
    expect(valueFromSqlite("integer", 42)).toBe(42);
  });

  test("json from-sqlite is tolerant of already-parsed values", () => {
    // If some earlier layer parsed the JSON already, don't blow up.
    expect(valueFromSqlite("json", { a: 1 } as unknown)).toEqual({ a: 1 });
  });

  test("json from-sqlite on malformed string returns the string", () => {
    expect(valueFromSqlite("json", "not json")).toBe("not json");
  });
});

describe("rowToSqlite", () => {
  test("coerces known column kinds on a real table shape", () => {
    const row = {
      id: "task-1",
      user_id: "u1",
      title: "Read",
      engine: "mind",
      kind: "main",
      is_active: true,
      days_per_week: 7,
      created_at: "2026-04-18T00:00:00Z",
      updated_at: "2026-04-18T00:00:00Z",
    };
    const sqlite = rowToSqlite("tasks", row);
    expect(sqlite.is_active).toBe(1);
    expect(sqlite.title).toBe("Read");
    expect(sqlite.days_per_week).toBe(7);
  });

  test("stringifies json columns", () => {
    const row = {
      id: "b1",
      user_id: "u1",
      boss_id: "boss_1",
      started_at: "2026-04-18T00:00:00Z",
      progress: 0,
      days_required: 7,
      evaluator_type: "habit_streak",
      day_results: [true, false, true],
      status: "active",
      resolved_at: null,
      updated_at: "2026-04-18T00:00:00Z",
    };
    const sqlite = rowToSqlite("boss_challenges", row);
    expect(typeof sqlite.day_results).toBe("string");
    expect(JSON.parse(sqlite.day_results as string)).toEqual([true, false, true]);
  });

  test("unknown table throws", () => {
    expect(() => rowToSqlite("not_a_table", {})).toThrow(/Unknown synced table/);
  });
});

describe("rowFromSqlite", () => {
  test("coerces booleans back + parses json back", () => {
    const sqlite = {
      id: "b1",
      user_id: "u1",
      boss_id: "boss_1",
      started_at: "2026-04-18T00:00:00Z",
      progress: 2,
      days_required: 7,
      evaluator_type: "habit_streak",
      day_results: JSON.stringify([true, false]),
      status: "active",
      resolved_at: null,
      updated_at: "2026-04-18T00:00:00Z",
    };
    const row = rowFromSqlite("boss_challenges", sqlite);
    expect(row.day_results).toEqual([true, false]);
    expect(row.progress).toBe(2);
  });

  test("preserves unknown columns (pass-through)", () => {
    const row = rowFromSqlite("tasks", {
      id: "t1",
      user_id: "u1",
      title: "Read",
      engine: "mind",
      kind: "main",
      is_active: 1,
      days_per_week: 7,
      created_at: "now",
      updated_at: "now",
      _dirty: 1,
      _deleted: 0,
      __extra_col: "foo",
    });
    expect(row.is_active).toBe(true);
    expect(row.__extra_col).toBe("foo");
    expect(row._dirty).toBe(1);
  });
});

describe("stripSyncColumns", () => {
  test("removes _dirty and _deleted", () => {
    const stripped = stripSyncColumns({
      id: "t1",
      title: "Read",
      _dirty: 1,
      _deleted: 0,
    });
    expect(stripped).toEqual({ id: "t1", title: "Read" });
  });

  test("rows without sync columns pass through unchanged", () => {
    const input = { id: "t1", title: "Read" };
    expect(stripSyncColumns(input)).toEqual(input);
  });
});
