/**
 * Phase 4.1: Re-export pure weight helpers/types so screens can import
 * them without pulling in the Zustand store file.
 */

export {
  getMovingAverage,
  getWeeklyRate,
  getGoalETA,
  getTrend,
  isValidWeight,
  type WeightEntry,
  type GoalProgress,
  type WeightTrend,
} from "../stores/useWeightStore";
