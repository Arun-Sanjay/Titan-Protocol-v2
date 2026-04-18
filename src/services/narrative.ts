import { requireUserId } from "../lib/supabase";
import {
  newId,
  sqliteList,
  sqliteUpsert,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";

export type NarrativeLogEntry = Tables<"narrative_log">;

export async function addNarrativeLogEntry(entry: {
  date_key: string;
  text: string;
  type: string;
}): Promise<void> {
  const userId = await requireUserId();
  const row: NarrativeLogEntry = {
    id: newId(),
    user_id: userId,
    date_key: entry.date_key,
    text: entry.text,
    type: entry.type,
    created_at: new Date().toISOString(),
  };
  await sqliteUpsert("narrative_log", row);
}

export async function listNarrativeLog(limit = 100): Promise<NarrativeLogEntry[]> {
  return sqliteList<NarrativeLogEntry>("narrative_log", {
    order: "created_at DESC",
    limit,
  });
}
