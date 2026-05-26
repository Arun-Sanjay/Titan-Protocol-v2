import { requireUserId } from "../lib/supabase";
import {
  newId,
  sqliteList,
  cloudUpsert,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";
import type { Json } from "../types/supabase";

export type ProtocolSession = Tables<"protocol_sessions">;

/**
 * Result shape that callers use to decide whether to award XP / advance
 * other side effects. `alreadyCompleted = true` means the row's
 * morning_completed_at (or evening_completed_at) was already set, and
 * this call left it untouched — the caller MUST NOT award XP again.
 */
export type SaveSessionResult = {
  session: ProtocolSession;
  alreadyCompleted: boolean;
};

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
 *
 * Idempotent: if `morning_completed_at` is already set, returns the
 * existing row with `alreadyCompleted = true` and does NOT touch
 * `morning_intention` or `morning_completed_at`. Without this guard a
 * second call (manual deep-link, back-stack replay, double-tap) would
 * stomp the original intention and the caller would award XP twice.
 */
export async function saveMorningSession(params: {
  dateKey: string;
  intention: string;
}): Promise<SaveSessionResult> {
  const userId = await requireUserId();
  const now = new Date().toISOString();
  const existing = await findByDate(params.dateKey);

  if (existing?.morning_completed_at) {
    return { session: existing, alreadyCompleted: true };
  }

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
  const saved = await cloudUpsert("protocol_sessions", merged);
  return { session: saved, alreadyCompleted: false };
}

/**
 * Save the evening protocol session.
 *
 * Idempotent on `evening_completed_at`. Same rationale as
 * `saveMorningSession` — duplicate evening saves were the primary
 * XP-farming vector reported in the bug report.
 */
export async function saveEveningSession(params: {
  dateKey: string;
  reflection: string;
  titanScore?: number;
  identityVote?: string | null;
  habitChecks?: Json;
}): Promise<SaveSessionResult> {
  const userId = await requireUserId();
  const now = new Date().toISOString();
  const existing = await findByDate(params.dateKey);

  if (existing?.evening_completed_at) {
    return { session: existing, alreadyCompleted: true };
  }

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
  const saved = await cloudUpsert("protocol_sessions", merged);
  return { session: saved, alreadyCompleted: false };
}

async function findByDate(dateKey: string): Promise<ProtocolSession | null> {
  const [row] = await sqliteList<ProtocolSession>("protocol_sessions", {
    where: "date_key = ?",
    params: [dateKey],
    limit: 1,
  });
  return row ?? null;
}
