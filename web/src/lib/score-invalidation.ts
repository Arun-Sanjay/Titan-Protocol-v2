/**
 * Centralized score-cache invalidation.
 *
 * Anything that changes a task or a completion changes every score the
 * UI displays — the per-engine score, the daily Titan score, the week
 * sparklines, the analytics range, and the dashboard's planning model.
 *
 * Each of those lives behind its own React Query key (see
 * `hooks/useScoreMap.ts` and `app/(os)/components/DailyPlanningProvider.tsx`).
 * Forgetting to invalidate any one of them leaves stale data on screen
 * after a mutation — the user completes a task and the Titan Score
 * widget stays at the old number until the staleTime expires or they
 * navigate away.
 *
 * Mutations call `invalidateScoring(qc)` after a successful write.
 * Realtime calls it when a `completions` or `tasks` row changes from
 * another device.
 *
 * Keys covered:
 *   - `["scoreMap", ...]`     — calendar heatmaps + monthly Titan score
 *   - `["dashboard", ...]`    — Dashboard week sparklines / comparison
 *   - `["analytics", ...]`    — Analytics range snapshot
 *   - `["dailyPlanning", ...]` — Dashboard Titan Score + at-risk + actions
 */

import type { QueryClient } from "@tanstack/react-query";

/** Top-level query-key prefixes that derive from `tasks` + `completions`. */
export const SCORING_KEY_ROOTS = [
  "scoreMap",
  "dashboard",
  "analytics",
  "dailyPlanning",
] as const;

export function invalidateScoring(qc: QueryClient): void {
  for (const root of SCORING_KEY_ROOTS) {
    qc.invalidateQueries({ queryKey: [root] });
  }
}

/** True when a Realtime-arrived change to this table should invalidate scoring. */
export function tableAffectsScoring(table: string): boolean {
  return table === "completions" || table === "tasks";
}
