/**
 * Classify errors thrown by Supabase / network calls so the sync engine
 * knows whether to retry, back off, or bail out. Supabase-js surfaces
 * errors with a mix of shapes (`PostgrestError`, `AuthError`, raw fetch
 * TypeError). We sniff `status`, `code`, `message` to bucket them.
 *
 *   'auth'      — user session is invalid. Bail out; auth layer will
 *                 surface this to the UI (and run recovery if possible).
 *   'transient' — network / 5xx / 429. Retry with backoff.
 *   'conflict'  — 409 (unique violation, etc.). Specific handling;
 *                 usually means the server already has a row from
 *                 another device — we pull and converge.
 *   'fatal'     — 4xx that isn't auth or conflict. Probably a bug in
 *                 our payload. Log, drop the mutation, surface to dev.
 */

export type SyncErrorClass = "auth" | "transient" | "conflict" | "fatal";

interface MaybeErr {
  status?: number | string;
  code?: string;
  message?: string;
  name?: string;
}

export function classifyError(err: unknown): SyncErrorClass {
  if (!err || typeof err !== "object") return "transient";
  const e = err as MaybeErr;

  const status =
    typeof e.status === "number"
      ? e.status
      : typeof e.status === "string"
      ? parseInt(e.status, 10)
      : NaN;

  // Auth: 401, or an AuthError shape
  if (status === 401 || status === 403) return "auth";
  if (
    typeof e.message === "string" &&
    /(jwt|token|unauthorized|not authenticated)/i.test(e.message)
  ) {
    return "auth";
  }
  if (e.name === "AuthApiError" || e.name === "AuthError") return "auth";

  // Conflict: 409, unique violation code from Postgres (23505)
  if (status === 409 || e.code === "23505") return "conflict";

  // Transient: network (TypeError), 429, 5xx
  if (e.name === "TypeError" && /network|failed to fetch/i.test(e.message ?? "")) {
    return "transient";
  }
  if (status === 429) return "transient";
  if (!Number.isNaN(status) && status >= 500) return "transient";

  // Unknown status — treat as transient so we retry rather than drop.
  if (Number.isNaN(status)) return "transient";

  // Everything else (400/404/etc) — treat as fatal for safety (don't
  // retry forever), but the engine logs it so we can fix the payload.
  return "fatal";
}
