"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Task, type EngineKey } from "@/lib/db";

/** Extended task type with backward-compat `priority` alias and `completed` flag */
type TaskWithPriority = Task & { priority: "main" | "secondary" };
type TaskWithCompletion = TaskWithPriority & { completed: boolean };

const EMPTY_TASKS: TaskWithPriority[] = [];

export type UseEngineTasksResult = {
  tasks: TaskWithPriority[];
  tasksWithCompletion: TaskWithCompletion[];
  completedIds: Set<number>;
  isLoading: boolean;
};

function useEngineTasksInternal(engine: EngineKey, dateKey: string): UseEngineTasksResult {
  const rawTasks = useLiveQuery(
    () => db.tasks.where({ engine }).filter((t) => t.isActive !== false).toArray(),
    [engine],
  );
  const tasks: TaskWithPriority[] = React.useMemo(
    () => (rawTasks ?? []).map((t) => ({ ...t, priority: t.kind })),
    [rawTasks],
  );

  const rawCompletions = useLiveQuery(
    () => db.completions.where("[engine+dateKey]").equals([engine, dateKey]).toArray(),
    [engine, dateKey],
  );
  const completedIds = React.useMemo(
    () => new Set((rawCompletions ?? []).map((c) => c.taskId)),
    [rawCompletions],
  );

  const tasksWithCompletion: TaskWithCompletion[] = React.useMemo(
    () => tasks.map((task) => ({ ...task, completed: completedIds.has(task.id ?? -1) })),
    [tasks, completedIds],
  );

  return { tasks, tasksWithCompletion, completedIds, isLoading: rawTasks === undefined };
}

export function useBodyTasks(dateKey: string): UseEngineTasksResult {
  return useEngineTasksInternal("body", dateKey);
}

export function useMoneyTasks(dateKey: string): UseEngineTasksResult {
  return useEngineTasksInternal("money", dateKey);
}

export function useGeneralTasks(dateKey: string): UseEngineTasksResult {
  return useEngineTasksInternal("general", dateKey);
}

export function useMindTasks(dateKey: string): UseEngineTasksResult {
  return useEngineTasksInternal("mind", dateKey);
}
