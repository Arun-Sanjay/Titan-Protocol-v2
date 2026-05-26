import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import { listUnlockedAchievements } from "../../services/achievements";
import type { AchievementUnlocked } from "../../services/achievements";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const achievementsKeys = {
  unlocked: ["achievements_unlocked"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useUnlockedAchievements() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: achievementsKeys.unlocked,
    queryFn: listUnlockedAchievements,
    enabled: Boolean(userId),
  });
}
