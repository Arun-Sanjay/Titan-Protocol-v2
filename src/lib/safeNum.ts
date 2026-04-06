/**
 * Guard against NaN/Infinity propagating to UI or storage.
 * Math.min() and Math.max() do NOT filter NaN — they propagate it.
 * Use this at component prop boundaries and before storage writes.
 */
export function safeNum(value: number, fallback: number = 0): number {
  return Number.isFinite(value) ? value : fallback;
}
