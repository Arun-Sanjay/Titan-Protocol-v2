export function formatCurrency(val: number): string {
  if (!Number.isFinite(val)) return "$0.00";
  const abs = Math.abs(val);
  const formatted = "$" + abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return val < 0 ? "-" + formatted : formatted;
}
