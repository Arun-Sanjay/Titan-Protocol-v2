import { requireUserId } from "../lib/supabase";
import {
  newId,
  sqliteGet,
  sqliteList,
  sqliteUpsert,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";
import type { Json } from "../types/supabase";

export type ProtocolSession = Tables<"protocol_sessions">;

/**
 * Get the protocol session for a specific date.
 * Returns null if no session exists yet.
 */
export async function getProtocolSession(
  dateKey: string,
): Promise<ProtocolSession | null> {
  const [existing] = await sqliteList<ProtocolSession>("protocol_sessions", {
    where: "date_key = ?",
    params: [dateKey],
    limit: 1,
  });
  return existing ?? null;
}

/**
 * Save the morning protocol session.
 * Upserts on (user_id, date_key) — safe to call multiple times.
 */
export async function saveMorningSession(params: {
  dateKey: string;
  intention: string;
}): Promise<ProtocolSession> {
  const userId = await requireUserId();
  const now = new Date().toISOString();
  const existing = await findByDate(params.dateKey);

  const base: ProtocolSession = existing ?? {
    id: newId(),
    user_id: userId,
    date_key: params.dateKey,
    morning_intention: null,
    morning_completed_at: null,
    evening_reflection: null,
    evening_completed_at: null,
    titan_score: null,
    identity_at_completion: null,
    habit_checks: {} as Json,
    created_at: now,
    updated_at: now,
  };

  const merged: ProtocolSession = {
    ...base,
    morning_intention: params.intention,
    morning_completed_at: now,
  };
  return sqliteUpsert("protocol_sessions", merged);
}

/**
 * Save the evening protocol session.
 * Merges into the existing row for today (morning must have been saved first,
 * but upsert handles the edge case where it wasn't).
 */
export async function saveEveningSession(params: {
  dateKey: string;
  reflection: string;
  titanScore?: number;
  identityVote?: string | null;
  habitChecks?: Json;
}): Promise<ProtocolSession> {
  const userId = await requireUserId();
  const now = new Date().toISOString();
  const existing = await findByDate(params.dateKey);

  const base: ProtocolSession = existing ?? {
    id: newId(),
    user_id: userId,
    date_key: params.dateKey,
    morning_intention: null,
    morning_completed_at: null,
    evening_reflection: null,
    evening_completed_at: null,
    titan_score: null,
    identity_at_completion: null,
    habit_checks: {} as Json,
    created_at: now,
    updated_at: now,
  };

  const merged: ProtocolSession = {
    ...base,
    evening_reflection: params.reflection,
    evening_completed_at: now,
    ...(params.titanScore !== undefined && { titan_score: params.titanScore }),
    ...(params.identityVote !== undefined && {
      identity_at_completion:
        params.identityVote as ProtocolSession["identity_at_completion"],
    }),
    ...(params.habitChecks !== undefined && { habit_checks: params.habitChecks }),
  };
  return sqliteUpsert("protocol_sessions", merged);
}

async function findByDate(dateKey: string): Promise<ProtocolSession | null> {
  const [row] = await sqliteList<ProtocolSession>("protocol_sessions", {
    where: "date_key = ?",
    params: [dateKey],
    limit: 1,
  });
  return row ?? null;
}
