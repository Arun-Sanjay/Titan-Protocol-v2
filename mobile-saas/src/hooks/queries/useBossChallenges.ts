import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  abandonBossChallenge,
  listActiveBossChallenges,
  recordBossDay,
  startBossChallenge,
  type BossChallenge,
} from "../../services/boss-challenges";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const bossChallengesKeys = {
  active: ["boss_challenges", "active"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useActiveBossChallenges() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: bossChallengesKeys.active,
    queryFn: listActiveBossChallenges,
    enabled: Boolean(userId),
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * Screens call: mutate({ bossId, daysRequired, evaluatorType })
 * Service expects snake_case: { boss_id, days_required, evaluator_type }
 */
export function useStartBossChallenge() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: {
      bossId: string;
      daysRequired: number;
      evaluatorType: string;
    }) => {
      return startBossChallenge({
        boss_id: vars.bossId,
        days_required: vars.daysRequired,
        evaluator_type: vars.evaluatorType,
      });
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: bossChallengesKeys.active });
      const prev = qc.getQueryData<BossChallenge[]>(
        bossChallengesKeys.active,
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev)
        qc.setQueryData(bossChallengesKeys.active, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: bossChallengesKeys.active });
    },
  });
}

/**
 * Append today's pass/fail to an active boss. The mutation result tells
 * the caller whether the boss was just resolved so the UI can fire the
 * defeat/fail cinematic and award XP.
 */
export function useRecordBossDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; passed: boolean }) =>
      recordBossDay(vars),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: bossChallengesKeys.active });
    },
  });
}

/** Manually abandon an active boss. */
export function useAbandonBossChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => abandonBossChallenge(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: bossChallengesKeys.active });
    },
  });
}
