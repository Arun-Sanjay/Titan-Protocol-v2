import { create } from "zustand";
import { getJSON, setJSON, nextId } from "../db/storage";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MoneyTx = {
  id: number;
  dateISO: string;
  type: "expense" | "income";
  amount: number;
  category: string;
  bucket: "need" | "want" | null;
  note: string;
};

export type MoneyLoan = {
  id: number;
  lender: string;
  amount: number;
  dateISO: string;
  dueISO: string | null;
  status: "unpaid" | "paid";
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const EXPENSE_CATEGORIES = [
  "Food",
  "Transport",
  "Shopping",
  "Bills",
  "Health",
  "Entertainment",
  "Education",
  "Other",
] as const;

export const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Investment",
  "Gift",
  "Refund",
  "Other",
] as const;

// ─── MMKV Keys ────────────────────────────────────────────────────────────────

const TXS_KEY = "money_txs";
const LOANS_KEY = "money_loans";

// ─── Computed helpers (pure functions, not in store) ──────────────────────────

export function computeDayTotals(
  txs: MoneyTx[],
  dateISO: string
): { spent: number; earned: number; net: number } {
  let spent = 0;
  let earned = 0;
  for (const tx of txs) {
    if (tx.dateISO !== dateISO) continue;
    if (tx.type === "expense") spent += tx.amount;
    else earned += tx.amount;
  }
  return { spent, earned, net: earned - spent };
}

export function computeMonthTotals(
  txs: MoneyTx[],
  monthISO: string
): {
  spent: number;
  earned: number;
  net: number;
  byCategory: Record<string, number>;
} {
  let spent = 0;
  let earned = 0;
  const byCategory: Record<string, number> = {};

  for (const tx of txs) {
    if (!tx.dateISO.startsWith(monthISO)) continue;
    if (tx.type === "expense") {
      spent += tx.amount;
      byCategory[tx.category] = (byCategory[tx.category] ?? 0) + tx.amount;
    } else {
      earned += tx.amount;
    }
  }

  return { spent, earned, net: earned - spent, byCategory };
}

// ─── Store ────────────────────────────────────────────────────────────────────

type MoneyState = {
  transactions: MoneyTx[];
  loans: MoneyLoan[];

  load: () => void;
  addTransaction: (tx: Omit<MoneyTx, "id">) => void;
  deleteTransaction: (id: number) => void;
  addLoan: (loan: Omit<MoneyLoan, "id">) => void;
  deleteLoan: (id: number) => void;
  markLoanPaid: (id: number) => void;
};

export const useMoneyStore = create<MoneyState>()((set, get) => ({
  transactions: [],
  loans: [],

  load: () => {
    const transactions = getJSON<MoneyTx[]>(TXS_KEY, []);
    const loans = getJSON<MoneyLoan[]>(LOANS_KEY, []);
    set({ transactions, loans });
  },

  addTransaction: (tx) => {
    const id = nextId();
    const entry: MoneyTx = { id, ...tx };
    const transactions = [entry, ...get().transactions];
    setJSON(TXS_KEY, transactions);
    set({ transactions });
  },

  deleteTransaction: (id) => {
    const transactions = get().transactions.filter((t) => t.id !== id);
    setJSON(TXS_KEY, transactions);
    set({ transactions });
  },

  addLoan: (loan) => {
    const id = nextId();
    const entry: MoneyLoan = { id, ...loan };
    const loans = [entry, ...get().loans];
    setJSON(LOANS_KEY, loans);
    set({ loans });
  },

  deleteLoan: (id) => {
    const loans = get().loans.filter((l) => l.id !== id);
    setJSON(LOANS_KEY, loans);
    set({ loans });
  },

  markLoanPaid: (id) => {
    const loans = get().loans.map((l) =>
      l.id === id ? { ...l, status: "paid" as const } : l
    );
    setJSON(LOANS_KEY, loans);
    set({ loans });
  },
}));
