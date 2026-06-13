/**
 * Paywall bus + PaywallError.
 *
 * After the 1-day free trial expires (and with no active subscription),
 * gated actions — completing a task — throw `PaywallError` from their
 * mutation. The toggle hook's `onError` catches it and calls
 * `openPaywall()` instead of surfacing an error; `AccessGate` (mounted in
 * the tabs layout) renders the modal. A plain pub/sub bus so non-React
 * code (the toggle mutation) can drive React UI.
 *
 * Mirrors web's `web/src/lib/paywall.ts` verbatim.
 */
export class PaywallError extends Error {
  constructor(message = "PAYWALL") {
    super(message);
    this.name = "PaywallError";
  }
}

type Listener = (open: boolean) => void;
const listeners = new Set<Listener>();
let openState = false;

export function openPaywall(): void {
  openState = true;
  listeners.forEach((l) => l(true));
}

export function closePaywall(): void {
  openState = false;
  listeners.forEach((l) => l(false));
}

export function isPaywallOpen(): boolean {
  return openState;
}

export function subscribePaywall(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
