/**
 * Phase 3.3f: Rank-up events query hooks.
 *
 * Wraps src/services/rank-ups.ts. The root layout's LevelUpOverlay
 * subscribes to usePendingRankUps() and renders the head of the list
 * until the user dismisses it — same pattern as Phase 2.1E but with
 * Supabase as the source of truth instead of MMKV.
 *
 * Why this matters: if a user levels up on device A, then switches
 * to device B before the overlay shows, the overlay still fires on
 * device B because the queue lives on the server. The Phase 2.1E
 * MMKV-backed queue only worked per-device.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  dismissRankUp,
  enqueueRankUp,
  listPendingRankUps,
  type EnqueueRankUpInput,
  type RankUpEvent,
} from "../../services/rank-ups";

export const rankUpsKeys = {
  all: ["rank_ups"] as const,
  pending: () => ["rank_ups", "pending"] as const,
};

export function usePendingRankUps() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<RankUpEvent[]>({
    queryKey: rankUpsKeys.pending(),
    queryFn: listPendingRankUps,
    enabled: Boolean(userId),
    // Refetch on reconnect so a rank-up enqueued on another device
    // shows up once this device comes back online.
    refetchOnReconnect: true,
  });
}

export function useEnqueueRankUp() {
  const queryClient = useQueryClient();
  return useMutation<RankUpEvent, Error, EnqueueRankUpInput>({
    mutationFn: enqueueRankUp,
    onSuccess: (event) => {
      // Append to the pending list so the overlay picks it up immediately.
      queryClient.setQueryData<RankUpEvent[]>(
        rankUpsKeys.pending(),
        (list) => (list ? [...list, event] : [event]),
      );
    },
  });
}

type DismissContext = { previous: RankUpEvent[] | undefined };

export function useDismissRankUp() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string, DismissContext>({
    mutationFn: dismissRankUp,
    onMutate: async (eventId) => {
      // Optimistically drop the event from the pending list so the
      // overlay dismisses instantly without waiting for the server.
      await queryClient.cancelQueries({ queryKey: rankUpsKeys.pending() });
      const previous = queryClient.getQueryData<RankUpEvent[]>(
        rankUpsKeys.pending(),
      );
      queryClient.setQueryData<RankUpEvent[]>(
        rankUpsKeys.pending(),
        (list) => list?.filter((e) => e.id !== eventId) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(rankUpsKeys.pending(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: rankUpsKeys.pending() });
    },
  });
}
