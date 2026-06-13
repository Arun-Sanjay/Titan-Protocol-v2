import * as React from "react";
import { confirm } from "@/lib/confirm";
import { toast } from "@/lib/toast";

import { MobileModal } from "../../../../components/ui/MobileModal";
import {
  useEngineTasks,
  useEngineCompletions,
  useToggleCompletion,
  useCreateTask,
  useUpdateTask,
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
  TitanPageHeader,
  TitanPanel,
  TitanPanelHeader,
  TitanProgress,
  TitanButton,
  TitanEmptyState,
} from "../../../../components/ui/titan-primitives";

// "general" engine is now "charisma" in Supabase
const ENGINE: EngineKey = "charisma" as EngineKey;

export default function GeneralClient() {
  const todayKey = React.useMemo(() => todayISO(), []);

  const [selectedDateKey, setSelectedDateKey] = React.useState<string>(() => todayKey);
  const [visibleMonth, setVisibleMonth] = React.useState<Date>(() => dateFromISO(monthBounds(todayKey).start));
  const [newTaskTitle, setNewTaskTitle] = React.useState<string>("");
  const [newTaskPriority, setNewTaskPriority] = React.useState<"main" | "secondary">("main");
  const [newTaskDaysPerWeek, setNewTaskDaysPerWeek] = React.useState<number>(7);
  const [editingTaskId, setEditingTaskId] = React.useState<string | null>(null);
  const [isAddingTask, setIsAddingTask] = React.useState<boolean>(false);

  React.useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("general.selectedDateISO") : null;
    if (!stored) return;
    try { setSelectedDateKey(assertDateISO(stored)); } catch (err) { console.error(err); }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("general.selectedDateISO", selectedDateKey);
  }, [selectedDateKey]);

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
  const updateTaskMut = useUpdateTask();
  const deleteTaskMut = useDeleteTask();
  async function handleDelete(task: { id: string }) {
    const ok = await confirm({
      title: "Delete task?",
      message: "This removes the task and its completion history. This can't be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    deleteTaskMut.mutate(
      { taskId: task.id, engine: ENGINE },
      { onSuccess: () => toast.success("Task deleted") },
    );
  }

  const monthStartKey = React.useMemo(() => monthBounds(dateToISO(visibleMonth)).start, [visibleMonth]);
  const monthEndKey = React.useMemo(() => addDaysISO(monthBounds(dateToISO(visibleMonth)).end, -1), [visibleMonth]);
  const monthScoreMap = useMonthScoreMap("charisma", monthStartKey, monthEndKey);

  function handleDateChange(nextDateKey: string) {
    if (!nextDateKey) return;
    try { setSelectedDateKey(assertDateISO(nextDateKey)); } catch (err) { console.error(err); setSelectedDateKey(todayISO()); }
  }

  const tasksWithCompletion = React.useMemo(
    () => tasks.map((task: any) => ({ ...task, completed: completedIds.has(task.id) })),
    [completedIds, tasks],
  );

  const mainTasks = tasksWithCompletion.filter((task: any) => task.kind === "main");
  const secondaryTasks = tasksWithCompletion.filter((task: any) => task.kind === "secondary");
  const hasTasks = tasks.length > 0;
  const score = React.useMemo(() => {
    const mainDone = mainTasks.filter((t: any) => t.completed).length;
    const secondaryDone = secondaryTasks.filter((t: any) => t.completed).length;
    return computeDayScoreFromCounts(mainTasks.length, mainDone, secondaryTasks.length, secondaryDone);
  }, [mainTasks, secondaryTasks]);

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
    if (!task.id) return;
    toggleCompletion.mutate({ task: { id: task.id, engine: ENGINE }, dateKey: selectedDateKey });
  }

  function resetTaskForm() {
    setNewTaskTitle(""); setNewTaskPriority("main"); setNewTaskDaysPerWeek(7); setIsAddingTask(false); setEditingTaskId(null);
  }

  async function handleAddTask() {
    const title = newTaskTitle.trim();
    if (!title) return;
    if (editingTaskId) {
      updateTaskMut.mutate(
        { taskId: editingTaskId, engine: ENGINE, title, kind: newTaskPriority },
        { onSuccess: () => toast.success("Task updated") },
      );
    } else {
      createTask.mutate({ engine: ENGINE, title, kind: newTaskPriority, days_per_week: newTaskDaysPerWeek } as any);
    }
    resetTaskForm();
  }

  function handleEditStart(task: any) {
    if (!task.id) return;
    setNewTaskTitle(task.title);
    setNewTaskPriority((task.kind as "main" | "secondary") ?? "main");
    setEditingTaskId(task.id);
    setIsAddingTask(true);
  }

  return (
    <main className="tx-body-page w-full px-2 py-2 sm:px-4 sm:py-4">
      <TitanPageHeader kicker="General Engine" title="GENERAL" subtitle={`Daily performance log · ${selectedDateKey}`}
        rightSlot={<div className="tx-date-pill"><span className="tx-kicker">Selected</span><input type="date" value={selectedDateKey} onChange={(event) => handleDateChange(event.target.value)} /></div>}
      />

      <TitanPanel className="mt-4">
        <p className="tx-kicker">Day Score</p>
        <p className="tx-score-main tx-display mt-1">{score.percent}%</p>
        <p className="tx-muted mt-2">Main {score.mainDone}/{score.mainTotal} • Secondary {score.secondaryDone}/{score.secondaryTotal} • Points {score.pointsDone}/{score.pointsTotal}</p>
        <TitanProgress value={score.percent} className="mt-3" />
      </TitanPanel>

      <div className="tx-body-grid mt-4">
        <BodyCalendar selectedDateKey={selectedDateKey} onSelectDate={handleDateChange} visibleMonth={visibleMonth} onVisibleMonthChange={setVisibleMonth} scoreMap={monthScoreMap} referenceDateKey={selectedDateKey} startDateKey="" />
        <TitanPanel>
          <p className="tx-kicker">Consistency</p>
          <p className="tx-score-main tx-display mt-2">{consistency.consistencyPct}%</p>
          <div className="body-consistency-stack">
            <div className="body-consistency-row"><p className="body-consistency-label">Consistent Days</p><p className="body-consistency-value">{consistency.consistentDays} / {consistency.daysElapsed}</p></div>
            <div className="body-consistency-row"><p className="body-consistency-label">Current Streak</p><p className="body-consistency-value">{consistency.currentStreak} days</p></div>
            <div className="body-consistency-row"><p className="body-consistency-label">Best Streak</p><p className="body-consistency-value">{consistency.bestStreak} days</p></div>
          </div>
          <div className="mt-4"><BodyMonthlyHeatBars visibleMonth={visibleMonth} scoreMap={monthScoreMap} todayKey={selectedDateKey} startDateKey="" /></div>
        </TitanPanel>
      </div>

      <div className="tx-body-tasks mt-4">
        <TitanPanel>
          <TitanPanelHeader kicker="Secondary Tasks" rightSlot={<span className="tx-muted">{selectedDateKey}</span>} />
          <div className="tx-task-list">
            {secondaryTasks.map((task: any) => (
              <div key={task.id} className="tx-task-row">
                <div className="tx-task-left"><input type="checkbox" checked={task.completed} onChange={() => handleToggleTask(task)} /><span>{task.title}</span></div>
                <div className="tx-task-right"><span className="tx-pill">Secondary</span><button type="button" onClick={() => handleEditStart(task)} className="tp-button tp-button-inline text-xs">Edit</button><button type="button" onClick={() => handleDelete(task)} className="tp-button tp-button-inline text-xs">Delete</button></div>
              </div>
            ))}
          </div>
          <TitanButton onClick={() => { setNewTaskPriority("secondary"); setIsAddingTask(true); }} compact className="mt-4">Add Task</TitanButton>
        </TitanPanel>

        <TitanPanel>
          <TitanPanelHeader kicker="Main Tasks" rightSlot={<span className="tx-muted">{selectedDateKey}</span>} />
          <div className="tx-task-list">
            {mainTasks.map((task: any) => (
              <div key={task.id} className="tx-task-row">
                <div className="tx-task-left"><input type="checkbox" checked={task.completed} onChange={() => handleToggleTask(task)} /><span>{task.title}</span></div>
                <div className="tx-task-right"><span className="tx-pill">Main</span><button type="button" onClick={() => handleEditStart(task)} className="tp-button tp-button-inline text-xs">Edit</button><button type="button" onClick={() => handleDelete(task)} className="tp-button tp-button-inline text-xs">Delete</button></div>
              </div>
            ))}
          </div>
          <TitanButton onClick={() => { setNewTaskPriority("main"); setIsAddingTask(true); }} compact className="mt-4">Add Task</TitanButton>
        </TitanPanel>
      </div>

      <MobileModal open={isAddingTask} onClose={resetTaskForm} title={editingTaskId ? "Edit Task" : "New General Task"}>
        <TitanPanelHeader kicker={editingTaskId ? "Edit Task" : "New General Task"} rightSlot={<TitanButton tone="ghost" compact onClick={resetTaskForm}>Close</TitanButton>} />
        <div className="mt-4 space-y-4">
          <div><label className="tx-label">Title</label><input value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} className="tx-input" placeholder="Task title" autoFocus onKeyDown={(e) => { if (e.key === "Enter") handleAddTask(); }} /></div>
          <div><label className="tx-label">Priority</label><select value={newTaskPriority} onChange={(event) => setNewTaskPriority(event.target.value as "main" | "secondary")} className="tx-select"><option value="main">Main (2 pts)</option><option value="secondary">Secondary (1 pt)</option></select></div>
        </div>
        <div className="mt-5 flex gap-2"><TitanButton onClick={handleAddTask}>{editingTaskId ? "Save" : "Create"}</TitanButton><TitanButton tone="ghost" onClick={resetTaskForm}>Cancel</TitanButton></div>
      </MobileModal>
    </main>
  );
}
