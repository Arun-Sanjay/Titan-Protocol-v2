/**
 * Adaptive Operation Engine
 *
 * Analyzes yesterday's performance, calculates consistency rate,
 * selects tasks from the user's engines, and generates today's operation.
 *
 * Task count scales with consistency:
 * - HIGH (80%+): increase next day
 * - MODERATE (50-79%): maintain
 * - LOW (<50%): decrease, Protocol warns
 *
 * Tasks are selected priority-based from the user's own engine tasks:
 * 1. Skipped yesterday (re-assigned)
 * 2. Main missions from weakest engine
 * 3. Main missions from other engines (rotating)
 * 4. Side quests to fill remaining slots
 */

import { getJSON, setJSON } from "../db/storage";
import { getTodayKey, addDays } from "./date";
import type { EngineKey, Task } from "../db/schema";
import { checkIntegrityStatus } from "./protocol-integrity";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConsistencyLevel = "HIGH" | "MODERATE" | "LOW";

export type OperationType =
  | "MAINTAIN_PRESSURE"
  | "ENGINE_RECOVERY"
  | "MOMENTUM"
  | "REBUILD"
  | "FULL_SPECTRUM"
  | "REBALANCE"
  | "REFOCUS"
  | "FIRST_LIGHT"
  | "RECOVERY";

export type DailyOperation = {
  name: OperationType;
  displayName: string;
  subtitle: string;
  tasks: OperationTask[];
  protocolMessage: string;
  consistency: ConsistencyLevel;
  consistencyRate: number;
  weakEngine: EngineKey | null;
  strongEngine: EngineKey | null;
  taskCount: number;
  dayNumber: number;
};

