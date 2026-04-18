import { all, get, run, transaction } from "../db/sqlite/client";
import { primaryKeyFor, rowIdentifier } from "./tables";
import { backoffMs, isoPlus, MAX_ATTEMPTS } from "./backoff";

// ─── Types ──────────────────────────────────────────────────────────────────

export type MutationOp = "upsert" | "delete";

export interface PendingMutation {
  id: string;
  table_name: string;
  row_id: string;
  op: MutationOp;
  payload: string; // JSON-encoded row (upsert) or { id } for delete
  attempts: number;
  last_error: string | null;
  created_at: string;
  next_attempt: string;
}

/** Parsed payload shape for op='upsert'. */
export type UpsertPayload = Record<string, unknown>;

/** Parsed payload shape for op='delete'. */
export interface DeletePayload {
  /** Primary-key values keyed by column name. */
  pk: Record<string, unknown>;
}

// ─── Mutation ID ───────────────────────────────────────────────────────────

/** Deterministic id so re-enqueueing the same (table, row, op) replaces. */
function mutationId(table: string, rowId: string, op: MutationOp): string {
  return `${table}/${rowId}/${op}`;
}

// ─── Enqueue ────────────────────────────────────────────────────────────────

/**
 * Enqueue an upsert for the given row. Payload stores the full JS-typed
 * row (JSON columns still objects; boolean columns still booleans). Call
 * this AFTER writing the row to SQLite — the service layer's pattern is
 * "write first, enqueue second", both inside a transaction.
 *
 * If a pending DELETE for this (table, row) exists (row being resurrected),
 * clear it so we don't delete the just-resurrected row on next push.
 */
export async function enqueueUpsert(
  table: string,
  row: Record<string, unknown>,
): Promise<void> {
  const rowId = rowIdentifier(table, row);
  const id = mutationId(table, rowId, "upsert");
  const payload = JSON.stringify(row);

  await transaction(async () => {
    // Clobber any pending delete for the same row — resurrection semantics.
    await run(
      `DELETE FROM pending_mutations
       WHERE table_name = ? AND row_id = ? AND op = 'delete'`,
      [table, rowId],
    );
    // Upsert the mutation. INSERT OR REPLACE so re-enqueueing the same
    // row before a push just updates the payload + resets attempts.
    await run(
      `INSERT OR REPLACE INTO pending_mutations
        (id, table_name, row_id, op, payload, attempts, last_error, created_at, next_attempt)
       VALUES (?, ?, ?, 'upsert', ?, 0, NULL, datetime('now'), datetime('now'))`,
      [id, table, rowId, payload],
    );
  });
}

/**
 * Enqueue a delete for a row. The row is ALSO soft-deleted (`_deleted=1`,
 * `_dirty=1`) in its table so readers filtered by `_deleted = 0` stop
 * seeing it instantly. On successful remote delete, push hard-deletes
 * the row locally.
 *
 * If a pending UPSERT for this (table, row) exists, clobber it — the
 * row is going away, there's no point pushing an upsert first.
 */
export async function enqueueDelete(
  table: string,
  pk: Record<string, unknown>,
): Promise<void> {
  const rowId = rowIdentifier(table, pk);
  const id = mutationId(table, rowId, "delete");
  const pkCols = primaryKeyFor(table);
  const payload: DeletePayload = { pk: {} };
  for (const col of pkCols) payload.pk[col] = pk[col];

  await transaction(async () => {
    await run(
      `DELETE FROM pending_mutations
       WHERE table_name = ? AND row_id = ? AND op = 'upsert'`,
      [table, rowId],
    );
    await run(
      `INSERT OR REPLACE INTO pending_mutations
        (id, table_name, row_id, op, payload, attempts, last_error, created_at, next_attempt)
       VALUES (?, ?, ?, 'delete', ?, 0, NULL, datetime('now'), datetime('now'))`,
      [id, table, rowId, JSON.stringify(payload)],
    );
    // Soft-delete locally so the UI stops showing this row immediately.
    const whereClause = pkCols.map((c) => `${c} = ?`).join(" AND ");
    const pkValues = pkCols.map((c) => pk[c]);
    await run(
      `UPDATE ${table} SET _deleted = 1, _dirty = 1 WHERE ${whereClause}`,
      pkValues,
    );
  });
}

