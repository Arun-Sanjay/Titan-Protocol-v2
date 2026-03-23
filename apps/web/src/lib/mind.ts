import { db, ensureEngineMeta, getEngineStartDate, touchEngineDate, type Task, type Completion } from "./db";
import { assertDateISO, todayISO, monthBounds } from "./date";

export type MindMeta = { id: "mind"; startDate: string; createdAt: number };

export async function ensureMindMeta(dateISO: string): Promise<MindMeta> {
  return ensureEngineMeta("mind", dateISO) as Promise<MindMeta>;
}

export async function getMindStartDate(): Promise<string | null> {
  return getEngineStartDate("mind");
}

export async function addMindTask({
  title,
  kind,
  dateISO,
  daysPerWeek = 7,
}: {
  title: string;
  kind: "main" | "secondary";
  dateISO?: string;
  daysPerWeek?: number;
}): Promise<Task & { id: number }> {
  const id = await db.tasks.add({
    engine: "mind",
    title,
    kind,
    createdAt: Date.now(),
    daysPerWeek,
    isActive: true,
  });
  if (dateISO) {
    await ensureMindMeta(assertDateISO(dateISO));
  }
  return { id, engine: "mind", title, kind, createdAt: Date.now(), daysPerWeek, isActive: true };
}

export async function listMindTasks(): Promise<Task[]> {
  return db.tasks.where({ engine: "mind" }).filter((t) => t.isActive !== false).toArray();
}

export async function deleteMindTask(taskId: string | number): Promise<void> {
  const numId = typeof taskId === "string" ? Number(taskId) : taskId;
  if (!numId) return;
  await db.transaction("rw", db.tasks, db.completions, async () => {
    await db.tasks.delete(numId);
    await db.completions.where({ taskId: numId }).delete();
  });
}

export async function updateMindTaskKind(taskId: string | number, kind: "main" | "secondary"): Promise<void> {
  const numId = typeof taskId === "string" ? Number(taskId) : taskId;
  if (!numId) return;
  await db.tasks.update(numId, { kind });
}

export async function renameMindTask(taskId: string | number, title: string): Promise<void> {
  const numId = typeof taskId === "string" ? Number(taskId) : taskId;
  if (!numId) return;
  await db.tasks.update(numId, { title });
}

export async function listMindCompletions(dateISO: string): Promise<Completion[]> {
  const safeDate = assertDateISO(dateISO ?? todayISO());
  return db.completions.where("[engine+dateKey]").equals(["mind", safeDate]).toArray();
}

export async function setMindTaskCompletion(dateISO: string, taskId: string | number, completed: boolean): Promise<Completion | null> {
  const safeDate = assertDateISO(dateISO ?? todayISO());
  const numId = typeof taskId === "string" ? Number(taskId) : taskId;

  const existing = await db.completions
    .where("[taskId+dateKey]")
    .equals([numId, safeDate])
    .first();

  if (completed && !existing) {
    const id = await db.completions.add({ engine: "mind", taskId: numId, dateKey: safeDate });
    await ensureMindMeta(safeDate);
    return { id, engine: "mind", taskId: numId, dateKey: safeDate };
  }
  if (!completed && existing) {
    await db.completions.delete(existing.id!);
    return null;
  }
  return existing ?? null;
}

export async function computeMindDayScore(dateISO: string) {
  const safeDate = assertDateISO(dateISO ?? todayISO());
  const [tasks, completions] = await Promise.all([listMindTasks(), listMindCompletions(safeDate)]);
  const completedSet = new Set(completions.map((c) => c.taskId));

  const mainTasks = tasks.filter((task) => task.kind === "main");
  const secondaryTasks = tasks.filter((task) => task.kind === "secondary");

  const mainDone = mainTasks.filter((task) => completedSet.has(task.id!)).length;
  const secondaryDone = secondaryTasks.filter((task) => completedSet.has(task.id!)).length;

  const mainTotal = mainTasks.length;
  const secondaryTotal = secondaryTasks.length;
  const pointsTotal = mainTotal * 2 + secondaryTotal;
  const pointsDone = mainDone * 2 + secondaryDone;
  const percent = pointsTotal === 0 ? 0 : Math.round((pointsDone / pointsTotal) * 100);

  return {
    percent,
    mainDone,
    mainTotal,
    secondaryDone,
    secondaryTotal,
    pointsDone,
    pointsTotal,
  };
}

export async function getMindScoreMapForRange(dateISO: string) {
  const safeDate = assertDateISO(dateISO ?? todayISO());
  const { start, end } = monthBounds(safeDate);
  const [tasks, completions] = await Promise.all([
    listMindTasks(),
    db.completions.where("[engine+dateKey]").between(["mind", start], ["mind", end], true, false).toArray(),
  ]);

  const byDate = new Map<string, Set<number>>();
  for (const completion of completions) {
    const set = byDate.get(completion.dateKey) ?? new Set<number>();
    set.add(completion.taskId);
    byDate.set(completion.dateKey, set);
  }

  const mainTasks = tasks.filter((task) => task.kind === "main");
  const secondaryTasks = tasks.filter((task) => task.kind === "secondary");

  const map: Record<string, number> = {};
  for (const [dk, set] of byDate) {
    const mainDone = mainTasks.filter((task) => set.has(task.id!)).length;
    const secondaryDone = secondaryTasks.filter((task) => set.has(task.id!)).length;
    const pointsTotal = mainTasks.length * 2 + secondaryTasks.length;
    const pointsDone = mainDone * 2 + secondaryDone;
    map[dk] = pointsTotal === 0 ? 0 : Math.round((pointsDone / pointsTotal) * 100);
  }
  return map;
}
