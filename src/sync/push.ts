import { supabase } from "../lib/supabase";
import { logError } from "../lib/error-log";
import { stripSyncColumns } from "../db/sqlite/coerce";
import { classifyError } from "./errors";
import { primaryKeyFor } from "./tables";
import {
  dropFatal,
  listPending,
  markFailed,
  markPushed,
  type DeletePayload,
  type PendingMutation,
  type UpsertPayload,
} from "./outbox";

export interface PushResult {
  pushed: number;
  failed: number;
  /** Reason the push loop stopped BEFORE draining everything due. */
  stopReason: "empty" | "auth" | "batch_done";
}

// ─── Single mutation push ──────────────────────────────────────────────────

async function pushUpsert(m: PendingMutation): Promise<void> {
  const row = JSON.parse(m.payload) as UpsertPayload;
  const cleaned = stripSyncColumns(row);
  const pkCols = primaryKeyFor(m.table_name);

  const { error } = await supabase
    .from(m.table_name)
    .upsert(cleaned as never, {
      onConflict: pkCols.join(","),
    });
  if (error) throw error;
}

async function pushDelete(m: PendingMutation): Promise<void> {
  const payload = JSON.parse(m.payload) as DeletePayload;
  let q = supabase.from(m.table_name).delete();
  for (const [col, val] of Object.entries(payload.pk)) {
    q = q.eq(col, val as never);
  }
  const { error } = await q;
  if (error) throw error;
}

// ─── Batch push ────────────────────────────────────────────────────────────

/**
 * Drain up to one batch of pending mutations. The engine loops this until
 * it returns `stopReason: 'empty'` or hits an auth error. Batches keep
 * each push cycle bounded — if the outbox has 1000 mutations we push 20
 * per cycle, yielding between to let UI work run.
 *
 * Classification:
 *   'auth'      → return immediately with stopReason='auth'. Auth layer handles.
 *   'transient' → mark failed, backoff, continue batch.
 *   'conflict'  → same as transient (next pull converges).
 *   'fatal'     → drop mutation, log, continue batch.
 */
export async function pushBatch(limit = 20): Promise<PushResult> {
  const batch = await listPending(limit);
  if (batch.length === 0) {
    return { pushed: 0, failed: 0, stopReason: "empty" };
  }

  let pushed = 0;
  let failed = 0;

  for (const m of batch) {
    try {
      if (m.op === "upsert") {
        await pushUpsert(m);
      } else {
        await pushDelete(m);
      }
      await markPushed(m);
      pushed++;
    } catch (err) {
      const cls = classifyError(err);
      if (cls === "auth") {
        logError("sync.push.auth", err, { table: m.table_name, op: m.op });
        return { pushed, failed, stopReason: "auth" };
      }
      if (cls === "fatal") {
        logError("sync.push.fatal", err, {
          table: m.table_name,
          op: m.op,
          mutationId: m.id,
        });
        await dropFatal(m);
        failed++;
        continue;
      }
      // transient / conflict — reschedule with backoff.
      const msg = extractMessage(err);
      await markFailed(m, msg);
      failed++;
    }
  }

  return { pushed, failed, stopReason: "batch_done" };
}

/**
 * Drain the outbox until it's empty (or we hit an auth error). Called
 * from the sync engine's syncNow(). Bounded by a safety cap of 50
 * batches (= 1000 mutations per syncNow) so a corrupted outbox can't
 * wedge the UI.
 */
export async function pushAll(): Promise<PushResult> {
  const MAX_BATCHES = 50;
  let totalPushed = 0;
  let totalFailed = 0;
  for (let i = 0; i < MAX_BATCHES; i++) {
    const res = await pushBatch(20);
    totalPushed += res.pushed;
    totalFailed += res.failed;
    if (res.stopReason === "empty") {
      return { pushed: totalPushed, failed: totalFailed, stopReason: "empty" };
    }
    if (res.stopReason === "auth") {
      return { pushed: totalPushed, failed: totalFailed, stopReason: "auth" };
    }
  }
  return { pushed: totalPushed, failed: totalFailed, stopReason: "batch_done" };
}

function extractMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return String(err ?? "unknown");
}
