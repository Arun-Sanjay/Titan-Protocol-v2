import * as React from "react";
import { Link, useLocation } from "react-router-dom";

import {
  useTransactions,
  useCreateTransaction,
  useDeleteTransaction,
} from "@/hooks/queries/useMoney";
import { ThreeMonthCalendar } from "../../../../components/calendar/ThreeMonthCalendar";
import { assertDateISO, monthBounds, todayISO } from "../../../../lib/date";
import { formatMoney, type MoneyCurrency } from "../../../../lib/money_format";

type ModalType = "expense" | "income" | "borrowed" | "repayment" | null;

const NEED_CATEGORIES = ["Food", "Transport", "Rent", "Groceries", "Utilities", "Health", "Education", "Bills", "Family", "Other Need"];
const WANT_CATEGORIES = ["Entertainment", "Dining Out", "Shopping", "Travel", "Dating/Social", "Gaming", "Luxury/Style", "Gadgets", "Other Want"];
const INCOME_CATEGORIES = ["Salary", "Borrowed", "Other Income"];

type TxDraft = {
  type: "expense" | "income" | "borrowed" | "repayment";
  amount: string;
  dateISO: string;
  category: string;
  bucket: "need" | "want";
  note: string;
};

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

const EMPTY_DRAFT: TxDraft = {
  type: "expense", amount: "", dateISO: todayISO(), category: "Food", bucket: "need", note: "",
};

