jest.mock("../../db/sqlite/service-helpers", () => {
  const actual = jest.requireActual("../../db/sqlite/service-helpers");
  return {
    ...actual,
    cloudUpsert: actual.sqliteUpsert,
    cloudUpsertMany: actual.sqliteUpsertMany,
    cloudDelete: actual.sqliteDelete,
  };
});

jest.mock("../../db/sqlite/client", () => require("../setup/sqlite-fake"));

// `cloudGet` (the cache-miss fallback inside the profile service) reads
// the cloud row via supabase.from(...).select().eq().maybeSingle().
// `mockCloudRowHolder.row` is what the fake cloud returns.
const mockCloudRowHolder: { row: Record<string, unknown> | null } = {
  row: null,
};
jest.mock("../../lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => {
        const chain = {
          eq: () => chain,
          maybeSingle: async () => ({
            data: mockCloudRowHolder.row,
            error: null,
          }),
        };
        return chain;
      },
    }),
  },
  requireUserId: async () => "u-42",
  ensureProfileRow: async () => {},
}));
jest.mock("../../lib/error-log", () => ({ logError: jest.fn() }));
jest.mock("expo-crypto", () => ({
  randomUUID: () => "unused-because-profile-pk-is-userId",
}));

import { _resetTestDb } from "../setup/sqlite-fake";
import { getProfile, upsertProfile } from "../../services/profile";

/** A canonical cloud profile row, as the handle_new_user trigger +
 *  real usage would have it — an EXISTING user with progress. */
function cloudProfileFixture(
  over: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: "u-42",
    email: "u42@example.com",
    display_name: null,
    archetype: null,
    level: 2,
    xp: 420,
    streak_current: 3,
    streak_best: 5,
    streak_last_date: "2026-06-08",
    mode: "full_protocol",
    focus_engines: [],
    onboarding_completed: false,
    tutorial_completed: false,
    first_use_date: "2026-06-01",
    first_task_completed_at: null,
    expo_push_token: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...over,
  };
}

describe("profile service", () => {
  beforeEach(() => {
    _resetTestDb();
    mockCloudRowHolder.row = null;
  });

  test("getProfile returns null on a fresh install", async () => {
    expect(await getProfile()).toBeNull();
  });

  test("cache miss falls back to the cloud row — existing progress survives (regression: onboarding profile wipe)", async () => {
    // Fresh device: SQLite is empty, but the cloud has the user's real
    // profile. Completing onboarding must merge onto THAT row — the old
    // defaultProfile fallback pushed xp=0/level=1/streak=0 to the cloud.
    mockCloudRowHolder.row = cloudProfileFixture();

    const p = await upsertProfile({
      archetype: "titan",
      onboarding_completed: true,
    });

    expect(p.id).toBe("u-42");
    expect(p.archetype).toBe("titan");
    expect(p.onboarding_completed).toBe(true);
    // The user's progress must NOT be reset by the merge.
    expect(p.xp).toBe(420);
    expect(p.level).toBe(2);
    expect(p.streak_current).toBe(3);
    expect(p.streak_best).toBe(5);
  });

  test("throws (writes nothing) when no profile row exists in cache or cloud", async () => {
    mockCloudRowHolder.row = null;
    await expect(upsertProfile({ display_name: "arun" })).rejects.toThrow(
      /refusing to write defaults/,
    );
    expect(await getProfile()).toBeNull();
  });

  test("upsertProfile merges partial updates (preserves other fields)", async () => {
    mockCloudRowHolder.row = cloudProfileFixture();
    await upsertProfile({
      display_name: "arun",
      archetype: "titan",
      xp: 500,
      level: 3,
    });
    // Second call only updates one field — others must survive. The cache
    // is seeded now, so this path never touches the cloud fallback.
    mockCloudRowHolder.row = null;
    await upsertProfile({ xp: 700 });

    const p = await getProfile();
    expect(p?.display_name).toBe("arun");
    expect(p?.archetype).toBe("titan");
    expect(p?.level).toBe(3);
    expect(p?.xp).toBe(700);
  });

  test("focus_engines is round-tripped as array (json coercion)", async () => {
    mockCloudRowHolder.row = cloudProfileFixture();
    await upsertProfile({ focus_engines: ["mind", "body"] });
    const p = await getProfile();
    expect(p?.focus_engines).toEqual(["mind", "body"]);
  });
});
