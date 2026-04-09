/**
 * Phase 4: Achievements query hooks.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  listUnlockedAchievements,
  unlockAchievement,
  unlockAchievements,
  type AchievementUnlock,
} from "../../services/achievements";

export const achievementsKeys = {
  all: ["achievements_unlocked"] as const,
  list: () => ["achievements_unlocked", "list"] as const,
};

export function useUnlockedAchievements() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<AchievementUnlock[]>({
    queryKey: achievementsKeys.list(),
    queryFn: listUnlockedAchievements,
    enabled: Boolean(userId),
  });
}

export function useUnlockAchievement() {
  const qc = useQueryClient();
  return useMutation<AchievementUnlock, Error, string>({
    mutationFn: unlockAchievement,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: achievementsKeys.all });
    },
  });
}

export function useUnlockAchievements() {
  const qc = useQueryClient();
  return useMutation<number, Error, string[]>({
    mutationFn: unlockAchievements,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: achievementsKeys.all });
    },
  });
}
