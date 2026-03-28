import { create } from "zustand";
import { getJSON, setJSON, nextId } from "../db/storage";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Budget = {
  id: number;
  category: string;
  monthlyLimit: number;
};

export type BudgetStatus = "safe" | "warning" | "danger" | "over";

// ─── MMKV Key ─────────────────────────────────────────────────────────────────

const BUDGETS_KEY = "budgets";

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** Determine budget status based on spent vs limit. */
export function getBudgetStatus(limit: number, spent: number): BudgetStatus {
  if (limit <= 0) return spent > 0 ? "over" : "safe";
  const pct = spent / limit;
  if (pct > 1) return "over";
  if (pct >= 0.9) return "danger";
  if (pct >= 0.7) return "warning";
  return "safe";
}

/** Status color mapping. */
export function getBudgetStatusColor(status: BudgetStatus): string {
  switch (status) {
    case "safe":
      return "#34d399";
    case "warning":
      return "#FBBF24";
    case "danger":
      return "#f87171";
    case "over":
      return "#f87171";
  }
}

/**
 * Calculate remaining daily budget for the rest of the month.
 * monthKey is YYYY-MM format.
 */
export function getDailyRemaining(
  limit: number,
  spent: number,
  monthKey: string,
): number {
  const remaining = limit - spent;
  if (remaining <= 0) return 0;

  const [yearStr, monthStr] = monthKey.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  // Days in this month
  const daysInMonth = new Date(year, month, 0).getDate();

  // Current date info
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  let remainingDays: number;

  if (year === currentYear && month === currentMonth) {
    // Current month: days remaining from today
    const today = now.getDate();
    remainingDays = Math.max(daysInMonth - today + 1, 1);
  } else if (year < currentYear || (year === currentYear && month < currentMonth)) {
    // Past month: budget period is over, no daily remaining
    return 0;
  } else {
    // Future month: full month
    remainingDays = daysInMonth;
  }

  return Math.round((remaining / remainingDays) * 100) / 100;
}

// ─── Store ────────────────────────────────────────────────────────────────────

type BudgetState = {
  budgets: Budget[];

  load: () => void;
  addBudget: (category: string, monthlyLimit: number) => void;
  deleteBudget: (id: number) => void;
  updateBudget: (id: number, monthlyLimit: number) => void;
};

export const useBudgetStore = create<BudgetState>()((set, get) => ({
  budgets: [],

  load: () => {
    const budgets = getJSON<Budget[]>(BUDGETS_KEY, []);
    set({ budgets });
  },

  addBudget: (category, monthlyLimit) => {
    if (get().budgets.some((b) => b.category === category)) return;
    const id = nextId();
    const entry: Budget = { id, category, monthlyLimit };
    const budgets = [...get().budgets, entry];
    setJSON(BUDGETS_KEY, budgets);
    set({ budgets });
  },

  deleteBudget: (id) => {
    const budgets = get().budgets.filter((b) => b.id !== id);
    setJSON(BUDGETS_KEY, budgets);
    set({ budgets });
  },

  updateBudget: (id, monthlyLimit) => {
    const budgets = get().budgets.map((b) =>
      b.id === id ? { ...b, monthlyLimit } : b,
    );
    setJSON(BUDGETS_KEY, budgets);
    set({ budgets });
  },
}));
