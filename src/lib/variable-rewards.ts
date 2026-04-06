/**
 * Variable reward system — random multipliers, perfect day XP
 */

export function getDailyMultiplier(_dateKey: string): {
  engine: string;
  multiplier: number;
} {
  // TODO: Implement deterministic daily multiplier
  return { engine: "body", multiplier: 1 };
}

export function getPerfectDayXP(_dateKey: string): number {
  // TODO: Implement random XP between 100-500
  return 100;
}
