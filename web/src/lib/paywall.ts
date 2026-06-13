/**
 * Paywall bus + PaywallError.
 *
 * After the 1-day free trial expires (and with no active subscription),
 * gated actions — completing a task — throw `PaywallError` from their
 * mutation. The global MutationCache catches it and calls `openPaywall()`
 * instead of showing an error toast; `AccessGate` (mounted in OSLayout)
 * renders the modal. A plain pub/sub bus, mirroring lib/toast + lib/confirm,
 * so non-React code (the toggle mutation) can drive React UI.
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
