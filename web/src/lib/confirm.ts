/**
 * Promise-based confirm dialog bus. `await confirm({...})` resolves true/false
 * once the user picks. Lets any flow guard a destructive action without
 * threading modal state through props (audit §5.4 — web deletes were instant
 * + silent, hard-deleting completion history). The `<ConfirmHost />` in
 * OSLayout renders the active dialog.
 */
export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as destructive (red). */
  destructive?: boolean;
}

export interface ConfirmState extends ConfirmOptions {
  id: number;
  resolve: (value: boolean) => void;
}

let current: ConfirmState | null = null;
const listeners = new Set<(s: ConfirmState | null) => void>();
let counter = 0;

function emit(): void {
  for (const l of listeners) l(current);
}

export function subscribeConfirm(listener: (s: ConfirmState | null) => void): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

export function confirm(opts: ConfirmOptions): Promise<boolean> {
  // If a dialog is somehow already open, resolve it false before replacing.
  if (current) current.resolve(false);
  return new Promise<boolean>((resolve) => {
    current = { ...opts, id: ++counter, resolve };
    emit();
  });
}

export function resolveConfirm(value: boolean): void {
  if (!current) return;
  current.resolve(value);
  current = null;
  emit();
}
