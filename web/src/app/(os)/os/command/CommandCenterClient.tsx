import * as React from "react";

import { ThreeMonthCalendar } from "../../../../components/calendar/ThreeMonthCalendar";
import { BodyMonthlyHeatBars } from "../../../../components/body/BodyMonthlyHeatBars";
import { assertDateISO, dateFromISO, todayISO } from "../../../../lib/date";
import { computeMonthConsistency, computeDayScoreFromCounts } from "../../../../lib/scoring";
import { useMonthTitanScoreMap } from "@/hooks/useScoreMap";
import {
  useAllTasks,
  useAllCompletionsForDate,
  useToggleCompletion,
  useCreateTask,
} from "@/hooks/queries/useTasks";
import type { EngineKey } from "@/services/tasks";

const ENGINE_ORDER: EngineKey[] = ["body", "mind", "money", "charisma" as EngineKey];

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date): Date { return new Date(date.getFullYear(), date.getMonth(), 1); }
function endOfMonth(date: Date): Date { return new Date(date.getFullYear(), date.getMonth() + 1, 0); }
function addMonths(date: Date, delta: number): Date { return new Date(date.getFullYear(), date.getMonth() + delta, 1); }

const ENGINE_LABELS: Record<string, string> = { body: "BODY", mind: "MIND", money: "MONEY", charisma: "GENERAL" };

