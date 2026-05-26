import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  listPendingRankUps,
  enqueueRankUp,
  dismissRankUp,
  type RankUpEvent,
} from "../../services/rank-ups";

// ─── Query Keys ─────────────────────────────────────────────────────────────

const rankUpsKeys = {
  pending: ["rank_ups", "pending"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function usePendingRankUps() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: rankUpsKeys.pending,
    queryFn: listPendingRankUps,
    enabled: Boolean(userId),
  });
}

/**
 * Soft-dismiss: sets dismissed_at instead of deleting.
 * Optimistic: removes from cache immediately.
 */
export function useDismissRankUp() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: dismissRankUp,
    onMutate: async (eventId) => {
      await qc.cancelQueries({ queryKey: rankUpsKeys.pending });
      const prev = qc.getQueryData<RankUpEvent[]>(rankUpsKeys.pending);
      qc.setQueryData<RankUpEvent[]>(rankUpsKeys.pending, (old) =>
        old?.filter((e) => e.id !== eventId) ?? [],
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(rankUpsKeys.pending, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: rankUpsKeys.pending });
    },
  });
}

/**
 * Enqueue a new rank-up event.
 * Called by screens after useAwardXP detects leveledUp.
 */
export function useEnqueueRankUp() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: enqueueRankUp,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rankUpsKeys.pending });
    },
  });
}