export default function MoneyExpenseClient() {
  const todayKey = React.useMemo(() => todayISO(), []);
  const { pathname } = useLocation();

  const [selectedDateISO, setSelectedDateISO] = React.useState<string>(() => todayKey);
  const [monthOffset, setMonthOffset] = React.useState(0);
  const [currency, setCurrency] = React.useState<MoneyCurrency>("USD");
  const [modal, setModal] = React.useState<ModalType>(null);
  const [txDraft, setTxDraft] = React.useState<TxDraft>(() => ({ ...EMPTY_DRAFT, dateISO: todayKey }));
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("money.selectedDateISO") : null;
    if (!stored) return;
    try { setSelectedDateISO(assertDateISO(stored)); } catch (err) { console.error(err); }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("money.selectedDateISO", selectedDateISO);
  }, [selectedDateISO]);

  React.useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("money.currency") : null;
    if (stored && ["USD", "EUR", "GBP", "INR"].includes(stored)) setCurrency(stored as MoneyCurrency);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("money.currency", currency);
  }, [currency]);

  // data hooks (local React Query)
  const { data: allTx } = useTransactions();
  const createTx = useCreateTransaction();
  const deleteTx = useDeleteTransaction();

  const dayTx = React.useMemo(
    () => (allTx ?? []).filter((tx: any) => (tx.date_iso ?? tx.dateISO) === selectedDateISO),
    [allTx, selectedDateISO],
  );

  const dayTotals = React.useMemo(() => {
    let spent = 0;
    let income = 0;
    dayTx.forEach((tx: any) => {
      if (tx.type === "expense" || tx.type === "repayment") spent += tx.amount;
      if (tx.type === "income" || tx.type === "borrowed") income += tx.amount;
    });
    return { spent, income, net: income - spent };
  }, [dayTx]);

  const scoreByDate = React.useMemo(() => {
    const map: Record<string, number> = {};
    (allTx ?? []).forEach((row: any) => {
      const dk = row.date_iso ?? row.dateISO;
      if (dk) map[dk] = 100;
    });
    return map;
  }, [allTx]);

  function openModal(type: TxDraft["type"]) {
    setFormError(null);
    setTxDraft({ ...EMPTY_DRAFT, dateISO: selectedDateISO, type });
    setModal(type);
  }

  async function handleSaveTx() {
    setFormError(null);
    const amount = Number(txDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0) { setFormError("Amount must be valid."); return; }
    let safeDate: string;
    try { safeDate = assertDateISO(txDraft.dateISO); } catch (err) { setFormError("Date must be valid."); return; }

    try {
      createTx.mutate({
        type: txDraft.type,
        amount,
        date_iso: safeDate,
        category: txDraft.category || null,
        bucket: txDraft.bucket,
        note: txDraft.note || null,
      } as any);
      setModal(null);
    } catch (err) {
      console.error(err);
      setFormError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDeleteTx(tx: any) {
    if (!confirm("Delete this transaction?")) return;
    deleteTx.mutate(tx.id);
  }

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      <div className="mb-6 space-y-4">
        <div>
          <p className="tp-kicker">Money Engine</p>
          <h1 className="tp-title text-3xl font-bold md:text-4xl">MONEY ENGINE</h1>
          <p className="tp-subtitle mt-2 text-sm text-white/70">Track every transaction. Own your financial picture.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="body-label">Selected</label>
          <input type="date" className="body-input w-full sm:w-[150px]" value={selectedDateISO} onChange={(event) => setSelectedDateISO(event.target.value)} />
          <label className="body-label">Currency</label>
          <select className="body-select w-full sm:w-[110px]" value={currency} onChange={(event) => setCurrency(event.target.value as MoneyCurrency)}>
            <option value="USD">USD ($)</option><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="INR">INR</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="tp-button tp-button-inline flex-1 sm:flex-none" onClick={() => openModal("expense")}>Add Expense</button>
          <button type="button" className="tp-button tp-button-inline flex-1 sm:flex-none" onClick={() => openModal("income")}>Add Income</button>
        </div>
      </div>

      <div className="tp-tabs mb-4">
        <Link to="/app/money" className={`tp-tab ${pathname === "/app/money" ? "is-active" : ""}`}>Deep Work</Link>
        <Link to="/app/money/cashflow" className={`tp-tab ${pathname?.startsWith("/app/money/cashflow") ? "is-active" : ""}`}>Expense Tracker</Link>
        <Link to="/app/money/budgets" className={`tp-tab ${pathname?.startsWith("/app/money/budgets") ? "is-active" : ""}`}>Budgets</Link>
      </div>

      <div className="space-y-4">
        <ThreeMonthCalendar selectedDateISO={selectedDateISO} onSelect={setSelectedDateISO} monthOffset={monthOffset} onMonthOffsetChange={setMonthOffset} scoreByDate={scoreByDate} startDateISO={todayKey} todayISO={todayKey} />

        <div className="grid gap-4 lg:grid-cols-3">
          <section className="tp-panel p-4">
            <p className="tp-kicker">Day Summary</p>
            <p className="tp-muted mt-2 text-xs">{selectedDateISO}</p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between"><span className="tp-muted">Spent</span><span>{formatMoney(dayTotals.spent, currency)}</span></div>
              <div className="flex items-center justify-between"><span className="tp-muted">Income</span><span>{formatMoney(dayTotals.income, currency)}</span></div>
              <div className="flex items-center justify-between"><span className="tp-muted">Net</span><span>{formatMoney(dayTotals.net, currency)}</span></div>
            </div>
          </section>
        </div>

        <section className="tp-panel p-4">
          <div className="tp-panel-head">
            <div><p className="tp-kicker">Transactions</p><p className="tp-muted text-xs">Filtered by {selectedDateISO}</p></div>
            <span className="tp-muted text-xs">Total: {dayTx.length}</span>
          </div>
          <div className="mt-4 space-y-3">
            {dayTx.length === 0 ? (
              <div className="body-empty">No transactions for this day.</div>
            ) : (
              dayTx.map((tx: any) => (
                <div key={tx.id} className="body-task-row">
                  <div className="flex items-start gap-3">
                    <span className="body-badge">{tx.type === "expense" ? "−" : "+"}</span>
                    <div>
                      <p className="text-sm">{tx.type}{tx.category ? ` • ${tx.category}` : ""}</p>
                      {tx.note ? <p className="text-xs text-white/50">{tx.note}</p> : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm tabular-nums">{formatMoney(tx.amount, currency)}</span>
                    <button type="button" onClick={() => handleDeleteTx(tx)} className="tp-button tp-button-inline text-xs">Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {modal ? (
        <div className="body-modal">
          <div className="body-modal-panel">
            <div className="tp-panel-head">
              <p className="tp-kicker">{modal === "income" ? "Income" : modal === "expense" ? "Expense" : modal}</p>
              <button type="button" className="tp-button tp-button-inline" onClick={() => setModal(null)}>Close</button>
            </div>
            {formError ? <p className="mt-3 text-xs text-red-400">{formError}</p> : null}
            <div className="mt-4 space-y-4">
              <div><label className="body-label">Amount</label><input className="body-input" type="number" value={txDraft.amount} onChange={(event) => setTxDraft({ ...txDraft, amount: event.target.value })} /></div>
              <div><label className="body-label">Date</label><input className="body-input" type="date" value={txDraft.dateISO} onChange={(event) => setTxDraft({ ...txDraft, dateISO: event.target.value })} /></div>
              <div><label className="body-label">Note</label><textarea className="body-input" rows={3} value={txDraft.note} onChange={(event) => setTxDraft({ ...txDraft, note: event.target.value })} /></div>
              <div className="mt-5 flex gap-2"><button type="button" onClick={handleSaveTx} className="tp-button w-auto px-4">Save</button></div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
