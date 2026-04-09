/**
 * Phase 4: Quests query hooks.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  completeQuest,
  createQuest,
  failQuest,
  listAllActiveQuests,
  listQuestsForWeek,
  updateQuestProgress,
  type CreateQuestInput,
  type Quest,
  type UpdateQuestProgressInput,
} from "../../services/quests";

export const questsKeys = {
  all: ["quests"] as const,
  byWeek: (weekStartKey: string) => ["quests", "week", weekStartKey] as const,
  active: () => ["quests", "active"] as const,
};

export function useQuestsForWeek(weekStartKey: string) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<Quest[]>({
    queryKey: questsKeys.byWeek(weekStartKey),
    queryFn: () => listQuestsForWeek(weekStartKey),
    enabled: Boolean(userId),
  });
}

export function useActiveQuests() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<Quest[]>({
    queryKey: questsKeys.active(),
    queryFn: listAllActiveQuests,
    enabled: Boolean(userId),
  });
}

export function useCreateQuest() {
  const qc = useQueryClient();
  return useMutation<Quest, Error, CreateQuestInput>({
    mutationFn: createQuest,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: questsKeys.all });
    },
  });
}

export function useUpdateQuestProgress() {
  const qc = useQueryClient();
  return useMutation<Quest, Error, UpdateQuestProgressInput>({
    mutationFn: updateQuestProgress,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: questsKeys.all });
    },
  });
}

export function useCompleteQuest() {
  const qc = useQueryClient();
  return useMutation<Quest, Error, string>({
    mutationFn: completeQuest,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: questsKeys.all });
    },
  });
}

export function useFailQuest() {
  const qc = useQueryClient();
  return useMutation<Quest, Error, string>({
    mutationFn: failQuest,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: questsKeys.all });
    },
  });
}
