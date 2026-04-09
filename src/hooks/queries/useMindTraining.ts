/**
 * Phase 4: Mind training query hooks (results + SRS cards).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  listDueSrsCards,
  listMindTrainingResults,
  listSrsCards,
  recordMindResult,
  reviewSrsCard,
  upsertSrsCard,
  type MindTrainingResult,
  type RecordResultInput,
  type SrsCard,
  type UpsertSrsCardInput,
} from "../../services/mind-training";

// ─── Results ────────────────────────────────────────────────────────────────

export const mindResultsKeys = {
  all: ["mind_training_results"] as const,
  list: (rangeDays?: number) =>
    rangeDays
      ? (["mind_training_results", "list", rangeDays] as const)
      : (["mind_training_results", "list"] as const),
};

export function useMindTrainingResults(rangeDays?: number) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<MindTrainingResult[]>({
    queryKey: mindResultsKeys.list(rangeDays),
    queryFn: () => listMindTrainingResults(rangeDays),
    enabled: Boolean(userId),
  });
}

export function useRecordMindResult() {
  const qc = useQueryClient();
  return useMutation<MindTrainingResult, Error, RecordResultInput>({
    mutationFn: recordMindResult,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: mindResultsKeys.all });
    },
  });
}

// ─── SRS cards ──────────────────────────────────────────────────────────────

export const srsKeys = {
  all: ["srs_cards"] as const,
  list: () => ["srs_cards", "list"] as const,
  due: () => ["srs_cards", "due"] as const,
};

export function useSrsCards() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<SrsCard[]>({
    queryKey: srsKeys.list(),
    queryFn: listSrsCards,
    enabled: Boolean(userId),
  });
}

export function useDueSrsCards() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<SrsCard[]>({
    queryKey: srsKeys.due(),
    queryFn: listDueSrsCards,
    enabled: Boolean(userId),
  });
}

export function useUpsertSrsCard() {
  const qc = useQueryClient();
  return useMutation<SrsCard, Error, UpsertSrsCardInput>({
    mutationFn: upsertSrsCard,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: srsKeys.all });
    },
  });
}

export function useReviewSrsCard() {
  const qc = useQueryClient();
  return useMutation<
    SrsCard,
    Error,
    { exerciseId: string; patch: Parameters<typeof reviewSrsCard>[1] }
  >({
    mutationFn: ({ exerciseId, patch }) => reviewSrsCard(exerciseId, patch),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: srsKeys.all });
    },
  });
}
