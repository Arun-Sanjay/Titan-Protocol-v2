/**
 * Phase 4: Titan mode query hooks.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  getTitanModeState,
  recordDay,
  upsertTitanModeState,
  type TitanModeState,
  type UpsertTitanModeInput,
} from "../../services/titan-mode";

export const titanModeKey = ["titan_mode"] as const;

export function useTitanMode() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<TitanModeState | null>({
    queryKey: titanModeKey,
    queryFn: getTitanModeState,
    enabled: Boolean(userId),
  });
}

export function useUpsertTitanMode() {
  const qc = useQueryClient();
  return useMutation<TitanModeState, Error, UpsertTitanModeInput>({
    mutationFn: upsertTitanModeState,
    onSuccess: (state) => {
      qc.setQueryData<TitanModeState | null>(titanModeKey, state);
    },
  });
}

export function useRecordTitanDay() {
  const qc = useQueryClient();
  return useMutation<TitanModeState, Error, number>({
    mutationFn: recordDay,
    onSuccess: (state) => {
      qc.setQueryData<TitanModeState | null>(titanModeKey, state);
    },
  });
}
