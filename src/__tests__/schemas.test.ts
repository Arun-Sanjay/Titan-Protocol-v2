/**
 * Phase 2.4F: Tests for the Zod schemas + parseOrFallback helper.
 *
 * Schemas are validated at storage read boundaries (Phase 2.2C). The
 * critical contract: malformed data falls back to a default and logs
 * an error, but never throws. These tests pin both the happy path
 * and the graceful-degradation path.
 */
import {
  TaskSchema,
  CompletionIdsSchema,
  HabitSchema,
  UserProfileSchema,
  RankUpEventSchema,
  RankUpQueueSchema,
  ProtocolSessionSchema,
  SkillTreeDataSchema,
  parseOrFallback,
} from "../lib/schemas";

describe("TaskSchema", () => {
  it("accepts a valid task", () => {
    const ok = TaskSchema.safeParse({
      id: 1,
      engine: "body",
      title: "Pushups",
      kind: "main",
      created_at: 1700000000,
      days_per_week: 7,
      is_active: 1,
    });
    expect(ok.success).toBe(true);
  });

  it("accepts a task without an id (new tasks)", () => {
    const ok = TaskSchema.safeParse({
      engine: "mind",
      title: "Read",
      kind: "secondary",
      created_at: 1700000000,
      days_per_week: 3,
      is_active: 1,
    });
    expect(ok.success).toBe(true);
  });

  it("rejects unknown engine values", () => {
    const bad = TaskSchema.safeParse({
      engine: "alchemy",
      title: "x",
      kind: "main",
      created_at: 0,
      days_per_week: 7,
      is_active: 1,
    });
    expect(bad.success).toBe(false);
  });

  it("rejects days_per_week outside 1-7", () => {
    const tooMany = TaskSchema.safeParse({
      engine: "body",
      title: "x",
      kind: "main",
      created_at: 0,
      days_per_week: 8,
      is_active: 1,
    });
    expect(tooMany.success).toBe(false);

    const zero = TaskSchema.safeParse({
      engine: "body",
      title: "x",
      kind: "main",
      created_at: 0,
      days_per_week: 0,
      is_active: 1,
    });
    expect(zero.success).toBe(false);
  });
});

describe("CompletionIdsSchema", () => {
  it("accepts an empty array", () => {
    expect(CompletionIdsSchema.safeParse([]).success).toBe(true);
  });

  it("accepts an array of integers", () => {
    expect(CompletionIdsSchema.safeParse([1, 2, 3, 99]).success).toBe(true);
  });

  it("rejects non-integer values", () => {
    expect(CompletionIdsSchema.safeParse([1.5, 2]).success).toBe(false);
    expect(CompletionIdsSchema.safeParse(["1", "2"]).success).toBe(false);
  });
});

describe("UserProfileSchema", () => {
  it("accepts a valid profile", () => {
    const ok = UserProfileSchema.safeParse({
      id: "default",
      xp: 250,
      level: 1,
      streak: 5,
      best_streak: 12,
      last_active_date: "2026-04-06",
    });
    expect(ok.success).toBe(true);
  });

  it("rejects negative xp", () => {
    const bad = UserProfileSchema.safeParse({
      id: "default",
      xp: -10,
      level: 1,
      streak: 0,
      best_streak: 0,
      last_active_date: "",
    });
    expect(bad.success).toBe(false);
  });

  it("rejects level less than 1", () => {
    const bad = UserProfileSchema.safeParse({
      id: "default",
      xp: 0,
      level: 0,
      streak: 0,
      best_streak: 0,
      last_active_date: "",
    });
    expect(bad.success).toBe(false);
  });
});

