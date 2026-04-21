/**
 * Pure money types and constants. Cloud state comes from useMoney hook.
 */

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
