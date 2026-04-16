import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";

// ─── Types (re-exported via lib/budget-helpers.ts) ──────────────────────────

export type BudgetStatus = "on_track" | "warning" | "over_budget" | "no_budget";

// ─── Pure helpers (re-exported via lib/budget-helpers.ts) ───────────────────

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

// ─── Store ──────────────────────────────────────────────────────────────────

type BudgetEntry = {
  id: number;
  amount: number;
  category: string;
  date: string;
  note?: string;
};

type BudgetState = {
  monthlyBudget: number;
  entries: BudgetEntry[];

  setMonthlyBudget: (amount: number) => void;
  addEntry: (entry: Omit<BudgetEntry, "id">) => void;
  removeEntry: (id: number) => void;
  load: () => void;
};

export const useBudgetStore = create<BudgetState>((set) => ({
  monthlyBudget: getJSON<number>("budget_monthly", 0),
  entries: getJSON<BudgetEntry[]>("budget_entries", []),

  setMonthlyBudget: (amount) => {
    setJSON("budget_monthly", amount);
    set({ monthlyBudget: amount });
  },

  addEntry: (entryData) => {
    set((s) => {
      const id = Date.now();
      const entry: BudgetEntry = { ...entryData, id };
      const entries = [...s.entries, entry];
      setJSON("budget_entries", entries);
      return { entries };
    });
  },

  removeEntry: (id) => {
    set((s) => {
      const entries = s.entries.filter((e) => e.id !== id);
      setJSON("budget_entries", entries);
      return { entries };
    });
  },

  load: () => {
    set({
      monthlyBudget: getJSON<number>("budget_monthly", 0),
      entries: getJSON<BudgetEntry[]>("budget_entries", []),
    });
  },
}));
