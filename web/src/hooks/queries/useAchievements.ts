import { useQuery } from "@tanstack/react-query";
import { useCurrentUserId } from "../../lib/session";
import { listUnlockedAchievements } from "../../services/achievements";
import type { AchievementUnlocked } from "../../services/achievements";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const achievementsKeys = {
  unlocked: ["achievements_unlocked"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useUnlockedAchievements() {
  const userId = useCurrentUserId();
  return useQuery({
    queryKey: achievementsKeys.unlocked,
    queryFn: listUnlockedAchievements,
    enabled: Boolean(userId),
  });
}
