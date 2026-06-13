import * as React from "react";
import {
  useBudgets,
  useCreateBudget,
  useDeleteBudget,
} from "@/hooks/queries/useBudgets";
import { useTransactions } from "@/hooks/queries/useMoney";
import { monthBounds, todayISO } from "@/lib/date";
import { formatMoney, type MoneyCurrency } from "@/lib/money_format";

const CATEGORY_SUGGESTIONS = ["Food", "Transport", "Rent", "Groceries", "Utilities", "Health", "Education", "Bills", "Entertainment", "Dining Out", "Shopping", "Travel", "Gaming", "Other"];

export default function BudgetsPage() {
  const { data: budgets } = useBudgets();
  const { data: allTx } = useTransactions();
  const createBudget = useCreateBudget();
  const deleteBudgetMut = useDeleteBudget();
  // Match the currency the Finance Tracker uses (audit §5.9 — budgets used to
  // hardcode "$"). Stored device-locally by MoneyExpenseClient.
  const [currency] = React.useState<MoneyCurrency>(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("money.currency") : null;
    return (stored as MoneyCurrency) ?? "USD";
  });

  // Compute spending from transactions
  const spending = React.useMemo(() => {
    if (!budgets || !allTx) return [];
    const today = todayISO();
    const { start, end } = monthBounds(today);
    const monthExpenses = (allTx as any[]).filter((tx) => tx.type === "expense" && (tx.date_iso ?? tx.dateISO) >= start && (tx.date_iso ?? tx.dateISO) < end);

    return budgets.map((b: any) => {
      const spent = monthExpenses
        .filter((tx: any) => tx.category === b.category)
        .reduce((sum: number, tx: any) => sum + tx.amount, 0);
      const percent = b.monthly_limit > 0 ? Math.round((spent / b.monthly_limit) * 100) : 0;
      return { budget: b, spent, percent, remaining: Math.max(0, b.monthly_limit - spent) };
    });
  }, [budgets, allTx]);

  const [showModal, setShowModal] = React.useState(false);
  const [newCategory, setNewCategory] = React.useState("");
  const [newLimit, setNewLimit] = React.useState("");

  async function handleAdd() {
    const cat = newCategory.trim();
    const limit = Number(newLimit);
    if (!cat || !Number.isFinite(limit) || limit <= 0) return;
    createBudget.mutate({ category: cat, monthly_limit: limit } as any);
    setNewCategory(""); setNewLimit(""); setShowModal(false);
  }

  function barColor(percent: number): string {
    if (percent >= 100) return "#ef4444";
    if (percent >= 80) return "#f97316";
    if (percent >= 60) return "#eab308";
    return "#34d399";
  }

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      <header>
        <p className="tp-kicker">Money Engine</p>
        <h1 className="tp-title">Budgets</h1>
        <p className="tp-subtitle mt-1">Set monthly spending limits per category.</p>
      </header>

      <section className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <p className="tp-kicker">Budget Categories</p>
          <button type="button" onClick={() => setShowModal(true)} className="tp-button tp-button-inline">+ Add Budget</button>
        </div>

        {spending.length === 0 ? (
          <div className="body-empty">No budgets set. Add categories to start tracking.</div>
        ) : (
          <div className="grid gap-3">
            {spending.map((item: any) => (
              <div key={item.budget.id} className="tp-panel p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-white/90">{item.budget.category}</p>
                      <p className="text-xs text-white/50">{formatMoney(item.spent, currency)} / {formatMoney(item.budget.monthly_limit ?? 0, currency)}</p>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded bg-white/5">
                      <div className="h-full transition-all duration-300" style={{ width: `${Math.min(100, item.percent)}%`, backgroundColor: barColor(item.percent) }} />
                    </div>
                  </div>
                  <button type="button" onClick={() => deleteBudgetMut.mutate(item.budget.id)} className="text-white/30 hover:text-red-400 text-xs transition-colors" title="Delete budget">X</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showModal && (
        <div className="body-modal" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="body-modal-panel">
            <p className="tp-kicker mb-1">New Budget</p>
            <div className="space-y-4">
              <div><label className="body-label">Category</label><input type="text" className="body-input" placeholder="e.g. Food" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} list="budget-categories" autoFocus /><datalist id="budget-categories">{CATEGORY_SUGGESTIONS.map((c) => (<option key={c} value={c} />))}</datalist></div>
              <div><label className="body-label">Monthly Limit</label><input type="number" className="body-input" placeholder="500" min={1} value={newLimit} onChange={(e) => setNewLimit(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }} /></div>
            </div>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={handleAdd} className="tp-button inline-flex w-auto px-5" disabled={!newCategory.trim() || !newLimit}>Add Budget</button>
              <button type="button" onClick={() => setShowModal(false)} className="tp-button tp-button-inline inline-flex w-auto px-5">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
