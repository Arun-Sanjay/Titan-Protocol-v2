import type { Rank } from "./ranks";

/** XP thresholds for each rank */
export const RANK_THRESHOLDS: Record<Rank, number> = {
  Initiate: 0,
  Operator: 500,
  Specialist: 2000,
  Vanguard: 5000,
  Sentinel: 12000,
  Titan: 25000,
};
