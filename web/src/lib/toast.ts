/**
 * Minimal, framework-agnostic toast bus.
 *
 * Web had NO error surfacing — 38 mutation onErrors rolled back silently and
 * the journal showed "Saved" before the write resolved (audit §5.2). This is
 * a tiny module-level pub/sub so:
 *   - the QueryClient's MutationCache can `toast.error(...)` on ANY failed
 *     mutation from one place (see `lib/query.ts`), and
 *   - the `<Toaster />` component (mounted in OSLayout) can render the stack.
 *
 * Deliberately not a React context: callers (the QueryClient, services,
 * imperative flows) fire toasts without a hook, and the Toaster subscribes.
 */

export type ToastKind = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  action?: ToastAction;
  /** ms before auto-dismiss; 0 = sticky until dismissed. */
  duration: number;
}

export interface ToastOptions {
  action?: ToastAction;
  /** Override the default auto-dismiss (4s info/success, 6s error). 0 = sticky. */
  duration?: number;
}

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
const listeners = new Set<Listener>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
let counter = 0;

function emit(): void {
  for (const l of listeners) l(toasts);
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => {
    listeners.delete(listener);
  };
}

export function dismissToast(id: string): void {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  const next = toasts.filter((t) => t.id !== id);
  if (next.length !== toasts.length) {
    toasts = next;
    emit();
  }
}

function push(kind: ToastKind, message: string, opts?: ToastOptions): string {
  const id = `toast-${++counter}`;
  const duration = opts?.duration ?? (kind === "error" ? 6000 : 4000);
  // Cap the visible stack so a burst (e.g. offline write storm) can't bury
  // the screen — drop the oldest beyond 4.
  toasts = [...toasts, { id, kind, message, action: opts?.action, duration }].slice(-4);
  emit();
  if (duration > 0) {
    timers.set(
      id,
      setTimeout(() => dismissToast(id), duration),
    );
  }
  return id;
}

export const toast = {
  success: (message: string, opts?: ToastOptions) => push("success", message, opts),
  error: (message: string, opts?: ToastOptions) => push("error", message, opts),
  info: (message: string, opts?: ToastOptions) => push("info", message, opts),
};

/**
 * Turn a raw thrown error into a user-facing message. Cloud-write failures
 * (`[cloud:table] …` from `cloudUpsert`) are reassuring rather than alarming:
 * the row was mirrored locally with `_dirty=1` and the dirty-row replay will
 * push it when connectivity returns, so nothing is lost.
 */
export function messageFromError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (/\[cloud:/.test(raw)) {
    return "Saved on this device — couldn't reach the cloud yet. It'll sync automatically.";
  }
  return raw && raw.length < 140 ? raw : "Something went wrong. Please try again.";
}
