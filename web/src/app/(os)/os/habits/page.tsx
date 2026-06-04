import * as React from "react";
import {
  useHabits,
  useHabitLogsForDate,
  useHabitLogsForRange,
  useToggleHabit,
  useCreateHabit,
  useDeleteHabit,
} from "@/hooks/queries/useHabits";
import { todayISO } from "@/lib/date";
import HabitGrid from "@/components/habits/HabitGrid";
import type { HabitGridCell } from "@/components/habits/HabitGrid";

function dateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function subtractDays(dateKey: string, n: number): string {
  const d = new Date(dateKey + "T00:00:00");
  d.setDate(d.getDate() - n);
  return dateToISO(d);
}

const ENGINE_OPTIONS = [
  { value: "body", label: "Body" },
  { value: "mind", label: "Mind" },
  { value: "money", label: "Money" },
  { value: "charisma", label: "General" },
  { value: "all", label: "All" },
];

const ENGINE_COLORS: Record<string, string> = {
  body: "#f87171",
  mind: "#60a5fa",
  money: "#34d399",
  charisma: "#a78bfa",
  general: "#a78bfa",
  all: "#fbbf24",
};

export default function HabitsPage() {
  const today = React.useMemo(() => todayISO(), []);
  const gridStart = React.useMemo(() => subtractDays(today, 12 * 7 - 1), [today]);

  const { data: habits } = useHabits();
  const { data: todayLogs } = useHabitLogsForDate(today);
  const { data: rangeLogs } = useHabitLogsForRange(gridStart, today);

  const toggleHabit = useToggleHabit();
  const createHabit = useCreateHabit();
  const deleteHabitMut = useDeleteHabit();

  const completedToday = React.useMemo(() => {
    const set = new Set<string>();
    if (todayLogs) {
      for (const log of todayLogs as any[]) {
        set.add(log.habit_id);
      }
    }
    return set;
  }, [todayLogs]);

  const aggregateGridData = React.useMemo(() => {
    if (!habits || habits.length === 0 || !rangeLogs) return [];
    const dayMap = new Map<string, number>();
    for (const log of rangeLogs as any[]) {
      dayMap.set(log.date_key, (dayMap.get(log.date_key) ?? 0) + 1);
    }
    const totalDays = 12 * 7;
    const max = habits.length;
    const cells: HabitGridCell[] = [];
    for (let i = 0; i < totalDays; i++) {
      const dateKey = subtractDays(today, totalDays - 1 - i);
      cells.push({ dateKey, count: dayMap.get(dateKey) ?? 0, max });
    }
    return cells;
  }, [habits, rangeLogs, today]);

  const [showModal, setShowModal] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");
  const [newEngine, setNewEngine] = React.useState("charisma");
  const [newIcon, setNewIcon] = React.useState("");
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  async function handleAdd() {
    const title = newTitle.trim();
    if (!title) return;
    createHabit.mutate({ title, engine: newEngine, icon: newIcon || "~" });
    setNewTitle(""); setNewEngine("charisma"); setNewIcon(""); setShowModal(false);
  }

  async function handleToggle(habitId: string) {
    toggleHabit.mutate({ habit: { id: habitId }, dateKey: today });
  }

  async function handleDelete(habitId: string) {
    deleteHabitMut.mutate(habitId);
    setDeletingId(null);
  }

  if (habits === undefined) {
    return (<main className="w-full px-2 py-2 sm:px-4 sm:py-4"><p className="tp-muted">Loading habits...</p></main>);
  }

  const completedCount = completedToday.size;
  const totalCount = (habits ?? []).length;

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      <header>
        <p className="tp-kicker">Discipline System</p>
        <h1 className="tp-title">Habits</h1>
        <p className="tp-subtitle mt-1">
          {totalCount === 0 ? "No habits tracked yet -- add one to start building your streak." : `${completedCount} of ${totalCount} completed today`}
        </p>
      </header>

      {totalCount > 0 && aggregateGridData.length > 0 && (
        <section className="tp-panel mt-6 p-5">
          <p className="tp-kicker mb-3">Activity / Last 12 Weeks</p>
          <HabitGrid logs={aggregateGridData} weeks={12} />
        </section>
      )}

      <section className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <p className="tp-kicker">Your Habits</p>
          <button type="button" onClick={() => setShowModal(true)} className="tp-button tp-button-inline">+ Add Habit</button>
        </div>

        {(habits ?? []).length === 0 && (<div className="body-empty">No habits yet. Click "+ Add Habit" to start tracking.</div>)}

        <div className="grid gap-3">
          {(habits ?? []).map((habit: any) => {
            const done = completedToday.has(habit.id);
            return (
              <div key={habit.id} className="tp-panel p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <button type="button" onClick={() => handleToggle(habit.id)} className="shrink-0 flex items-center justify-center"
                      style={{ width: 28, height: 28, borderRadius: 8, border: done ? "1px solid rgba(52, 211, 153, 0.5)" : "1px solid rgba(255,255,255,0.12)", background: done ? "rgba(52, 211, 153, 0.15)" : "rgba(255,255,255,0.03)" }}
                      title={done ? "Mark incomplete" : "Mark complete"}
                    >
                      {done && (<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7.5L5.5 10L11 4" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>)}
                    </button>
                    <span className="text-lg">{habit.icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white/90 truncate" style={{ textDecoration: done ? "line-through" : "none", opacity: done ? 0.6 : 1 }}>{habit.title}</p>
                      <span className="inline-block rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-medium" style={{ backgroundColor: `${ENGINE_COLORS[habit.engine] ?? "#a78bfa"}20`, color: ENGINE_COLORS[habit.engine] ?? "#a78bfa" }}>{habit.engine}</span>
                      {habit.current_chain > 0 && (<span className="text-[10px] text-white/40 tracking-wide uppercase ml-2">{habit.current_chain}d streak</span>)}
                    </div>
                  </div>
                  <button type="button" onClick={() => setDeletingId(habit.id)} className="text-white/30 hover:text-red-400 transition-colors text-sm" title="Delete habit">X</button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {showModal && (
        <div className="body-modal" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="body-modal-panel">
            <p className="tp-kicker mb-1">New Habit</p>
            <div className="grid gap-4">
              <div><label className="body-label">Habit Name</label><input type="text" className="body-input" placeholder="e.g. Meditate 10 minutes" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }} autoFocus /></div>
              <div><label className="body-label">Engine</label><select className="body-select" value={newEngine} onChange={(e) => setNewEngine(e.target.value)}>{ENGINE_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}</select></div>
              <div><label className="body-label">Icon (emoji)</label><input type="text" className="body-input" placeholder="e.g. ..." value={newIcon} onChange={(e) => setNewIcon(e.target.value)} maxLength={4} /></div>
            </div>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={handleAdd} className="tp-button inline-flex w-auto px-5" disabled={!newTitle.trim()}>Add Habit</button>
              <button type="button" onClick={() => setShowModal(false)} className="tp-button tp-button-inline inline-flex w-auto px-5">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {deletingId !== null && (
        <div className="body-modal" onClick={(e) => { if (e.target === e.currentTarget) setDeletingId(null); }}>
          <div className="body-modal-panel">
            <p className="tp-kicker mb-1">Confirm Delete</p>
            <p className="text-sm text-white/50 mb-5">This will permanently remove the habit and all its history.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => handleDelete(deletingId)} className="tp-button inline-flex w-auto px-5" style={{ borderColor: "rgba(248, 113, 113, 0.3)", color: "#f87171" }}>Delete</button>
              <button type="button" onClick={() => setDeletingId(null)} className="tp-button tp-button-inline inline-flex w-auto px-5">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
