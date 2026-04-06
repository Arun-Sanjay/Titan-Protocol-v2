/**
 * MMKV data migration: general → charisma engine rename
 * Runs synchronously before stores initialize.
 */

import type { MMKV } from "react-native-mmkv";

const MIGRATION_KEY = "migration_v2_charisma";

export function runMigrations(storage: MMKV): void {
  if (storage.getBoolean(MIGRATION_KEY)) return;

  const allKeys = storage.getAllKeys();

  for (const key of allKeys) {
    // tasks:general → tasks:charisma
    if (key === "tasks:general") {
      const val = storage.getString(key);
      if (val) storage.set("tasks:charisma", val);
      storage.remove(key);
    }

    // completions:general:YYYY-MM-DD → completions:charisma:YYYY-MM-DD
    if (key.startsWith("completions:general:")) {
      const dateKey = key.slice("completions:general:".length);
      const val = storage.getString(key);
      if (val) storage.set(`completions:charisma:${dateKey}`, val);
      storage.remove(key);
    }

    // scores:general:YYYY-MM-DD → scores:charisma:YYYY-MM-DD
    if (key.startsWith("scores:general:")) {
      const dateKey = key.slice("scores:general:".length);
      const val = storage.getString(key);
      if (val) storage.set(`scores:charisma:${dateKey}`, val);
      storage.remove(key);
    }
  }

  // Migrate engine_priority array
  const priorityRaw = storage.getString("engine_priority");
  if (priorityRaw) {
    try {
      const arr = JSON.parse(priorityRaw) as string[];
      const migrated = arr.map((e) => (e === "general" ? "charisma" : e));
      storage.set("engine_priority", JSON.stringify(migrated));
    } catch {}
  }

  // Migrate identity archetype (old names → new names)
  const IDENTITY_MAP: Record<string, string> = {
    builder: "hustler",
    creator: "showman",
    strategist: "founder",
    operator: "warrior",
    monk: "scholar",
  };
  const identityRaw = storage.getString("app_identity");
  if (identityRaw) {
    try {
      const old = JSON.parse(identityRaw) as string;
      if (IDENTITY_MAP[old]) {
        storage.set("app_identity", JSON.stringify(IDENTITY_MAP[old]));
      }
    } catch {}
  }
  const userIdentityRaw = storage.getString("user_identity");
  if (userIdentityRaw) {
    try {
      const data = JSON.parse(userIdentityRaw) as { archetype: string | null; selectedDate: string | null; totalVotes: number };
      if (data.archetype && IDENTITY_MAP[data.archetype]) {
        data.archetype = IDENTITY_MAP[data.archetype];
        storage.set("user_identity", JSON.stringify(data));
      }
    } catch {}
  }

  storage.set(MIGRATION_KEY, true);
}
