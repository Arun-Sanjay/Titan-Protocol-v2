import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  getProtocolSession,
  saveMorningSession,
  saveEveningSession,
  type ProtocolSession,
  type SaveSessionResult,
} from "../../services/protocol";
import type { Json } from "../../types/supabase";
import { runAchievementCheck } from "../../lib/achievement-integration";
import { getTodayKey } from "../../lib/date";
import { recordCompletion } from "../../lib/protocol-integrity";

// Re-export so screens can type the awaited result.
export type { SaveSessionResult } from "../../services/protocol";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const protocolKeys = {
  session: (dateKey: string) => ["protocol_session", dateKey] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useProtocolSession(dateKey?: string) {
  const userId = useAuthStore((s) => s.user?.id);
  const key = dateKey ?? getTodayKey();

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
      // Optimistic: only mark morning as completed when it's not already.
      // If it is, leave the cache alone so we don't show a misleading
      // updated state for an idempotent no-op.
      if (!prev?.morning_completed_at) {
        qc.setQueryData<ProtocolSession | null>(key, (old) =>
          old
            ? {
                ...old,
                morning_intention: vars.intention,
                morning_completed_at: new Date().toISOString(),
              }
            : null,
        );
      }
      return { prev };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(protocolKeys.session(vars.dateKey), ctx.prev);
      }
    },
    onSuccess: () => {
      // Morning protocol counts as engagement for the progress day.
      recordCompletion();
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
      // Same idempotency as morning: skip optimistic stomp if already done.
      if (!prev?.evening_completed_at) {
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
      }
      return { prev };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(protocolKeys.session(vars.dateKey), ctx.prev);
      }
    },
    onSuccess: () => {
      // Evening protocol also counts as engagement (covers the case
      // where a user skips tasks but still does the evening reflection).
      recordCompletion();
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: protocolKeys.session(vars.dateKey) });
      // Fire-and-forget achievement check after evening protocol settles
      runAchievementCheck(qc).catch(() => {});
    },
  });
}
