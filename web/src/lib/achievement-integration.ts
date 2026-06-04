/**
 * Achievement integration — web stub.
 *
 * Mobile implements an achievement checker that runs after every task /
 * habit / protocol mutation to detect newly-unlocked achievements and
 * persist them. The checker and its supporting services exist on mobile
 * but haven't been ported to web yet — see `mobile/src/lib/achievement-
 * integration.ts` and `mobile/src/lib/achievement-checker.ts` for the
 * full implementation.
 *
 * For now `runAchievementCheck` is a fire-and-forget no-op so the ported
 * hooks compile and function. Completing tasks works; achievements just
 * won't auto-unlock until this is filled in.
 *
 * TODO: port the mobile checker. Tracked in ROADMAP.md under Phase 4+.
 */

import type { QueryClient } from "@tanstack/react-query";

export async function runAchievementCheck(
  _queryClient: QueryClient,
): Promise<void> {
  // intentionally empty
}
