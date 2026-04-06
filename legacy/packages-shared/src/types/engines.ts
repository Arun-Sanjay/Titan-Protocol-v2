/**
 * Core engine types shared between web and mobile apps.
 * These define the data model — storage adapters differ per platform.
 */

export type EngineKey = "body" | "mind" | "money" | "general";

export type EngineMeta = {
  id: EngineKey;
  startDate: string;
  createdAt: number;
};

export type Task = {
  id?: number;
  engine: EngineKey;
  title: string;
  kind: "main" | "secondary";
  createdAt: number;
  daysPerWeek?: number;
  isActive?: boolean;
};

export type Completion = {
  id?: number;
  engine: EngineKey;
  taskId: number;
  dateKey: string;
};
