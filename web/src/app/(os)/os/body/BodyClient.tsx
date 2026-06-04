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
import {
  addDaysISO,
  assertDateISO,
  dateFromISO,
  dateToISO,
  monthBounds,
  todayISO,
} from "../../../../lib/date";
import { computeMonthConsistency, computeDayScoreFromCounts } from "../../../../lib/scoring";
import { useMonthScoreMap } from "@/hooks/useScoreMap";
import { BodyCalendar } from "../../../../components/body/BodyCalendar";
import { BodyMonthlyHeatBars } from "../../../../components/body/BodyMonthlyHeatBars";
import {
  TitanButton,
  TitanPageHeader,
  TitanPanel,
  TitanPanelHeader,
  TitanProgress,
} from "@/components/ui/titan-primitives";

const ENGINE: EngineKey = "body";

type TaskWithCompletion = {
  id: string;
  title: string;
  kind: "main" | "secondary";
  completed: boolean;
};

type TaskBucketCardProps = {
  title: string;
  dateLabel: string;
  emptyMessage: string;
  tagLabel: string;
  moveLabel: string;
  tasks: TaskWithCompletion[];
  hasAnyTasks: boolean;
  onAdd: () => void;
  onToggle: (task: TaskWithCompletion) => void;
  onDelete: (task: TaskWithCompletion) => Promise<void>;
};