describe("RankUpEventSchema / RankUpQueueSchema", () => {
  it("accepts a valid rank-up event", () => {
    const ok = RankUpEventSchema.safeParse({
      id: "abc123",
      from: 1,
      to: 2,
      at: Date.now(),
    });
    expect(ok.success).toBe(true);
  });

  it("rejects rank-up where from < 1", () => {
    const bad = RankUpEventSchema.safeParse({
      id: "abc",
      from: 0,
      to: 1,
      at: 0,
    });
    expect(bad.success).toBe(false);
  });

  it("validates an array of events", () => {
    const ok = RankUpQueueSchema.safeParse([
      { id: "a", from: 1, to: 2, at: 1 },
      { id: "b", from: 2, to: 4, at: 2 }, // multi-level jump allowed
    ]);
    expect(ok.success).toBe(true);
  });
});

describe("ProtocolSessionSchema", () => {
  it("accepts a complete session", () => {
    const ok = ProtocolSessionSchema.safeParse({
      dateKey: "2026-04-06",
      completedAt: Date.now(),
      intention: "Ship phase 2.4",
      habitChecks: { "1": true, "2": false },
      titanScore: 78,
      identityVote: "athlete",
    });
    expect(ok.success).toBe(true);
  });

  it("accepts null identity vote", () => {
    const ok = ProtocolSessionSchema.safeParse({
      dateKey: "2026-04-06",
      completedAt: 0,
      intention: "",
      habitChecks: {},
      titanScore: 0,
      identityVote: null,
    });
    expect(ok.success).toBe(true);
  });

  it("rejects titanScore > 100", () => {
    const bad = ProtocolSessionSchema.safeParse({
      dateKey: "2026-04-06",
      completedAt: 0,
      intention: "",
      habitChecks: {},
      titanScore: 105,
      identityVote: null,
    });
    expect(bad.success).toBe(false);
  });
});

describe("SkillTreeDataSchema", () => {
  it("accepts the canonical shape", () => {
    const ok = SkillTreeDataSchema.safeParse({
      body: {
        branches: [
          {
            id: "strength",
            name: "Strength",
            levels: [
              {
                nodeId: "body_strength_1",
                level: 1,
                name: "Beginner",
                description: "Complete 2 body tasks",
              },
            ],
          },
        ],
      },
    });
    expect(ok.success).toBe(true);
  });

  it("accepts empty engine map (some engines missing)", () => {
    const ok = SkillTreeDataSchema.safeParse({});
    expect(ok.success).toBe(true);
  });

  it("rejects branch missing levels array", () => {
    const bad = SkillTreeDataSchema.safeParse({
      body: { branches: [{ id: "x", name: "X" }] },
    });
    expect(bad.success).toBe(false);
  });
});

describe("HabitSchema", () => {
  it("accepts minimal habit", () => {
    const ok = HabitSchema.safeParse({
      title: "Meditate",
      engine: "mind",
      icon: "🧘",
      created_at: 0,
    });
    expect(ok.success).toBe(true);
  });

  it("accepts habit with optional fields", () => {
    const ok = HabitSchema.safeParse({
      id: 5,
      title: "Cold shower",
      engine: "body",
      icon: "🚿",
      created_at: 0,
      trigger: "After waking up",
      duration: "2 min",
      frequency: "daily",
    });
    expect(ok.success).toBe(true);
  });
});

describe("parseOrFallback", () => {
  it("returns parsed data on success", () => {
    const result = parseOrFallback(
      CompletionIdsSchema,
      [1, 2, 3],
      [],
      "test",
    );
    expect(result).toEqual([1, 2, 3]);
  });

  it("returns fallback on parse failure", () => {
    const result = parseOrFallback(
      CompletionIdsSchema,
      "not an array",
      [],
      "test",
    );
    expect(result).toEqual([]);
  });

  it("returns fallback for null input", () => {
    const result = parseOrFallback(
      UserProfileSchema,
      null,
      { id: "default" as const, xp: 0, level: 1, streak: 0, best_streak: 0, last_active_date: "" },
      "test",
    );
    expect(result.xp).toBe(0);
  });

  it("never throws even for completely garbage input", () => {
    expect(() =>
      parseOrFallback(TaskSchema, { totally: "wrong" }, undefined as never, "test"),
    ).not.toThrow();
  });
});
