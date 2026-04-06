export const RANKS = [
  "Initiate",
  "Operator",
  "Specialist",
  "Vanguard",
  "Sentinel",
  "Titan",
] as const;

export type Rank = (typeof RANKS)[number];

/** Points per task type */
export const MAIN_TASK_POINTS = 2;
export const SECONDARY_TASK_POINTS = 1;

/** Consistency threshold (60% = "consistent day") */
export const CONSISTENCY_THRESHOLD = 60;

/** Engine keys */
export const ENGINES: readonly ["body", "mind", "money", "general"] = [
  "body",
  "mind",
  "money",
  "general",
] as const;
