import * as React from "react";
import { Link, useLocation } from "react-router-dom";

import {
  useDeepWorkSessions,
  useCreateDeepWorkSession,
  useDeleteDeepWorkSession,
} from "@/hooks/queries/useDeepWork";
import { todayISO } from "../../../../../lib/date";
import { formatMoney, type MoneyCurrency } from "../../../../../lib/money_format";

const CATEGORIES = ["Main Job / College", "Side Hustle", "Freelance", "Investments", "Other"];

export default function DeepWorkPage() {
  const { pathname } = useLocation();
  const todayKey = React.useMemo(() => todayISO(), []);

  const { data: sessions } = useDeepWorkSessions();
  const createSession = useCreateDeepWorkSession();
  const deleteSession = useDeleteDeepWorkSession();

  const todaySessions = React.useMemo(
    () => (sessions ?? []).filter((s: any) => s.date_key === todayKey),
    [sessions, todayKey],
  );

  const [currency, setCurrency] = React.useState<MoneyCurrency>("USD");
  React.useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("money.currency") : null;
    if (stored && ["USD", "EUR", "GBP", "INR"].includes(stored)) setCurrency(stored as MoneyCurrency);
  }, []);

  const [showModal, setShowModal] = React.useState(false);
  const [draftName, setDraftName] = React.useState("");
  const [draftCategory, setDraftCategory] = React.useState("Main Job / College");

  async function handleAddTask() {
    const name = draftName.trim();
    if (!name) return;
    createSession.mutate({ task_name: name, category: draftCategory, date_key: todayKey } as any);
    setDraftName(""); setDraftCategory("Main Job / College"); setShowModal(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this session?")) return;
    deleteSession.mutate(id);
  }

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="tp-title text-3xl font-bold md:text-4xl">MONEY ENGINE</h1>
          <p className="tp-subtitle mt-3 text-sm text-white/70">Deep Work</p>
        </div>
        <button type="button" className="tp-button tp-button-inline" onClick={() => setShowModal(true)}>+ Add Task</button>
      </div>

      <div className="tp-tabs mb-4">
        <Link to="/app/money" className={`tp-tab ${pathname === "/app/money" ? "is-active" : ""}`}>Cashflow</Link>
        <Link to="/app/money/deep-work" className={`tp-tab ${pathname?.startsWith("/app/money/deep-work") ? "is-active" : ""}`}>Deep Work</Link>
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <section className="tp-panel p-4">
            <p className="tp-kicker">Completed Today</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{todaySessions.length}</p>
          </section>
        </div>

        <section className="tp-panel p-4">
          <p className="tp-kicker">Sessions</p>
          <p className="tp-muted mt-1 text-xs">{todayKey}</p>
          <div className="mt-4 space-y-2">
            {todaySessions.length === 0 ? (
              <div className="body-empty">No deep work sessions yet. Add one above.</div>
            ) : (
              todaySessions.map((s: any) => (
                <div key={s.id} className="body-task-row">
                  <div><p className="text-sm">{s.task_name ?? s.name ?? "Session"}</p><span className="body-badge mt-1 inline-block text-[10px]">{s.category}</span></div>
                  <button type="button" onClick={() => handleDelete(s.id)} className="tp-button tp-button-inline text-xs">Delete</button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {showModal ? (
        <div className="body-modal">
          <div className="body-modal-panel">
            <div className="tp-panel-head">
              <p className="tp-kicker">Add Deep Work Task</p>
              <button type="button" className="tp-button tp-button-inline" onClick={() => setShowModal(false)}>Close</button>
            </div>
            <div className="mt-4 space-y-4">
              <div><label className="body-label">Task Name</label><input className="body-input" value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="e.g. Study algorithms" autoFocus /></div>
              <div><label className="body-label">Category</label>
                <select className="body-select" value={draftCategory} onChange={(e) => setDraftCategory(e.target.value)}>
                  {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
              </div>
              <div className="mt-5 flex gap-2">
                <button type="button" className="tp-button w-auto px-4" onClick={handleAddTask}>Save</button>
                <button type="button" className="tp-button tp-button-inline w-auto px-4" onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
