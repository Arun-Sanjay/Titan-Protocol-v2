jest.mock("../../db/sqlite/client", () => require("../setup/sqlite-fake"));
jest.mock("../../lib/supabase", () => ({
  supabase: {},
  requireUserId: async () => "u-42",
  ensureProfileRow: async () => {},
}));
jest.mock("../../sync/engine", () => ({
  scheduleMutationPush: jest.fn(),
}));
jest.mock("../../lib/error-log", () => ({ logError: jest.fn() }));
jest.mock("expo-crypto", () => ({
  randomUUID: () => "unused-because-profile-pk-is-userId",
}));

import { _resetTestDb } from "../setup/sqlite-fake";
import { getProfile, upsertProfile } from "../../services/profile";

describe("profile service", () => {
  beforeEach(() => {
    _resetTestDb();
  });

  test("getProfile returns null on a fresh install", async () => {
    expect(await getProfile()).toBeNull();
  });

  test("upsertProfile creates a row with defaults when none exists", async () => {
    const p = await upsertProfile({ display_name: "arun" });
    expect(p.id).toBe("u-42");
    expect(p.display_name).toBe("arun");
    expect(p.level).toBe(1);
    expect(p.xp).toBe(0);
    expect(p.onboarding_completed).toBe(false);
    expect(p.focus_engines).toEqual([]);

    const read = await getProfile();
    expect(read?.display_name).toBe("arun");
  });

  test("upsertProfile merges partial updates (preserves other fields)", async () => {
    await upsertProfile({
      display_name: "arun",
      archetype: "titan",
      xp: 500,
      level: 3,
    });
    // Second call only updates one field — others must survive.
    await upsertProfile({ xp: 700 });

    const p = await getProfile();
    expect(p?.display_name).toBe("arun");
    expect(p?.archetype).toBe("titan");
    expect(p?.level).toBe(3);
    expect(p?.xp).toBe(700);
  });

  test("focus_engines is round-tripped as array (json coercion)", async () => {
    await upsertProfile({ focus_engines: ["mind", "body"] });
    const p = await getProfile();
    expect(p?.focus_engines).toEqual(["mind", "body"]);
  });
});
