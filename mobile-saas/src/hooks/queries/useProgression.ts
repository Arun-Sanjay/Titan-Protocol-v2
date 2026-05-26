import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  getProgression,
  upsertProgression,
  type Progression,
} from "../../services/progression";
import type { Json } from "../../types/supabase";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const progressionKeys = {
  all: ["progression"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useProgression() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: progressionKeys.all,
    queryFn: getProgression,
    enabled: Boolean(userId),
  });
}

/**
 * Update the progression row (phase advancement, week change, etc.).
 * Optimistic: updates the cache immediately.
 */
export function useUpdateProgression() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      current_phase?: string;
      current_week?: number;
      phase_start_week?: number;
      first_use_date?: string;
      phase_start_date?: string;
      phase_history?: Json;
    }) => upsertProgression(params),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: progressionKeys.all });
      const prev = qc.getQueryData<Progression | null>(progressionKeys.all);
      if (prev) {
        qc.setQueryData<Progression | null>(progressionKeys.all, {
          ...prev,
          ...vars,
          updated_at: new Date().toISOString(),
        } as Progression);
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(progressionKeys.all, ctx.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: progressionKeys.all });
    },
  });
}
