/**
 * Phase 4.1: Re-export pure money constants/types so screens can import
 * them without pulling in the Zustand store file.
 */

export {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  CATEGORY_ICONS,
  CATEGORY_COLORS,
  type MoneyLoan,
  type CategoryTotal,
} from "../stores/useMoneyStore";
