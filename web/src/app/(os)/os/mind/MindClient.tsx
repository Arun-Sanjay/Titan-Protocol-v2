import * as React from "react";
import { Link, useLocation } from "react-router-dom";

import { MobileModal } from "../../../../components/ui/MobileModal";
import {
  useEngineTasks,
  useEngineCompletions,
  useToggleCompletion,
  useCreateTask,
  useDeleteTask,
} from "@/hooks/queries/useTasks";
import type { EngineKey } from "@/services/tasks";
import { BodyCalendar } from "../../../../components/body/BodyCalendar";
import { BodyMonthlyHeatBars } from "../../../../components/body/BodyMonthlyHeatBars";
import {
  addDaysISO,
  assertDateISO,
  dateFromISO,
  dateToISO,
  monthBounds,
  todayISO,
} from "../../../../lib/date";
import { computeMonthConsistency } from "../../../../lib/scoring";
import { useMonthScoreMap } from "@/hooks/useScoreMap";

const ENGINE: EngineKey = "mind";

export default function MindClient() {
  const { pathname } = useLocation();
  const todayKey = React.useMemo(() => todayISO(), []);

  const [selectedDateKey, setSelectedDateKey] = React.useState<string>(() => todayKey);
  const [visibleMonth, setVisibleMonth] = React.useState<Date>(() => dateFromISO(monthBounds(todayKey).start));
  const [newTaskTitle, setNewTaskTitle] = React.useState("");
  const [newTaskKind, setNewTaskKind] = React.useState<"main" | "secondary">("main");
  const [isAddingTask, setIsAddingTask] = React.useState(false);
  const [creatingTask, setCreatingTask] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("mind.selectedDateISO") : null;
    if (!stored) return;
    try { setSelectedDateKey(assertDateISO(stored)); } catch (err) { console.error(err); }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("mind.selectedDateISO", selectedDateKey);
  }, [selectedDateKey]);

  const handleSelectDate = React.useCallback((next: string) => {
    if (!next) return;
    try { setSelectedDateKey(assertDateISO(next)); } catch (err) { console.error(err); setSelectedDateKey(todayISO()); }
  }, []);

  React.useEffect(() => {
    if (!selectedDateKey) return;
    let safeDate: string;
    try { safeDate = assertDateISO(selectedDateKey); } catch (err) { console.error(err); return; }
    const selectedMonthStart = monthBounds(safeDate).start;
    const visibleMonthStart = monthBounds(dateToISO(visibleMonth)).start;
    if (selectedMonthStart !== visibleMonthStart) setVisibleMonth(dateFromISO(selectedMonthStart));
  }, [selectedDateKey, visibleMonth]);

  // --- data hooks (local React Query) ---
  const { data: rawTasks } = useEngineTasks(ENGINE);
  const tasks = React.useMemo(() => (rawTasks ?? []).filter((t: any) => t.is_active !== false), [rawTasks]);
  const { data: rawCompletions } = useEngineCompletions(ENGINE, selectedDateKey);
  const completedIds = React.useMemo(() => new Set((rawCompletions ?? []).map((c: any) => c.task_id)), [rawCompletions]);

  const toggleCompletion = useToggleCompletion();
  const createTask = useCreateTask();
  const deleteTaskMut = useDeleteTask();

  const monthStartKey = React.useMemo(() => monthBounds(dateToISO(visibleMonth)).start, [visibleMonth]);
  const monthEndKey = React.useMemo(() => addDaysISO(monthBounds(dateToISO(visibleMonth)).end, -1), [visibleMonth]);

  const monthScoreMap = useMonthScoreMap("mind", monthStartKey, monthEndKey);

  const tasksWithCompletion = React.useMemo(
    () => tasks.map((task: any) => ({ ...task, completed: completedIds.has(task.id) })),
    [completedIds, tasks],
  );

  const mainTasks = tasksWithCompletion.filter((task: any) => task.kind === "main");
  const secondaryTasks = tasksWithCompletion.filter((task: any) => task.kind === "secondary");

  const mainDone = mainTasks.filter((task: any) => task.completed).length;
  const secondaryDone = secondaryTasks.filter((task: any) => task.completed).length;
  const mainTotal = mainTasks.length;
  const secondaryTotal = secondaryTasks.length;
  const pointsTotal = mainTotal * 2 + secondaryTotal;
  const pointsDone = mainDone * 2 + secondaryDone;
  const scorePercent = pointsTotal === 0 ? 0 : Math.round((pointsDone / pointsTotal) * 100);

  const engineStartKey = React.useMemo(() => {
    let earliest = Number.POSITIVE_INFINITY;
    for (const t of tasks as Array<{ created_at?: string | null }>) {
      if (!t.created_at) continue;
      const ts = new Date(t.created_at).getTime();
      if (Number.isFinite(ts) && ts < earliest) earliest = ts;
    }
    if (!Number.isFinite(earliest)) return todayKey;
    return dateToISO(new Date(earliest));
  }, [tasks, todayKey]);

  const consistency = React.useMemo(
    () => computeMonthConsistency(monthScoreMap, monthStartKey, monthEndKey, engineStartKey, selectedDateKey),
    [monthScoreMap, monthStartKey, monthEndKey, engineStartKey, selectedDateKey],
  );

  async function handleToggleTask(task: any) {
    toggleCompletion.mutate({ task: { id: task.id, engine: ENGINE }, dateKey: selectedDateKey });
  }

  async function handleDeleteTask(taskId: string) {
    if (!taskId) return;
    deleteTaskMut.mutate({ taskId, engine: ENGINE });
  }

  async function handleAddTask() {
    const title = newTaskTitle.trim();
    if (!title) { setCreateError("Title required."); return; }
    setCreatingTask(true);
    setCreateError(null);
    try {
      createTask.mutate({ engine: ENGINE, title, kind: newTaskKind } as any);
      setNewTaskTitle("");
      setNewTaskKind("main");
      setIsAddingTask(false);
    } catch (err) {
      console.error(err);
      setCreateError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingTask(false);
    }
  }

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      <div className="tx-body-top">
        <header>
          <p className="tp-kicker">Mind Engine</p>
          <h1 className="tp-title text-3xl font-bold md:text-4xl">MIND CONTROL</h1>
          <p className="tp-subtitle mt-2 text-sm text-white/70">Daily performance log · {selectedDateKey}</p>
          <div className="mt-3 flex items-center gap-3 text-sm text-white/65">
            <span className="body-consistency-label">Selected</span>
            <input type="date" value={selectedDateKey} onChange={(event) => handleSelectDate(event.target.value)} className="body-select h-8 px-2" />
          </div>
        </header>

        <section className="tp-panel p-4">
          <p className="tp-kicker">Day Score</p>
          <p className="tp-score-value text-3xl">{scorePercent}%</p>
          <p className="mt-2 text-xs text-white/65">Main {mainDone}/{mainTotal} · Secondary {secondaryDone}/{secondaryTotal} · Points {pointsDone}/{pointsTotal}</p>
          <div className="tp-progress mt-3"><span style={{ width: `${scorePercent}%` }} /></div>
        </section>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="tp-tabs">
          <Link to="/app/mind" className={`tp-tab ${pathname === "/app/mind" ? "is-active" : ""}`}>Mind Engine</Link>
          <Link to="/app/focus" className={`tp-tab ${pathname?.startsWith("/app/focus") ? "is-active" : ""}`}>Focus Timer</Link>
        </div>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <BodyCalendar selectedDateKey={selectedDateKey} onSelectDate={handleSelectDate} visibleMonth={visibleMonth} onVisibleMonthChange={setVisibleMonth} scoreMap={monthScoreMap} referenceDateKey={selectedDateKey} startDateKey="" />
        <section className="tp-panel p-5 sm:p-6">
          <p className="tp-kicker">Consistency</p>
          <p className="tp-score-value text-3xl mt-2">{consistency.consistencyPct}%</p>
          <div className="body-consistency-stack">
            <div className="body-consistency-row"><p className="body-consistency-label">Consistent Days</p><p className="body-consistency-value">{consistency.consistentDays} / {consistency.daysElapsed}</p></div>
            <div className="body-consistency-row"><p className="body-consistency-label">Current Streak</p><p className="body-consistency-value">{consistency.currentStreak} days</p></div>
            <div className="body-consistency-row"><p className="body-consistency-label">Best Streak</p><p className="body-consistency-value">{consistency.bestStreak} days</p></div>
          </div>
          <div className="mt-4"><BodyMonthlyHeatBars visibleMonth={visibleMonth} scoreMap={monthScoreMap} todayKey={selectedDateKey} startDateKey="" /></div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Secondary Tasks */}
        <section className="tp-panel p-5 sm:p-6">
          <div className="tp-panel-head"><p className="tp-kicker">Secondary Tasks</p><p className="tp-muted">{selectedDateKey}</p></div>
          {secondaryTasks.length === 0 ? (<div className="body-empty mt-4">No Mind tasks yet. Add your first task.</div>) : (
            <div className="mt-4 space-y-2">
              {secondaryTasks.map((task: any) => (
                <div key={task.id} className="body-task-row">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" checked={task.completed} onChange={() => handleToggleTask(task)} className="h-4 w-4 accent-white" />
                    <span>{task.title}</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="body-badge">SECONDARY</span>
                    <button type="button" onClick={() => handleDeleteTask(task.id)} className="tp-button tp-button-inline text-xs">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={() => { setNewTaskKind("secondary"); setIsAddingTask(true); }} className="tp-button mt-4 inline-flex w-auto px-4">+ Add Task</button>
        </section>

        {/* Main Tasks */}
        <section className="tp-panel p-5 sm:p-6">
          <div className="tp-panel-head"><p className="tp-kicker">Main Tasks</p><p className="tp-muted">{selectedDateKey}</p></div>
          {mainTasks.length === 0 ? (<div className="body-empty mt-4">No Mind tasks yet. Add your first task.</div>) : (
            <div className="mt-4 space-y-2">
              {mainTasks.map((task: any) => (
                <div key={task.id} className="body-task-row">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" checked={task.completed} onChange={() => handleToggleTask(task)} className="h-4 w-4 accent-white" />
                    <span>{task.title}</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="body-badge">MAIN</span>
                    <button type="button" onClick={() => handleDeleteTask(task.id)} className="tp-button tp-button-inline text-xs">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={() => { setNewTaskKind("main"); setIsAddingTask(true); }} className="tp-button mt-4 inline-flex w-auto px-4">+ Add Task</button>
        </section>
      </div>

      <MobileModal open={isAddingTask} onClose={() => { setIsAddingTask(false); setNewTaskTitle(""); setCreateError(null); }} title="New Mind Task">
        <div className="tp-panel-head"><p className="tp-kicker">New Mind Task</p></div>
        <div className="mt-4 space-y-4">
          <div><label className="body-label">Title</label><input value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} className="body-input" placeholder="Task title" /></div>
          <div><label className="body-label">Priority</label>
            <select value={newTaskKind} onChange={(event) => setNewTaskKind(event.target.value as "main" | "secondary")} className="body-select">
              <option value="main">Main (2 pts)</option><option value="secondary">Secondary (1 pt)</option>
            </select>
          </div>
        </div>
        {createError ? (<div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{createError}</div>) : null}
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={handleAddTask} className="tp-button w-auto px-4">{creatingTask ? "Creating..." : "Create"}</button>
          <button type="button" onClick={() => { setIsAddingTask(false); setNewTaskTitle(""); setCreateError(null); }} className="tp-button w-auto px-4">Cancel</button>
        </div>
      </MobileModal>
    </main>
  );
}
