import { create } from "zustand";
import { getJSON, setJSON, nextId } from "../db/storage";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Budget = {
  id: number;
  category: string;
  monthlyLimit: number;
};

// ─── MMKV Key ─────────────────────────────────────────────────────────────────

const BUDGETS_KEY = "budgets";

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
      b.id === id ? { ...b, monthlyLimit } : b
    );
    setJSON(BUDGETS_KEY, budgets);
    set({ budgets });
  },
}));
