import type { EngineKey } from "./engines";

export type DayScore = {
  percent: number;
  mainDone: number;
  mainTotal: number;
  secondaryDone: number;
  secondaryTotal: number;
  pointsDone: number;
  pointsTotal: number;
};

export type TitanScore = {
  percent: number;
  perEngine: Record<EngineKey, DayScore>;
  enginesActiveCount: number;
};

export type ConsistencyResult = {
  percent: number;
  consistentDays: number;
  totalDays: number;
  currentStreak: number;
  bestStreak: number;
};
