import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUserId } from "../../lib/session";
import {
  listMindTrainingResults,
  recordMindResult,
} from "../../services/mind-training";
import type { MindTrainingResult } from "../../services/mind-training";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const mindTrainingKeys = {
  results: ["mind_training_results"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useMindTrainingResults() {
  const userId = useCurrentUserId();
  return useQuery({
    queryKey: mindTrainingKeys.results,
    queryFn: listMindTrainingResults,
    enabled: Boolean(userId),
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * Screens call: mutate({ exerciseId, type, category, correct, selectedOption, timeSpentMs })
 * Service converts camelCase to snake_case for the DB insert.
 */
export function useRecordMindResult() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: recordMindResult,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: mindTrainingKeys.results });
    },
  });
}
