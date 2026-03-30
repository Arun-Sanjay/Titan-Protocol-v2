// ─── Types (mirrored from web for data compat) ────────────────────────────
export type EngineKey = "body" | "mind" | "money" | "general";

export type Task = {
  id?: number;
  engine: EngineKey;
  title: string;
  kind: "main" | "secondary";
  created_at: number;
  days_per_week: number;
  is_active: number; // 1 = true, 0 = false (SQLite has no bool)
};

export type Completion = {
  id?: number;
  engine: EngineKey;
  task_id: number;
  date_key: string;
};

export type EngineMeta = {
  id: EngineKey;
  start_date: string;
  created_at: number;
};

export type Habit = {
  id?: number;
  title: string;
  engine: string;
  icon: string;
  created_at: number;
  trigger?: string;         // Implementation intention: "After waking up"
  duration?: string;        // e.g. "30 min"
  frequency?: string;       // e.g. "daily"
};

export type HabitLog = {
  id?: number;
  habit_id: number;
  date_key: string;
  completed: number;
};

export type JournalEntry = {
  date_key: string;
  content: string;
  updated_at: number;
};

export type Goal = {
  id?: number;
  title: string;
  engine: string;
  type: "consistency" | "count" | "value";
  target: number;
  unit: string;
  deadline: string;
  created_at: number;
  threshold?: number;
};

export type GoalTask = {
  id?: number;
  goal_id: number;
  title: string;
  task_type: string;
  engine: string | null;
  completed: number;
  created_at: number;
};

// ─── XP & Gamification ────────────────────────────────────────────────────
export type UserProfile = {
  id: "default";
  xp: number;
  level: number;
  streak: number;
  best_streak: number;
  last_active_date: string;
};

export type XPEvent = {
  id?: number;
  date_key: string;
  source: string; // e.g. "task_complete", "streak_bonus", "habit_complete"
  amount: number;
  created_at: number;
};

export type DailyScore = {
  date_key: string;
  engine: EngineKey;
  score: number; // 0-100
};
