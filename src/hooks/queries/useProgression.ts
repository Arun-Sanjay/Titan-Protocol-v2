/**
 * Phase 4: Progression / phase query hooks.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  advancePhase,
  getProgression,
  upsertProgression,
  type AdvancePhaseInput,
  type ProgressionRow,
  type UpsertProgressionInput,
} from "../../services/progression";

export const progressionKey = ["progression"] as const;

export function useProgression() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<ProgressionRow | null>({
    queryKey: progressionKey,
    queryFn: getProgression,
    enabled: Boolean(userId),
  });
}

export function useUpsertProgression() {
  const qc = useQueryClient();
  return useMutation<ProgressionRow, Error, UpsertProgressionInput>({
    mutationFn: upsertProgression,
    onSuccess: (row) => {
      qc.setQueryData<ProgressionRow | null>(progressionKey, row);
    },
  });
}

export function useAdvancePhase() {
  const qc = useQueryClient();
  return useMutation<ProgressionRow, Error, AdvancePhaseInput>({
    mutationFn: advancePhase,
    onSuccess: (row) => {
      qc.setQueryData<ProgressionRow | null>(progressionKey, row);
    },
  });
}
