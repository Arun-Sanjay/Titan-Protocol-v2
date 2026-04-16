import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  getProtocolSession,
  saveMorningSession,
  saveEveningSession,
  type ProtocolSession,
} from "../../services/protocol";
import type { Json } from "../../types/supabase";
import { runAchievementCheck } from "../../lib/achievement-integration";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const protocolKeys = {
  session: (dateKey: string) => ["protocol_session", dateKey] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useProtocolSession(dateKey?: string) {
  const userId = useAuthStore((s) => s.user?.id);
  const key = dateKey ?? new Date().toISOString().slice(0, 10);

  return useQuery({
    queryKey: protocolKeys.session(key),
    queryFn: () => getProtocolSession(key),
    enabled: Boolean(userId),
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * Screens call: mutateAsync({ dateKey, intention })
 */
export function useSaveMorningSession() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (params: { dateKey: string; intention: string }) =>
      saveMorningSession(params),
    onMutate: async (vars) => {
      const key = protocolKeys.session(vars.dateKey);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<ProtocolSession | null>(key);
      // Optimistic: mark morning as completed
      qc.setQueryData<ProtocolSession | null>(key, (old) =>
        old
          ? {
              ...old,
              morning_intention: vars.intention,
              morning_completed_at: new Date().toISOString(),
            }
          : null,
      );
      return { prev };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(protocolKeys.session(vars.dateKey), ctx.prev);
      }
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: protocolKeys.session(vars.dateKey) });
      // Fire-and-forget achievement check after morning protocol settles
      runAchievementCheck(qc).catch(() => {});
    },
  });
}

/**
 * Screens call: mutateAsync({ dateKey, reflection, titanScore?, identityVote?, habitChecks? })
 */
export function useSaveEveningSession() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      dateKey: string;
      reflection: string;
      titanScore?: number;
      identityVote?: string | null;
      habitChecks?: Json;
    }) => saveEveningSession(params),
    onMutate: async (vars) => {
      const key = protocolKeys.session(vars.dateKey);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<ProtocolSession | null>(key);
      qc.setQueryData<ProtocolSession | null>(key, (old) =>
        old
          ? {
              ...old,
              evening_reflection: vars.reflection,
              evening_completed_at: new Date().toISOString(),
              titan_score: vars.titanScore ?? old.titan_score,
            }
          : null,
      );
      return { prev };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(protocolKeys.session(vars.dateKey), ctx.prev);
      }
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: protocolKeys.session(vars.dateKey) });
      // Fire-and-forget achievement check after evening protocol settles
      runAchievementCheck(qc).catch(() => {});
    },
  });
}