// ─── Drain ──────────────────────────────────────────────────────────────────

/**
 * Return up to `limit` mutations that are due (`next_attempt <= now()`),
 * FIFO by `created_at`. The push loop walks this list, attempts each,
 * and calls `markPushed` / `markFailed` accordingly.
 *
 * Mutations whose `attempts` exceeds `MAX_ATTEMPTS` are excluded — they
 * stay in the outbox but don't block progress. The dev sync screen
 * surfaces them so the user can manually reset.
 */
export async function listPending(limit = 20): Promise<PendingMutation[]> {
  return all<PendingMutation>(
    `SELECT * FROM pending_mutations
     WHERE next_attempt <= datetime('now')
       AND attempts < ?
     ORDER BY created_at ASC
     LIMIT ?`,
    [MAX_ATTEMPTS, limit],
  );
}

export async function countPending(): Promise<number> {
  const row = await get<{ c: number }>(
    `SELECT COUNT(*) AS c FROM pending_mutations`,
  );
  return row?.c ?? 0;
}

export async function countStuck(): Promise<number> {
  const row = await get<{ c: number }>(
    `SELECT COUNT(*) AS c FROM pending_mutations WHERE attempts >= ?`,
    [MAX_ATTEMPTS],
  );
  return row?.c ?? 0;
}

// ─── Completion / failure ──────────────────────────────────────────────────

/**
 * Called by push.ts after a successful Supabase round-trip. Removes the
 * mutation from the outbox and clears the row's `_dirty` flag (upsert)
 * or hard-deletes the row (delete).
 */
export async function markPushed(
  mutation: PendingMutation,
): Promise<void> {
  const pkCols = primaryKeyFor(mutation.table_name);
  const whereClause = pkCols.map((c) => `${c} = ?`).join(" AND ");

  await transaction(async () => {
    if (mutation.op === "upsert") {
      const payload = JSON.parse(mutation.payload) as UpsertPayload;
      const pkValues = pkCols.map((c) => payload[c]);
      await run(
        `UPDATE ${mutation.table_name} SET _dirty = 0
         WHERE ${whereClause}`,
        pkValues,
      );
    } else {
      const payload = JSON.parse(mutation.payload) as DeletePayload;
      const pkValues = pkCols.map((c) => payload.pk[c]);
      await run(
        `DELETE FROM ${mutation.table_name} WHERE ${whereClause}`,
        pkValues,
      );
    }
    await run(`DELETE FROM pending_mutations WHERE id = ?`, [mutation.id]);
  });
}

/**
 * Called by push.ts when a mutation failed transiently (network/5xx/429).
 * Bumps attempts, stores the error, reschedules `next_attempt` with
 * exponential backoff.
 */
export async function markFailed(
  mutation: PendingMutation,
  errorMessage: string,
): Promise<void> {
  const nextAttempts = mutation.attempts + 1;
  const delay = backoffMs(nextAttempts);
  await run(
    `UPDATE pending_mutations
     SET attempts = ?, last_error = ?, next_attempt = ?
     WHERE id = ?`,
    [nextAttempts, errorMessage.slice(0, 500), isoPlus(delay), mutation.id],
  );
}

/**
 * Called when a mutation failed with a 'fatal' classification — a 4xx
 * that isn't auth or conflict. The payload is bad; no amount of retry
 * will fix it. Drop the mutation but keep the row's `_dirty` flag so the
 * service layer can re-surface it on the next change. Logs through the
 * normal error-log path (see engine.ts).
 */
export async function dropFatal(mutation: PendingMutation): Promise<void> {
  await run(`DELETE FROM pending_mutations WHERE id = ?`, [mutation.id]);
}

/**
 * Reset a stuck mutation — set attempts back to 0 and clear last_error.
 * Called from the dev sync screen's "Retry" button.
 */
export async function resetMutation(mutationId: string): Promise<void> {
  await run(
    `UPDATE pending_mutations
     SET attempts = 0, last_error = NULL, next_attempt = datetime('now')
     WHERE id = ?`,
    [mutationId],
  );
}

/** Hard-drop a stuck mutation — called from dev sync screen's "Drop". */
export async function deleteMutation(mutationId: string): Promise<void> {
  await run(`DELETE FROM pending_mutations WHERE id = ?`, [mutationId]);
}
