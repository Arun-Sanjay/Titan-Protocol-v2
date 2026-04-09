/**
 * Phase 4: Boss challenges query hooks.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  getBossChallenge,
  listActiveBossChallenges,
  recordBossDay,
  resolveBossChallenge,
  startBossChallenge,
  type BossChallenge,
  type RecordBossDayInput,
  type StartBossInput,
} from "../../services/boss-challenges";

export const bossKeys = {
  all: ["boss_challenges"] as const,
  active: () => ["boss_challenges", "active"] as const,
  byId: (bossId: string) => ["boss_challenges", "boss_id", bossId] as const,
};

export function useActiveBossChallenges() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<BossChallenge[]>({
    queryKey: bossKeys.active(),
    queryFn: listActiveBossChallenges,
    enabled: Boolean(userId),
  });
}

export function useBossChallenge(bossId: string) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<BossChallenge | null>({
    queryKey: bossKeys.byId(bossId),
    queryFn: () => getBossChallenge(bossId),
    enabled: Boolean(userId) && Boolean(bossId),
  });
}

export function useStartBossChallenge() {
  const qc = useQueryClient();
  return useMutation<BossChallenge, Error, StartBossInput>({
    mutationFn: startBossChallenge,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: bossKeys.all });
    },
  });
}

export function useRecordBossDay() {
  const qc = useQueryClient();
  return useMutation<BossChallenge, Error, RecordBossDayInput>({
    mutationFn: recordBossDay,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: bossKeys.all });
    },
  });
}

export function useResolveBossChallenge() {
  const qc = useQueryClient();
  return useMutation<
    BossChallenge,
    Error,
    { id: string; status: "defeated" | "failed" | "abandoned" }
  >({
    mutationFn: ({ id, status }) => resolveBossChallenge(id, status),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: bossKeys.all });
    },
  });
}
