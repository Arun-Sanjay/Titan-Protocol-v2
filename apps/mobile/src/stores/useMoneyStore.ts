import { create } from "zustand";
import { getJSON, setJSON, nextId } from "../db/storage";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MoneyTx = {
  id: number;
  dateISO: string;
  type: "expense" | "income";
  amount: number;
  category: string;
  note: string;
};

export type MoneyLoan = {
  id: number;
  lender: string;
  amount: number;
  paid: number;
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

export const CATEGORY_ICONS: Record<string, string> = {
  Food: "fast-food-outline",
  Transport: "car-outline",
  Shopping: "bag-outline",
  Bills: "receipt-outline",
  Health: "heart-outline",
  Entertainment: "game-controller-outline",
  Education: "school-outline",
  Other: "ellipsis-horizontal-circle-outline",
  Salary: "cash-outline",
  Freelance: "laptop-outline",
  Investment: "trending-up-outline",
  Gift: "gift-outline",
  Refund: "arrow-undo-outline",
};

export const CATEGORY_COLORS: Record<string, string> = {
  Food: "#f97316",
  Transport: "#3b82f6",
  Shopping: "#ec4899",
  Bills: "#8b5cf6",
  Health: "#ef4444",
  Entertainment: "#06b6d4",
  Education: "#14b8a6",
  Other: "#6b7280",
  Salary: "#34d399",
  Freelance: "#60a5fa",
  Investment: "#fbbf24",
  Gift: "#f472b6",
  Refund: "#a78bfa",
};

// ─── MMKV Keys ────────────────────────────────────────────────────────────────

const TXS_KEY = "money_txs";
const LOANS_KEY = "money_loans";

// ─── Pure helper: round to 2 decimal places ──────────────────────────────────

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Computed helpers (pure functions, not in store) ──────────────────────────

export function computeMonthTotals(
  txs: MoneyTx[],
  monthKey: string,
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
    if (!tx.dateISO.startsWith(monthKey)) continue;
    if (tx.type === "expense") {
      spent += tx.amount;
      byCategory[tx.category] = (byCategory[tx.category] ?? 0) + tx.amount;
    } else {
      earned += tx.amount;
    }
  }

  for (const key of Object.keys(byCategory)) {
    byCategory[key] = r2(byCategory[key]);
  }

  return { spent: r2(spent), earned: r2(earned), net: r2(earned - spent), byCategory };
}

/** Filter transactions by month key (YYYY-MM). */
export function getMonthTransactions(txs: MoneyTx[], monthKey: string): MoneyTx[] {
  return txs.filter((tx) => tx.dateISO.startsWith(monthKey));
}

/** Category totals sorted descending with percentages. */
export type CategoryTotal = {
  category: string;
  total: number;
  percentage: number;
  icon: string;
  color: string;
};

export function getCategoryTotals(txs: MoneyTx[], monthKey: string): CategoryTotal[] {
  const totals = computeMonthTotals(txs, monthKey);
  const entries = Object.entries(totals.byCategory).sort(([, a], [, b]) => b - a);
  const totalSpent = totals.spent || 1; // avoid divide by zero

  return entries.map(([category, total]) => ({
    category,
    total,
    percentage: r2((total / totalSpent) * 100),
    icon: CATEGORY_ICONS[category] ?? "ellipsis-horizontal-circle-outline",
    color: CATEGORY_COLORS[category] ?? "#6b7280",
  }));
}

/** Compare current month to previous month. */
export type MonthComparison = {
  earned: number;
  spent: number;
  net: number;
  prevEarned: number;
  prevSpent: number;
  prevNet: number;
  earnedDelta: number;
  spentDelta: number;
  netDelta: number;
};

export function getMonthComparison(txs: MoneyTx[], monthKey: string): MonthComparison {
  const current = computeMonthTotals(txs, monthKey);

  // Compute previous month key
  const [yearStr, monthStr] = monthKey.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevKey = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

  const prev = computeMonthTotals(txs, prevKey);

  return {
    earned: current.earned,
    spent: current.spent,
    net: current.net,
    prevEarned: prev.earned,
    prevSpent: prev.spent,
    prevNet: prev.net,
    earnedDelta: prev.earned > 0 ? r2(((current.earned - prev.earned) / prev.earned) * 100) : 0,
    spentDelta: prev.spent > 0 ? r2(((current.spent - prev.spent) / prev.spent) * 100) : 0,
    netDelta: prev.net !== 0 ? r2(((current.net - prev.net) / Math.abs(prev.net)) * 100) : 0,
  };
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
  addLoanPayment: (id: number, payment: number) => void;
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
    const entry: MoneyTx = {
      id,
      ...tx,
      amount: r2(tx.amount),
    };
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
    const entry: MoneyLoan = { id, ...loan, paid: loan.paid ?? 0 };
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
      l.id === id ? { ...l, status: "paid" as const, paid: l.amount } : l,
    );
    setJSON(LOANS_KEY, loans);
    set({ loans });
  },

  addLoanPayment: (id, payment) => {
    if (!Number.isFinite(payment) || payment <= 0) return;
    const loans = get().loans.map((l) => {
      if (l.id !== id) return l;
      const newPaid = r2(Math.min(l.paid + payment, l.amount));
      const newStatus = newPaid >= l.amount ? ("paid" as const) : l.status;
      return { ...l, paid: newPaid, status: newStatus };
    });
    setJSON(LOANS_KEY, loans);
    set({ loans });
  },
}));