export default function CommandCenterClient() {
  const todayKey = React.useMemo(() => todayISO(), []);
  const [selectedDateISO, setSelectedDateISO] = React.useState<string>(() => todayKey);
  const [monthOffset, setMonthOffset] = React.useState(0);
  const [isAddingTask, setIsAddingTask] = React.useState(false);
  const [newTaskEngine, setNewTaskEngine] = React.useState<EngineKey>("body");
  const [newTaskTitle, setNewTaskTitle] = React.useState("");
  const [newTaskKind, setNewTaskKind] = React.useState<"main" | "secondary">("main");
  const [newTaskDaysPerWeek, setNewTaskDaysPerWeek] = React.useState<number>(7);
  const [isCreatingTask, setIsCreatingTask] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("command.selectedDateISO") : null;
    if (!stored) return;
    try { setSelectedDateISO(assertDateISO(stored)); } catch (err) { console.error(err); }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("command.selectedDateISO", selectedDateISO);
  }, [selectedDateISO]);

  // --- data hooks (local React Query) ---
  const { data: rawTasks } = useAllTasks();
  const tasks = React.useMemo(() => (rawTasks ?? []).filter((t: any) => t.is_active !== false), [rawTasks]);
  const { data: rawCompletions } = useAllCompletionsForDate(selectedDateISO);
  const completionSet = React.useMemo(() => new Set((rawCompletions ?? []).map((c: any) => c.task_id)), [rawCompletions]);

  const toggleCompletion = useToggleCompletion();
  const createTask = useCreateTask();

  const startDateISO = React.useMemo(() => {
    if (tasks.length === 0) return todayKey;
    const earliest = tasks.reduce((min: number, task: any) => Math.min(min, new Date(task.created_at ?? 0).getTime()), new Date(tasks[0]?.created_at ?? 0).getTime());
    return toDateKey(new Date(earliest));
  }, [tasks, todayKey]);

  const centerMonth = React.useMemo(() => addMonths(startOfMonth(new Date()), monthOffset), [monthOffset]);
  const monthStartKey = React.useMemo(() => toDateKey(startOfMonth(centerMonth)), [centerMonth]);
  const monthEndKey = React.useMemo(() => toDateKey(endOfMonth(centerMonth)), [centerMonth]);
  const scoreByDate = useMonthTitanScoreMap(monthStartKey, monthEndKey);

  const consistency = React.useMemo(() => {
    return computeMonthConsistency(scoreByDate, monthStartKey, monthEndKey, startDateISO, todayKey);
  }, [scoreByDate, monthStartKey, monthEndKey, startDateISO, todayKey]);

  function handleDateSelect(nextISO: string) {
    try { setSelectedDateISO(assertDateISO(nextISO)); } catch (err) { console.error(err); setSelectedDateISO(todayKey); }
  }

  const score = React.useMemo(() => {
    const main = tasks.filter((t: any) => t.kind === "main");
    const secondary = tasks.filter((t: any) => t.kind === "secondary");
    const mainDone = main.filter((t: any) => completionSet.has(t.id)).length;
    const secondaryDone = secondary.filter((t: any) => completionSet.has(t.id)).length;
    return computeDayScoreFromCounts(main.length, mainDone, secondary.length, secondaryDone);
  }, [tasks, completionSet]);

  const mainTasks = React.useMemo(() => {
    return tasks.filter((task: any) => task.kind === "main").map((task: any) => ({ ...task, completed: completionSet.has(task.id) }))
      .sort((a: any, b: any) => { if (a.completed !== b.completed) return a.completed ? 1 : -1; return ENGINE_ORDER.indexOf(a.engine) - ENGINE_ORDER.indexOf(b.engine); });
  }, [tasks, completionSet]);

  const secondaryTasks = React.useMemo(() => {
    return tasks.filter((task: any) => task.kind === "secondary").map((task: any) => ({ ...task, completed: completionSet.has(task.id) }))
      .sort((a: any, b: any) => { if (a.completed !== b.completed) return a.completed ? 1 : -1; return ENGINE_ORDER.indexOf(a.engine) - ENGINE_ORDER.indexOf(b.engine); });
  }, [tasks, completionSet]);

  async function handleToggle(task: any) {
    toggleCompletion.mutate({ task: { id: task.id, engine: task.engine }, dateKey: selectedDateISO });
  }

  function openAddTask(kind: "main" | "secondary") {
    setCreateError(null); setNewTaskKind(kind); setIsAddingTask(true);
  }

  async function handleAddTask() {
    const title = newTaskTitle.trim();
    if (!title) { setCreateError("Title is required."); return; }
    setIsCreatingTask(true); setCreateError(null);
    try {
      createTask.mutate({ engine: newTaskEngine, title, kind: newTaskKind, days_per_week: newTaskDaysPerWeek } as any);
      setNewTaskTitle(""); setNewTaskKind("main"); setNewTaskDaysPerWeek(7); setIsAddingTask(false);
    } catch (err) {
      console.error(err);
      setCreateError(err instanceof Error ? err.message : "Failed to create task.");
    } finally { setIsCreatingTask(false); }
  }

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      <div className="grid grid-cols-[1fr_auto] items-start gap-6">
        <header>
          <h1 className="tp-title text-3xl font-bold md:text-4xl">COMMAND CENTER</h1>
          <p className="tp-subtitle mt-3 text-sm text-white/70">All engines. One view.</p>
        </header>
        <section className="tp-panel p-4">
          <p className="tp-kicker">Day Score</p>
          <p className="tp-score-value text-3xl">{score.percent}%</p>
          <p className="mt-2 text-xs text-white/65">Main {score.mainDone}/{score.mainTotal} • Secondary {score.secondaryDone}/{score.secondaryTotal}</p>
          <div className="tp-progress mt-3"><span style={{ width: `${score.percent}%` }} /></div>
        </section>
      </div>

      <div className="cc-content-grid mt-4">
        <ThreeMonthCalendar selectedDateISO={selectedDateISO} onSelect={handleDateSelect} monthOffset={monthOffset} onMonthOffsetChange={setMonthOffset} scoreByDate={scoreByDate} startDateISO={startDateISO} todayISO={todayKey} monthCount={2} />
        <section className="tp-panel p-4">
          <p className="tp-kicker">Consistency</p>
          <p className="tp-score-value text-3xl">{consistency.consistencyPct}%</p>
          <div className="body-consistency-stack">
            <div><p className="body-consistency-label">Consistent Days</p><p className="body-consistency-value">{consistency.consistentDays} / {consistency.daysElapsed}</p></div>
            <div><p className="body-consistency-label">Current Streak</p><p className="body-consistency-value">{consistency.currentStreak} days</p></div>
            <div><p className="body-consistency-label">Best Streak</p><p className="body-consistency-value">{consistency.bestStreak} days</p></div>
          </div>
          <div className="mt-4"><BodyMonthlyHeatBars visibleMonth={centerMonth} scoreMap={scoreByDate} startDateKey={startDateISO} todayKey={todayKey} /></div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="tp-panel p-5 sm:p-6">
          <div className="tp-panel-head"><p className="tp-kicker">Main Tasks</p><p className="tp-muted">{selectedDateISO}</p></div>
          {mainTasks.length === 0 ? (<div className="body-empty mt-4"><p>No main tasks yet.</p></div>) : (
            <div className="mt-4 space-y-2">
              {mainTasks.map((task: any) => (
                <div key={task.id} className="cc-task-row body-task-row">
                  <label className="flex items-center gap-3"><input type="checkbox" checked={task.completed} onChange={() => handleToggle(task)} className="h-4 w-4 accent-white" /><span className={task.completed ? "line-through text-white/40" : ""}>{task.title}</span></label>
                  <div className="cc-task-meta"><span className="body-badge">{ENGINE_LABELS[task.engine] ?? task.engine}</span><span className="tp-muted text-xs">2 pts</span></div>
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={() => openAddTask("main")} className="tp-button mt-4 inline-flex w-auto px-4">Add Task</button>
        </section>

        <section className="tp-panel p-5 sm:p-6">
          <div className="tp-panel-head"><p className="tp-kicker">Secondary Tasks</p><p className="tp-muted">{selectedDateISO}</p></div>
          {secondaryTasks.length === 0 ? (<div className="body-empty mt-4"><p>No secondary tasks yet.</p></div>) : (
            <div className="mt-4 space-y-2">
              {secondaryTasks.map((task: any) => (
                <div key={task.id} className="cc-task-row body-task-row">
                  <label className="flex items-center gap-3"><input type="checkbox" checked={task.completed} onChange={() => handleToggle(task)} className="h-4 w-4 accent-white" /><span className={task.completed ? "line-through text-white/40" : ""}>{task.title}</span></label>
                  <div className="cc-task-meta"><span className="body-badge">{ENGINE_LABELS[task.engine] ?? task.engine}</span><span className="tp-muted text-xs">1 pt</span></div>
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={() => openAddTask("secondary")} className="tp-button mt-4 inline-flex w-auto px-4">Add Task</button>
        </section>
      </div>

      {isAddingTask ? (
        <div className="body-modal">
          <div className="body-modal-panel">
            <div className="tp-panel-head">
              <p className="tp-kicker">New Command Center Task</p>
              <button type="button" onClick={() => { setIsAddingTask(false); setNewTaskTitle(""); setCreateError(null); }} className="tp-button tp-button-inline">Close</button>
            </div>
            <div className="mt-4 space-y-4">
              <div><label className="body-label">Engine</label>
                <select value={newTaskEngine} onChange={(event) => setNewTaskEngine(event.target.value as EngineKey)} className="body-select">
                  <option value="body">Body</option><option value="mind">Mind</option><option value="money">Money</option><option value="charisma">General</option>
                </select>
              </div>
              <div><label className="body-label">Title</label><input value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} className="body-input" placeholder="Task title" autoFocus onKeyDown={(event) => { if (event.key === "Enter") handleAddTask(); }} /></div>
              <div><label className="body-label">Priority</label>
                <select value={newTaskKind} onChange={(event) => setNewTaskKind(event.target.value as "main" | "secondary")} className="body-select">
                  <option value="main">Main (2 pts)</option><option value="secondary">Secondary (1 pt)</option>
                </select>
              </div>
            </div>
            {createError ? (<div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{createError}</div>) : null}
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={handleAddTask} className="tp-button w-auto px-4">{isCreatingTask ? "Creating..." : "Create"}</button>
              <button type="button" onClick={() => { setIsAddingTask(false); setNewTaskTitle(""); setCreateError(null); }} className="tp-button w-auto px-4">Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
