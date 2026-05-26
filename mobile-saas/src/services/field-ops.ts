import { requireUserId } from "../lib/supabase";
import {
  newId,
  sqliteGet,
  sqliteList,
  cloudUpsert,
  transaction,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";
import type { Json } from "../types/supabase";
import { getFieldOpDef } from "../lib/field-ops";
import { getTodayKey, toLocalDateKey } from "../lib/date";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type FieldOp = Tables<"field_ops">;
export type FieldOpCooldown = Tables<"field_op_cooldown">;

/** 24h cooldown after a failed/abandoned field op. */
const COOLDOWN_DURATION_MS = 24 * 60 * 60 * 1000;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function getActiveFieldOp(): Promise<FieldOp | null> {
  const [row] = await sqliteList<FieldOp>("field_ops", {
    where: "status = ?",
    params: ["active"],
    order: "started_at DESC",
    limit: 1,
  });
  return row ?? null;
}

export async function listFieldOpHistory(): Promise<FieldOp[]> {
  return sqliteList<FieldOp>("field_ops", { order: "started_at DESC" });
}

export async function getFieldOpCooldown(): Promise<FieldOpCooldown | null> {
  const userId = await requireUserId();
  return sqliteGet<FieldOpCooldown>("field_op_cooldown", { user_id: userId });
}

/**
 * Start a field op, atomically.
 *
 * Three correctness guards (none of which existed before):
 *
 *   1. `day_results` initialises as `[] as Json`, not `{}`. The
 *      column holds a boolean array — using `{}` made progress dots
 *      render wrong because `Array.isArray({})` is false.
 *   2. One active op per user — if a row with status='active' exists,
 *      the call no-ops and returns the existing op. Without this guard
 *      a double-tap on the start button (or a stale cache) could
 *      create two simultaneous active ops.
 *   3. Cooldown is honored — if the user is on a post-failure cooldown
 *      window we throw. The UI also disables the buttons, but the
 *      defence-in-depth check prevents a stale cache from sneaking
 *      a start through.
 */
export async function startFieldOp(params: {
  fieldOpId: string;
}): Promise<FieldOp> {
  const userId = await requireUserId();
  return transaction(async () => {
    // Guard 1: any active op already? Return it instead of creating a duplicate.
    const [existingActive] = await sqliteList<FieldOp>("field_ops", {
      where: "status = ?",
      params: ["active"],
      order: "started_at DESC",
      limit: 1,
    });
    if (existingActive) return existingActive;

    // Guard 2: cooldown still in effect?
    const cooldown = await sqliteGet<FieldOpCooldown>(
      "field_op_cooldown",
      { user_id: userId },
    );
    if (cooldown?.cooldown_until) {
      const until = new Date(cooldown.cooldown_until).getTime();
      if (Number.isFinite(until) && until > Date.now()) {
        throw new Error(
          "Field op cooldown is still active. Wait before starting another op.",
        );
      }
    }

    const now = new Date().toISOString();
    const row: FieldOp = {
      id: newId(),
      user_id: userId,
      field_op_id: params.fieldOpId,
      status: "active",
      current_day: 0,
      day_results: [] as unknown as Json,
      started_at: now,
      completed_at: null,
    };
    return cloudUpsert("field_ops", row);
  });
}

/**
 * Mark a field op as completed / failed / abandoned. On a non-completion
 * resolution (failed or abandoned) we ALSO write the field_op_cooldown
 * row so the UI's "no new ops while on cooldown" gate actually holds —
 * before this fix the UI claimed cooldown applied but the row never
 * landed, so users could re-start immediately.
 */
export async function resolveFieldOp(params: {
  id: string;
  status: "completed" | "failed" | "abandoned";
  dayResults?: Json;
}): Promise<void> {
  const userId = await requireUserId();
  await transaction(async () => {
    const existing = await sqliteGet<FieldOp>("field_ops", { id: params.id });
    if (!existing) throw new Error("Field op not found");
    const now = new Date().toISOString();
    const merged: FieldOp = {
      ...existing,
      status: params.status,
      completed_at: now,
      day_results: params.dayResults ?? existing.day_results,
    };
    await cloudUpsert("field_ops", merged);

    if (params.status === "failed" || params.status === "abandoned") {
      await writeCooldown(userId);
    }
  });
}

/**
 * Append today's pass/fail to an active field op and apply the sprint /
 * endurance resolution rules:
 *
 *   sprint    → any FAIL resolves immediately to "failed".
 *   endurance → 2 consecutive FAILs resolve to "failed".
 *   any type  → reaching `def.durationDays` days with the final day
 *               passing resolves to "completed".
 *
 * Atomic via SQLite transaction. Gated to one log per local day on the
 * row's `started_at` / `completed_at` stamp so a tap-storm doesn't burn
 * through a 7-day sprint in 7 taps. On a failed resolution we also
 * write the cooldown row.
 */
export async function recordFieldOpDay(params: {
  id: string;
  passed: boolean;
}): Promise<{
  fieldOp: FieldOp;
  resolved: "completed" | "failed" | null;
  alreadyLoggedToday: boolean;
}> {
  const userId = await requireUserId();
  return transaction(async () => {
    const existing = await sqliteGet<FieldOp>("field_ops", { id: params.id });
    if (!existing) throw new Error("Field op not found");
    if (existing.status !== "active") {
      return {
        fieldOp: existing,
        resolved: null,
        alreadyLoggedToday: true,
      };
    }

    const def = getFieldOpDef(existing.field_op_id);

    const dayResults = Array.isArray(existing.day_results)
      ? [...(existing.day_results as boolean[])]
      : [];

    // One log per local day. Without this the user could drain the whole
    // duration in a single sitting. Use local-date keys (not raw ISO
    // slices) so a user crossing midnight evaluates against today, not
    // UTC's today.
    const today = getTodayKey();
    const lastUpdate = (() => {
      const stamp = existing.completed_at ?? existing.started_at;
      return typeof stamp === "string" ? toLocalDateKey(new Date(stamp)) : null;
    })();
    if (dayResults.length > 0 && lastUpdate === today) {
      return {
        fieldOp: existing,
        resolved: null,
        alreadyLoggedToday: true,
      };
    }

    dayResults.push(params.passed);

    let nextStatus: "active" | "completed" | "failed" = "active";

    if (def?.type === "sprint" && !params.passed) {
      nextStatus = "failed";
    } else if (
      def?.type === "endurance" &&
      dayResults.length >= 2 &&
      !dayResults[dayResults.length - 1] &&
      !dayResults[dayResults.length - 2]
    ) {
      nextStatus = "failed";
    } else if (
      def &&
      dayResults.length >= def.durationDays &&
      params.passed
    ) {
      nextStatus = "completed";
    }

    const now = new Date().toISOString();
    const merged: FieldOp = {
      ...existing,
      day_results: dayResults as unknown as Json,
      current_day: dayResults.length,
      status: nextStatus,
      completed_at: nextStatus === "active" ? null : now,
    };
    const saved = await cloudUpsert("field_ops", merged);

    if (nextStatus === "failed") {
      await writeCooldown(userId);
    }

    return {
      fieldOp: saved,
      resolved: nextStatus === "active" ? null : nextStatus,
      alreadyLoggedToday: false,
    };
  });
}

/** Upsert a 24h cooldown for the current user. */
async function writeCooldown(userId: string): Promise<void> {
  const now = new Date();
  const until = new Date(now.getTime() + COOLDOWN_DURATION_MS);
  const existing = await sqliteGet<FieldOpCooldown>(
    "field_op_cooldown",
    { user_id: userId },
  );
  await cloudUpsert("field_op_cooldown", {
    ...(existing ?? { user_id: userId }),
    user_id: userId,
    cooldown_until: until.toISOString(),
    updated_at: now.toISOString(),
  });
}
