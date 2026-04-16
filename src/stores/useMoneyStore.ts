import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";

// ─── Types (re-exported via lib/money-helpers.ts) ───────────────────────────

export type MoneyLoan = {
  id: number;
  lender: string;
  amount: number;
  paid: number;
  dateISO: string;
  dueISO: string | null;
  status: "unpaid" | "paid";
  name?: string;
  interestRate?: number;
  monthlyPayment?: number;
  startDate?: string;
};

export type CategoryTotal = {
  category: string;
  total: number;
  percentage: number;
  icon: string;
  color: string;
};

// ─── Constants (re-exported via lib/money-helpers.ts) ───────────────────────

export const EXPENSE_CATEGORIES = [
  "food",
  "transport",
  "entertainment",
  "shopping",
  "bills",
  "health",
  "education",
  "subscriptions",
  "other",
] as const;

export const INCOME_CATEGORIES = [
  "salary",
  "freelance",
  "investment",
  "gift",
  "refund",
  "other",
] as const;

export const CATEGORY_ICONS: Record<string, string> = {
  food: "restaurant",
  transport: "car",
  entertainment: "game-controller",
  shopping: "bag",
  bills: "receipt",
  health: "medkit",
  education: "book",
  subscriptions: "repeat",
  salary: "cash",
  freelance: "briefcase",
  investment: "trending-up",
  gift: "gift",
  refund: "arrow-undo",
  other: "ellipsis-horizontal",
};

export const CATEGORY_COLORS: Record<string, string> = {
  food: "#F87171",
  transport: "#60A5FA",
  entertainment: "#A78BFA",
  shopping: "#FBBF24",
  bills: "#6B7280",
  health: "#34D399",
  education: "#818CF8",
  subscriptions: "#F472B6",
  salary: "#34D399",
  freelance: "#60A5FA",
  investment: "#FBBF24",
  gift: "#F472B6",
  refund: "#6B7280",
  other: "#9CA3AF",
};

// ─── Store ──────────────────────────────────────────────────────────────────

type MoneyTransaction = {
  id: number;
  amount: number;
  category: string;
  type: "income" | "expense";
  date: string;
  note?: string;
};

type MoneyState = {
  transactions: MoneyTransaction[];
  loans: MoneyLoan[];

  addTransaction: (tx: Omit<MoneyTransaction, "id">) => void;
  removeTransaction: (id: number) => void;
  addLoan: (loan: Omit<MoneyLoan, "id">) => void;
  removeLoan: (id: number) => void;
  load: () => void;
};

export const useMoneyStore = create<MoneyState>((set) => ({
  transactions: getJSON<MoneyTransaction[]>("money_transactions", []),
  loans: getJSON<MoneyLoan[]>("money_loans", []),

  addTransaction: (txData) => {
    set((s) => {
      const id = Date.now();
      const tx: MoneyTransaction = { ...txData, id };
      const transactions = [...s.transactions, tx];
      setJSON("money_transactions", transactions);
      return { transactions };
    });
  },

  removeTransaction: (id) => {
    set((s) => {
      const transactions = s.transactions.filter((t) => t.id !== id);
      setJSON("money_transactions", transactions);
      return { transactions };
    });
  },

  addLoan: (loanData) => {
    set((s) => {
      const id = Date.now();
      const loan: MoneyLoan = { ...loanData, id };
      const loans = [...s.loans, loan];
      setJSON("money_loans", loans);
      return { loans };
    });
  },

  removeLoan: (id) => {
    set((s) => {
      const loans = s.loans.filter((l) => l.id !== id);
      setJSON("money_loans", loans);
      return { loans };
    });
  },

  load: () => {
    set({
      transactions: getJSON<MoneyTransaction[]>("money_transactions", []),
      loans: getJSON<MoneyLoan[]>("money_loans", []),
    });
  },
}));