function TaskBucketCard({
  title,
  dateLabel,
  emptyMessage,
  tagLabel,
  tasks,
  hasAnyTasks,
  onAdd,
  onToggle,
  onDelete,
}: TaskBucketCardProps) {
  return (
    <TitanPanel tone="subtle">
      <TitanPanelHeader kicker={title} rightSlot={<p className="tx-muted">{dateLabel}</p>} />

      {!hasAnyTasks && tasks.length === 0 ? (
        <div className="tx-task-empty mt-4">
          <p>{emptyMessage}</p>
          <TitanButton className="mt-3" compact onClick={onAdd}>
            Add Task
          </TitanButton>
        </div>
      ) : (
        <div className="tx-task-list">
          {tasks.length === 0 ? (
            <div className="tx-task-empty">No tasks in this bucket.</div>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className="tx-task-row">
                <label className="tx-task-left">
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => onToggle(task)}
                    className="h-4 w-4 accent-white"
                  />
                  <span>{task.title}</span>
                </label>
                <div className="tx-task-right">
                  <span className="tx-pill">{tagLabel}</span>
                  <details className="body-menu">
                    <summary>•••</summary>
                    <div className="body-menu-panel tx-menu-panel">
                      <button type="button" onClick={() => onDelete(task)}>
                        Delete
                      </button>
                    </div>
                  </details>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <TitanButton className="mt-4" compact onClick={onAdd}>
        Add Task
      </TitanButton>
    </TitanPanel>
  );
}

export default function BodyClient() {
  const { pathname } = useLocation();
  const todayKey = React.useMemo(() => todayISO(), []);

  const [selectedDateKey, setSelectedDateKey] = React.useState<string>(() => todayKey);
  const [visibleMonth, setVisibleMonth] = React.useState<Date>(() => dateFromISO(monthBounds(todayKey).start));
  const [newTaskTitle, setNewTaskTitle] = React.useState<string>("");
  const [newTaskPriority, setNewTaskPriority] = React.useState<"main" | "secondary">("main");
  const [newTaskDaysPerWeek, setNewTaskDaysPerWeek] = React.useState<number>(7);
  const [isAddingTask, setIsAddingTask] = React.useState<boolean>(false);

  React.useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("body.selectedDateISO") : null;
    if (!stored) return;
    try {
      setSelectedDateKey(assertDateISO(stored));
    } catch (err) {
      console.error(err);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("body.selectedDateISO", selectedDateKey);
  }, [selectedDateKey]);

  React.useEffect(() => {
    if (!selectedDateKey) return;
    let safeDate: string;
    try {
      safeDate = assertDateISO(selectedDateKey);
    } catch (err) {
      console.error(err);
      return;
    }
    const selectedMonthStart = monthBounds(safeDate).start;
    const visibleMonthStart = monthBounds(dateToISO(visibleMonth)).start;
    if (selectedMonthStart !== visibleMonthStart) {
      setVisibleMonth(dateFromISO(selectedMonthStart));
    }
  }, [selectedDateKey, visibleMonth]);

  // --- data hooks (local React Query) ---
  const { data: rawTasks } = useEngineTasks(ENGINE);
  const tasks = React.useMemo(() => (rawTasks ?? []).filter((t: any) => t.is_active !== false), [rawTasks]);
  const { data: rawCompletions } = useEngineCompletions(ENGINE, selectedDateKey);
  const completedIds = React.useMemo(() => new Set((rawCompletions ?? []).map((c: any) => c.task_id)), [rawCompletions]);

  const toggleCompletion = useToggleCompletion();
  const createTask = useCreateTask();
  const deleteTaskMutation = useDeleteTask();

  const monthStartKey = React.useMemo(() => monthBounds(dateToISO(visibleMonth)).start, [visibleMonth]);
  const monthEndKey = React.useMemo(
    () => addDaysISO(monthBounds(dateToISO(visibleMonth)).end, -1),
    [visibleMonth],
  );

  const monthScoreMap = useMonthScoreMap("body", monthStartKey, monthEndKey);

  function handleDateChange(nextDateKey: string) {
    if (!nextDateKey) return;
    try {
      setSelectedDateKey(assertDateISO(nextDateKey));
    } catch (err) {
      console.error(err);
      setSelectedDateKey(todayISO());
    }
  }

  const tasksWithCompletion: TaskWithCompletion[] = React.useMemo(
    () =>
      tasks.map((task: any) => ({
        id: task.id,
        title: task.title,
        kind: task.kind,
        completed: completedIds.has(task.id),
      })),
    [completedIds, tasks],
  );

  const mainTasks = tasksWithCompletion.filter((task) => task.kind === "main");
  const secondaryTasks = tasksWithCompletion.filter((task) => task.kind === "secondary");
  const hasTasks = tasks.length > 0;

  const score = React.useMemo(() => {
    const mainDone = mainTasks.filter((t) => t.completed).length;
    const secondaryDone = secondaryTasks.filter((t) => t.completed).length;
    return computeDayScoreFromCounts(mainTasks.length, mainDone, secondaryTasks.length, secondaryDone);
  }, [mainTasks, secondaryTasks]);

  // Consistency starts the day the user added their first task in this
  // engine — counting days before they joined as "inconsistent" punishes
  // them for not existing yet. `computeMonthConsistency` also resets the
  // window after 30 consecutive idle days (see scoring.ts).
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

  async function handleToggleTask(task: TaskWithCompletion) {
    if (!task.id) return;
    toggleCompletion.mutate({ task: { id: task.id, engine: ENGINE }, dateKey: selectedDateKey });
  }

  async function handleAddTask() {
    const title = newTaskTitle.trim();
    if (!title) return;
    createTask.mutate({ engine: ENGINE, title, kind: newTaskPriority, days_per_week: newTaskDaysPerWeek } as any);
    setNewTaskTitle("");
    setNewTaskPriority("main");
    setNewTaskDaysPerWeek(7);
    setIsAddingTask(false);
  }

  async function handleDelete(task: TaskWithCompletion) {
    if (!task.id) return;
    deleteTaskMutation.mutate({ taskId: task.id, engine: ENGINE });
  }

  return (
    <main className="tx-body-page w-full px-2 py-2 sm:px-4 sm:py-4">
      <div className="tx-body-top">
        <TitanPageHeader
          className="mb-0"
          kicker="Body Engine"
          title="Body Control"
          subtitle={`Daily performance log · ${selectedDateKey}`}
          rightSlot={
            <div className="tx-date-pill">
              <span className="tx-kicker">Selected</span>
              <input type="date" value={selectedDateKey} onChange={(event) => handleDateChange(event.target.value)} />
            </div>
          }
        />

        <TitanPanel tone="hero">
          <p className="tx-kicker">Day Score</p>
          <p className="tx-score-main tx-display">{score.percent}%</p>
          <p className="tx-score-label">
            Main {score.mainDone}/{score.mainTotal} • Secondary {score.secondaryDone}/{score.secondaryTotal} • Points{" "}
            {score.pointsDone}/{score.pointsTotal}
          </p>
          <TitanProgress className="mt-3" value={score.percent} />
        </TitanPanel>
      </div>

      <div className="tx-tabs">
        <Link to="/app/body" className={`tx-tab ${pathname === "/app/body" ? "is-active" : ""}`}>
          Body Engine
        </Link>
        <Link to="/app/body/nutrition" className={`tx-tab ${pathname?.startsWith("/app/body/nutrition") ? "is-active" : ""}`}>
          Nutrition
        </Link>
        <Link to="/app/body/workouts" className={`tx-tab ${pathname?.startsWith("/app/body/workouts") ? "is-active" : ""}`}>
          Workouts
        </Link>
        <Link to="/app/body/weight" className={`tx-tab ${pathname?.startsWith("/app/body/weight") ? "is-active" : ""}`}>
          Weight
        </Link>
        <Link to="/app/body/sleep" className={`tx-tab ${pathname?.startsWith("/app/body/sleep") ? "is-active" : ""}`}>
          Sleep
        </Link>
      </div>

      <div className="tx-body-grid">
        <BodyCalendar
          selectedDateKey={selectedDateKey}
          onSelectDate={handleDateChange}
          startDateKey=""
          visibleMonth={visibleMonth}
          onVisibleMonthChange={setVisibleMonth}
          scoreMap={monthScoreMap}
          referenceDateKey={selectedDateKey}
        />

        <TitanPanel tone="subtle">
          <TitanPanelHeader kicker="Consistency" />
          <p className="tx-score-main tx-display">{consistency.consistencyPct}%</p>
          <div className="body-consistency-stack">
            <div>
              <p className="body-consistency-label">Consistent Days</p>
              <p className="body-consistency-value">
                {consistency.consistentDays} / {consistency.daysElapsed}
              </p>
            </div>
            <div>
              <p className="body-consistency-label">Current Streak</p>
              <p className="body-consistency-value">{consistency.currentStreak} days</p>
            </div>
            <div>
              <p className="body-consistency-label">Best Streak</p>
              <p className="body-consistency-value">{consistency.bestStreak} days</p>
            </div>
          </div>
          <div className="mt-4">
            <BodyMonthlyHeatBars
              visibleMonth={visibleMonth}
              scoreMap={monthScoreMap}
              startDateKey=""
              todayKey={selectedDateKey}
            />
          </div>
        </TitanPanel>
      </div>

      <div className="tx-body-tasks">
        <TaskBucketCard
          title="Secondary Tasks"
          dateLabel={selectedDateKey}
          emptyMessage="No secondary tasks for this date."
          tagLabel="Secondary"
          moveLabel="Move to Main"
          tasks={secondaryTasks}
          hasAnyTasks={hasTasks}
          onAdd={() => { setNewTaskPriority("secondary"); setIsAddingTask(true); }}
          onToggle={handleToggleTask}
          onDelete={handleDelete}
        />

        <TaskBucketCard
          title="Main Tasks"
          dateLabel={selectedDateKey}
          emptyMessage="No main tasks for this date."
          tagLabel="Main"
          moveLabel="Move to Secondary"
          tasks={mainTasks}
          hasAnyTasks={hasTasks}
          onAdd={() => { setNewTaskPriority("main"); setIsAddingTask(true); }}
          onToggle={handleToggleTask}
          onDelete={handleDelete}
        />
      </div>

      <MobileModal open={isAddingTask} onClose={() => { setIsAddingTask(false); setNewTaskTitle(""); }} title="New Task">
            <TitanPanelHeader
              kicker="New Task"
              rightSlot={
                <TitanButton
                  tone="ghost"
                  compact
                  onClick={() => {
                    setIsAddingTask(false);
                    setNewTaskTitle("");
                  }}
                >
                  Close
                </TitanButton>
              }
            />

            <div className="mt-4 space-y-4">
              <div>
                <label className="tx-label">Title</label>
                <input
                  value={newTaskTitle}
                  onChange={(event) => setNewTaskTitle(event.target.value)}
                  className="tx-input"
                  placeholder="Task title"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddTask(); }}
                />
              </div>
              <div>
                <label className="tx-label">Priority</label>
                <select
                  value={newTaskPriority}
                  onChange={(event) => setNewTaskPriority(event.target.value as "main" | "secondary")}
                  className="tx-select"
                >
                  <option value="main">Main (2 pts)</option>
                  <option value="secondary">Secondary (1 pt)</option>
                </select>
              </div>
              <div>
                <label className="tx-label">How many days per week?</label>
                <p className="tx-muted mb-1" style={{ fontSize: "0.75rem" }}>
                  Set less than 7 if you take rest days — skipping won&apos;t hurt your score once the weekly goal is met.
                </p>
                <select
                  value={newTaskDaysPerWeek}
                  onChange={(event) => setNewTaskDaysPerWeek(Number(event.target.value))}
                  className="tx-select"
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <option key={n} value={n}>
                      {n === 7 ? `${n} days (every day)` : `${n} day${n > 1 ? "s" : ""} per week`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <TitanButton onClick={handleAddTask}>Create</TitanButton>
              <TitanButton
                tone="ghost"
                onClick={() => {
                  setIsAddingTask(false);
                  setNewTaskTitle("");
                }}
              >
                Cancel
              </TitanButton>
            </div>
      </MobileModal>
    </main>
  );
}