export type OperationTask = {
  id: number;
  engine: EngineKey;
  title: string;
  kind: "main" | "secondary";
  xp: number;
  isReassigned: boolean; // was skipped yesterday
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CONSISTENCY_KEY = "operation_consistency";
const TASK_COUNT_KEY = "operation_task_count";
const ASSIGNED_KEY_PREFIX = "operation_assigned:";
const COMPLETED_KEY_PREFIX = "operation_completed:";
const LAST_ASSIGNED_KEY = "operation_last_assigned_tasks";

const ENGINES: EngineKey[] = ["body", "mind", "money", "charisma"];

const OPERATION_NAMES: Record<OperationType, { display: string; subtitle: string }> = {
  MAINTAIN_PRESSURE: { display: "MAINTAIN PRESSURE", subtitle: "Keep all systems firing" },
  ENGINE_RECOVERY: { display: "ENGINE RECOVERY", subtitle: "Bring the weak link back online" },
  MOMENTUM: { display: "MOMENTUM", subtitle: "You're on a roll. Don't stop." },
  RECOVERY: { display: "RECOVERY", subtitle: "Welcome back. The protocol remembers." },
  REBUILD: { display: "REBUILD", subtitle: "Day one. No excuses." },
  FULL_SPECTRUM: { display: "FULL SPECTRUM", subtitle: "All four engines. Maximum output." },
  REBALANCE: { display: "REBALANCE", subtitle: "Stop hiding behind your strengths" },
  REFOCUS: { display: "REFOCUS", subtitle: "Less tasks. More intention." },
  FIRST_LIGHT: { display: "FIRST LIGHT", subtitle: "Your first operation" },
};

// ─── Consistency Calculation ──────────────────────────────────────────────────

export function calculateConsistency(): { rate: number; level: ConsistencyLevel } {
  const today = getTodayKey();
  let totalAssigned = 0;
  let totalCompleted = 0;

  // Look at last 7 days — only count days where BOTH assigned AND completed tracking exist
  for (let i = 1; i <= 7; i++) {
    const dk = addDays(today, -i);
    const assigned = getJSON<number | null>(`${ASSIGNED_KEY_PREFIX}${dk}`, null);
    const completed = getJSON<number | null>(`${COMPLETED_KEY_PREFIX}${dk}`, null);

    // Skip days with no tracking data (before tracking was enabled)
    if (assigned === null || assigned === 0) continue;
    // If assigned exists but completed doesn't, check if protocol was completed that day
    // (user may have completed via old code path without tracking)
    if (completed === null) {
      // Be generous: if tasks were assigned, assume partial completion
      continue;
    }

    totalAssigned += assigned;
    totalCompleted += completed;
  }

  if (totalAssigned === 0) return { rate: 100, level: "HIGH" }; // No tracked data yet

  const rate = Math.round((totalCompleted / totalAssigned) * 100);

  let level: ConsistencyLevel;
  if (rate >= 80) level = "HIGH";
  else if (rate >= 50) level = "MODERATE";
  else level = "LOW";

  return { rate, level };
}

// ─── Task Count Calculation ───────────────────────────────────────────────────

export function calculateTaskCount(
  dayNumber: number,
  consistency: ConsistencyLevel,
  phase: string,
): number {
  // Base count from stored value or default
  let count = getJSON<number>(TASK_COUNT_KEY, 4);

  // Phase multiplier
  const phaseMultiplier: Record<string, number> = {
    induction: 1.0,
    foundation: 1.1,
    building: 1.2,
    intensify: 1.3,
    sustain: 1.3,
  };
  const mult = phaseMultiplier[phase] ?? 1.0;

  // Adjust based on consistency
  if (consistency === "HIGH") {
    // Every 7 days of high consistency, add 1 (check if we should bump)
    const consecutiveHighDays = getJSON<number>("consecutive_high_days", 0);
    if (consecutiveHighDays > 0 && consecutiveHighDays % 7 === 0) {
      count = Math.min(count + 1, 10);
    }
  } else if (consistency === "LOW") {
    count = Math.max(count - 1, 3);
  }

  // Apply phase multiplier (round)
  count = Math.round(count * mult);

  // Clamp
  count = Math.min(Math.max(count, 3), 12);

  // Day-specific overrides during induction
  if (dayNumber <= 3) count = 4;
  else if (dayNumber <= 5) count = 5;
  else if (dayNumber <= 7) count = 5;

  // Save for next time
  setJSON(TASK_COUNT_KEY, count);

  return count;
}

// ─── Engine Analysis ──────────────────────────────────────────────────────────

function getEngineScores(): Record<EngineKey, number> {
  const today = getTodayKey();
  const scores: Record<EngineKey, number> = { body: 0, mind: 0, money: 0, charisma: 0 };

  for (const engine of ENGINES) {
    // Average over last 3 days
    let total = 0;
    let days = 0;
    for (let i = 0; i < 3; i++) {
      const dk = addDays(today, -i);
      const ids = getJSON<number[]>(`completions:${engine}:${dk}`, []);
      const tasks = getJSON<Task[]>(`tasks:${engine}`, []).filter((t) => t.is_active === 1);
      if (tasks.length > 0) {
        let earned = 0;
        let max = 0;
        for (const t of tasks) {
          const pts = t.kind === "main" ? 2 : 1;
          max += pts;
          if (ids.includes(t.id!)) earned += pts;
        }
        total += max > 0 ? (earned / max) * 100 : 0;
        days++;
      }
    }
    scores[engine] = days > 0 ? Math.round(total / days) : 0;
  }

  return scores;
}

function findWeakEngine(scores: Record<EngineKey, number>): EngineKey | null {
  let weakest: EngineKey | null = null;
  let lowestScore = Infinity;
  for (const engine of ENGINES) {
    if (scores[engine] < lowestScore) {
      lowestScore = scores[engine];
      weakest = engine;
    }
  }
  return weakest;
}

function findStrongEngine(scores: Record<EngineKey, number>): EngineKey | null {
  let strongest: EngineKey | null = null;
  let highestScore = -1;
  for (const engine of ENGINES) {
    if (scores[engine] > highestScore) {
      highestScore = scores[engine];
      strongest = engine;
    }
  }
  return strongest;
}

// ─── Operation Type Selection ─────────────────────────────────────────────────

function selectOperationType(
  scores: Record<EngineKey, number>,
  consistency: ConsistencyLevel,
  streak: number,
  dayNumber: number,
): OperationType {
  if (dayNumber === 1) return "FIRST_LIGHT";

  const weakEngine = findWeakEngine(scores);
  const strongEngine = findStrongEngine(scores);
  const allAbove70 = ENGINES.every((e) => scores[e] >= 70);
  const oneBelow30 = ENGINES.some((e) => scores[e] < 30);
  const imbalance = strongEngine && weakEngine
    ? scores[strongEngine] - scores[weakEngine] > 25
    : false;

  // Consistency-driven (highest priority)
  if (consistency === "LOW") return "REFOCUS";

  // Streak-driven — check integrity system for nuanced recovery
  if (streak === 0) {
    const integrity = checkIntegrityStatus();
    // If user has prior history and integrity shows they're recovering, encourage them
    if (integrity.lastCompletionDate && (integrity.status === "WARNING" || integrity.status === "BREACH" || integrity.status === "RECOVERING")) {
      return "RECOVERY";
    }
    return "REBUILD";
  }

  // Score-driven (check before momentum — engine health matters most)
  if (oneBelow30) return "ENGINE_RECOVERY";
  if (imbalance) return "REBALANCE";

  // Streak + consistency driven
  if (streak >= 5 && consistency === "HIGH") return "MOMENTUM";

  // All good
  if (allAbove70) return "FULL_SPECTRUM";

  return "MAINTAIN_PRESSURE";
}

// ─── Task Selection (Priority-Based) ──────────────────────────────────────────

function selectTasks(
  targetCount: number,
  operationType: OperationType,
  weakEngine: EngineKey | null,
  strongEngine: EngineKey | null,
): OperationTask[] {
  const selected: OperationTask[] = [];
  const usedIds = new Set<number>();

  // Load all engine tasks
  const allTasks: Record<EngineKey, Task[]> = { body: [], mind: [], money: [], charisma: [] };
  for (const engine of ENGINES) {
    allTasks[engine] = getJSON<Task[]>(`tasks:${engine}`, []).filter((t) => t.is_active === 1);
  }

  // Load yesterday's assigned tasks to find skipped ones
  const yesterday = addDays(getTodayKey(), -1);
  const yesterdayAssigned = getJSON<number[]>(`${ASSIGNED_KEY_PREFIX}ids:${yesterday}`, []);
  const yesterdayCompleted = getJSON<number[]>(`${COMPLETED_KEY_PREFIX}ids:${yesterday}`, []);
  const skippedIds = new Set(yesterdayAssigned.filter((id) => !yesterdayCompleted.includes(id)));

  // Load recently assigned to avoid repeats
  const recentlyAssigned = getJSON<Record<number, number>>(LAST_ASSIGNED_KEY, {}); // id -> consecutive days

  // Helper to add a task
  function addTask(task: Task, engine: EngineKey, isReassigned: boolean): boolean {
    if (usedIds.has(task.id!) || selected.length >= targetCount) return false;

    // Don't assign same task 3 days in a row unless it's the only option
    const consecutiveDays = recentlyAssigned[task.id!] ?? 0;
    if (consecutiveDays >= 3 && allTasks[engine].length > 1) return false;

    usedIds.add(task.id!);
    selected.push({
      id: task.id!,
      engine,
      title: task.title,
      kind: task.kind,
      xp: task.kind === "main" ? 20 : 10,
      isReassigned,
    });
    return true;
  }

  // Priority 1: Skipped tasks from yesterday (re-assigned)
  for (const engine of ENGINES) {
    for (const task of allTasks[engine]) {
      if (skippedIds.has(task.id!)) {
        addTask(task, engine, true);
      }
    }
  }

  // Priority 2: Main missions from weakest engine
  if (weakEngine && (operationType === "ENGINE_RECOVERY" || operationType === "REBALANCE")) {
    const weakMains = allTasks[weakEngine].filter((t) => t.kind === "main");
    for (const task of weakMains) {
      addTask(task, weakEngine, false);
    }
    // Also add side quests from weak engine if not enough
    const weakSides = allTasks[weakEngine].filter((t) => t.kind === "secondary");
    for (const task of weakSides) {
      addTask(task, weakEngine, false);
    }
  }

  // Priority 3: Main missions from all engines (rotating)
  const engineOrder = weakEngine
    ? [weakEngine, ...ENGINES.filter((e) => e !== weakEngine)]
    : [...ENGINES];

  for (const engine of engineOrder) {
    const mains = allTasks[engine].filter((t) => t.kind === "main");
    for (const task of mains) {
      addTask(task, engine, false);
    }
  }

  // Priority 4: Side quests to fill remaining slots
  for (const engine of engineOrder) {
    const sides = allTasks[engine].filter((t) => t.kind === "secondary");
    for (const task of sides) {
      addTask(task, engine, false);
    }
  }

  return selected;
}

// ─── Protocol Message Generation ──────────────────────────────────────────────

function generateProtocolMessage(
  userName: string,
  operationType: OperationType,
  consistency: ConsistencyLevel,
  consistencyRate: number,
  weakEngine: EngineKey | null,
  strongEngine: EngineKey | null,
  streak: number,
  dayNumber: number,
  reassignedCount: number,
): string {
  const ENGINE_NAMES: Record<EngineKey, string> = {
    body: "Body", mind: "Mind", money: "Money", charisma: "Charisma",
  };

  const name = userName || "Recruit";

  switch (operationType) {
    case "FIRST_LIGHT":
      return `${name}. Your engines are offline. Today we change that.`;

    case "MAINTAIN_PRESSURE":
      return `${name}. Day ${dayNumber}. Your consistency is at ${consistencyRate}%. Maintain this pressure. No days off.`;

    case "ENGINE_RECOVERY":
      return `${name}. Your ${ENGINE_NAMES[weakEngine!]} engine is critically low. Today's operation focuses on bringing it back online. No excuses.`;

    case "MOMENTUM":
      return `${name}. ${streak}-day streak. ${consistencyRate}% consistency. You're building something real. Don't let up now.`;

    case "RECOVERY":
      return `${name}. Welcome back. The protocol remembers your progress. Pick up where you left off. Today is recovery day.`;

    case "REBUILD":
      return `${name}. First day. No history, no excuses. The protocol starts now. Show me what you've got.`;

    case "FULL_SPECTRUM":
      return `${name}. All engines above 70%. This is rare. Today: maintain across the board. Prove yesterday wasn't a fluke.`;

    case "REBALANCE":
      return `${name}. Your ${ENGINE_NAMES[strongEngine!]} is strong. But your ${ENGINE_NAMES[weakEngine!]} is falling behind. A Titan has no weak engines. Fix it.`;

    case "REFOCUS":
      return `${name}. Your consistency dropped to ${consistencyRate}%. I'm reducing today's load. Fewer tasks. More intention. Show me you're serious.`;

    default:
      return `${name}. Day ${dayNumber}. Execute.`;
  }
}

// ─── Main Function ────────────────────────────────────────────────────────────

const CACHED_OP_KEY = "operation_cached_today";

export function generateDailyOperation(
  userName: string,
  dayNumber: number,
  streak: number,
  phase: string,
): DailyOperation {
  // Return cached operation for today if available (prevents tasks changing on restart)
  const today = getTodayKey();
  const cached = getJSON<{ dateKey: string; operation: DailyOperation } | null>(CACHED_OP_KEY, null);
  if (cached && cached.dateKey === today && cached.operation) {
    return cached.operation;
  }

  const { rate: consistencyRate, level: consistency } = calculateConsistency();
  const scores = getEngineScores();
  const weakEngine = findWeakEngine(scores);
  const strongEngine = findStrongEngine(scores);

  // Update consecutive high days tracking
  const consecutiveHighDays = getJSON<number>("consecutive_high_days", 0);
  if (consistency === "HIGH") {
    setJSON("consecutive_high_days", consecutiveHighDays + 1);
  } else {
    setJSON("consecutive_high_days", 0);
  }

  const operationType = selectOperationType(scores, consistency, streak, dayNumber);
  const taskCount = calculateTaskCount(dayNumber, consistency, phase);
  const tasks = selectTasks(taskCount, operationType, weakEngine, strongEngine);

  const reassignedCount = tasks.filter((t) => t.isReassigned).length;
  const protocolMessage = generateProtocolMessage(
    userName, operationType, consistency, consistencyRate,
    weakEngine, strongEngine, streak, dayNumber, reassignedCount,
  );

  const opInfo = OPERATION_NAMES[operationType];

  // Track what was assigned today (today already declared above from cache check)
  setJSON(`${ASSIGNED_KEY_PREFIX}${today}`, tasks.length);
  setJSON(`${ASSIGNED_KEY_PREFIX}ids:${today}`, tasks.map((t) => t.id));

  // Update recently assigned tracking
  const newRecent: Record<number, number> = {};
  const oldRecent = getJSON<Record<number, number>>(LAST_ASSIGNED_KEY, {});
  for (const t of tasks) {
    newRecent[t.id] = (oldRecent[t.id] ?? 0) + 1;
  }
  setJSON(LAST_ASSIGNED_KEY, newRecent);

  const operation: DailyOperation = {
    name: operationType,
    displayName: opInfo.display,
    subtitle: opInfo.subtitle,
    tasks,
    protocolMessage,
    consistency,
    consistencyRate,
    weakEngine,
    strongEngine,
    taskCount,
    dayNumber,
  };

  // Cache for today so operation stays stable across app restarts
  setJSON(CACHED_OP_KEY, { dateKey: today, operation });

  return operation;
}

// ─── Track Completion (call after task toggle) ────────────────────────────────

export function trackOperationCompletion(completedTaskIds: number[]): void {
  const today = getTodayKey();
  setJSON(`${COMPLETED_KEY_PREFIX}${today}`, completedTaskIds.length);
  setJSON(`${COMPLETED_KEY_PREFIX}ids:${today}`, completedTaskIds);
}
