export type Habit = {
  id?: number;
  title: string;
  engine: "body" | "mind" | "money" | "general" | "all";
  icon: string;
  createdAt: number;
};

export type HabitLog = {
  id?: number;
  habitId: number;
  dateKey: string;
  completed: boolean;
};

export type JournalEntry = {
  dateKey: string;
  content: string;
  updatedAt: number;
};

export type Goal = {
  id?: number;
  title: string;
  engine: "body" | "mind" | "money" | "general" | "all" | "habits";
  type: "consistency" | "count" | "value";
  target: number;
  unit: string;
  deadline: string;
  createdAt: number;
  threshold?: number;
};

export type GoalTask = {
  id?: number;
  goalId: number;
  title: string;
  taskType?: "daily" | "once";
  engine?: "body" | "mind" | "money" | "general" | null;
  engineTaskRefId?: string | null;
  completed: boolean;
  createdAt: number;
};

export type FocusSettings = {
  id: "default";
  focusMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  longBreakAfter: number;
  dailyTarget: number;
};

export type FocusDaily = {
  dateKey: string;
  completedSessions: number;
};

export type DeepWorkTask = {
  id?: number;
  taskName: string;
  category: "Main Job / College" | "Side Hustle" | "Freelance" | "Investments" | "Other";
  createdAt: number;
};

export type DeepWorkLog = {
  id?: number;
  taskId: number;
  dateKey: string;
  completed: boolean;
  earningsToday: number;
};

export type Achievement = {
  id?: number;
  type: string;
  unlockedAt: number;
};
