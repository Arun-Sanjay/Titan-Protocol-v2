/**
 * Pure budget helpers. Cloud state comes from useBudgets hook.
 */

export type BudgetStatus = "on_track" | "warning" | "over_budget" | "no_budget";

export function getBudgetStatus(spent: number, limit: number): BudgetStatus {
  if (limit <= 0) return "no_budget";
  const ratio = spent / limit;
  if (ratio >= 1) return "over_budget";
  if (ratio >= 0.8) return "warning";
  return "on_track";
}

export function getBudgetStatusColor(status: BudgetStatus): string {
  switch (status) {
    case "on_track":
      return "#34D399";
    case "warning":
      return "#FBBF24";
    case "over_budget":
      return "#F87171";
    case "no_budget":
    default:
      return "#6B7280";
  }
}

export function getDailyRemaining(
  monthlyBudget: number,
  spent: number,
  dayOfMonth: number,
  daysInMonth: number,
): number {
  const remaining = monthlyBudget - spent;
  const daysLeft = daysInMonth - dayOfMonth + 1;
  return daysLeft > 0 ? remaining / daysLeft : 0;
}
