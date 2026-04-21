/**
 * Chainable Supabase mock used by push.test.ts and pull.test.ts. It mirrors
 * just enough of the PostgREST JS builder shape that our sync code awaits.
 *
 * Usage:
 *
 *   const fake = makeSupabaseFake();
 *   jest.mock("../../lib/supabase", () => ({ supabase: fake.supabase, ... }));
 *   fake.state.setSelectData("tasks", [row1, row2]);
 *   const res = await pushBatch();
 *   expect(fake.state.calls).toContainEqual(expect.objectContaining({ method: "upsert", table: "tasks" }));
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SupabaseCall {
  method: "select" | "upsert" | "delete";
  table: string;
  /** For upsert: the payload and onConflict option. */
  upsert?: { payload: Record<string, unknown>; onConflict?: string };
  /** For select: captured cursor/order/limit. */
  select?: {
    cursorCol?: string;
    cursorVal?: unknown;
    orderCol?: string;
    orderAsc?: boolean;
    limit?: number;
  };
  /** For delete: list of [col, val] eq conditions. */
  delete?: { conditions: Array<[string, unknown]> };
}

export interface SupabaseFakeState {
  calls: SupabaseCall[];
  /** Return this for `supabase.from(table).upsert(...)`. */
  setUpsertError(table: string, error: unknown | null): void;
  /** Return this for `.from(table).delete()...`. */
  setDeleteError(table: string, error: unknown | null): void;
  /** Return this data for `.from(table).select(...)...`. */
  setSelectData(table: string, data: unknown[]): void;
  setSelectError(table: string, error: unknown | null): void;
  /** Clear calls and results. */
  reset(): void;
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function makeSupabaseFake(): {
  supabase: { from: (table: string) => unknown };
  state: SupabaseFakeState;
} {
  const upsertErrors = new Map<string, unknown | null>();
  const deleteErrors = new Map<string, unknown | null>();
  const selectData = new Map<string, unknown[]>();
  const selectErrors = new Map<string, unknown | null>();
  const calls: SupabaseCall[] = [];

  function from(table: string) {
    return {
      upsert(payload: Record<string, unknown>, options?: { onConflict?: string }) {
        calls.push({
          method: "upsert",
          table,
          upsert: { payload, onConflict: options?.onConflict },
        });
        return Promise.resolve({ error: upsertErrors.get(table) ?? null });
      },

      delete() {
        const conditions: Array<[string, unknown]> = [];
        const q = {
          eq(col: string, val: unknown) {
            conditions.push([col, val]);
            return q;
          },
          then<TResult1 = unknown, TResult2 = never>(
            onResolve?: (value: { error: unknown | null }) => TResult1 | PromiseLike<TResult1>,
            onReject?: (reason: unknown) => TResult2 | PromiseLike<TResult2>,
          ): Promise<TResult1 | TResult2> {
            calls.push({
              method: "delete",
              table,
              delete: { conditions },
            });
            const error = deleteErrors.get(table) ?? null;
            return Promise.resolve({ error }).then(onResolve, onReject);
          },
        };
        return q;
      },

      select() {
        const captured: NonNullable<SupabaseCall["select"]> = {};
        const q = {
          gt(col: string, val: unknown) {
            captured.cursorCol = col;
            captured.cursorVal = val;
            return q;
          },
          order(col: string, opts?: { ascending?: boolean }) {
            captured.orderCol = col;
            captured.orderAsc = opts?.ascending ?? true;
            return q;
          },
          limit(n: number) {
            captured.limit = n;
            return q;
          },
          then<TResult1 = unknown, TResult2 = never>(
            onResolve?: (value: { data: unknown[] | null; error: unknown | null }) => TResult1 | PromiseLike<TResult1>,
            onReject?: (reason: unknown) => TResult2 | PromiseLike<TResult2>,
          ): Promise<TResult1 | TResult2> {
            calls.push({ method: "select", table, select: { ...captured } });
            const error = selectErrors.get(table) ?? null;
            const data = error ? null : selectData.get(table) ?? [];
            return Promise.resolve({ data, error }).then(onResolve, onReject);
          },
        };
        return q;
      },
    };
  }

  const state: SupabaseFakeState = {
    calls,
    setUpsertError(table, error) {
      upsertErrors.set(table, error);
    },
    setDeleteError(table, error) {
      deleteErrors.set(table, error);
    },
    setSelectData(table, data) {
      selectData.set(table, data);
      selectErrors.delete(table);
    },
    setSelectError(table, error) {
      selectErrors.set(table, error);
    },
    reset() {
      upsertErrors.clear();
      deleteErrors.clear();
      selectData.clear();
      selectErrors.clear();
      calls.length = 0;
    },
  };

  return { supabase: { from }, state };
}
