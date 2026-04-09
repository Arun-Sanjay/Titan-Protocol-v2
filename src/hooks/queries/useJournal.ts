/**
 * Phase 4: Journal entries query hooks.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  deleteJournalEntry,
  getJournalEntry,
  listJournalEntries,
  upsertJournalEntry,
  type JournalEntry,
  type UpsertJournalInput,
} from "../../services/journal";

export const journalKeys = {
  all: ["journal"] as const,
  list: (rangeDays?: number) =>
    rangeDays ? (["journal", "list", rangeDays] as const) : (["journal", "list"] as const),
  byDate: (dateKey: string) => ["journal", "date", dateKey] as const,
};

export function useJournalEntries(rangeDays?: number) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<JournalEntry[]>({
    queryKey: journalKeys.list(rangeDays),
    queryFn: () => listJournalEntries(rangeDays),
    enabled: Boolean(userId),
  });
}

export function useJournalEntry(dateKey: string) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<JournalEntry | null>({
    queryKey: journalKeys.byDate(dateKey),
    queryFn: () => getJournalEntry(dateKey),
    enabled: Boolean(userId),
  });
}

export function useUpsertJournalEntry() {
  const qc = useQueryClient();
  return useMutation<JournalEntry, Error, UpsertJournalInput>({
    mutationFn: upsertJournalEntry,
    onSuccess: (entry) => {
      qc.setQueryData<JournalEntry | null>(journalKeys.byDate(entry.date_key), entry);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: journalKeys.all });
    },
  });
}

export function useDeleteJournalEntry() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteJournalEntry,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: journalKeys.all });
    },
  });
}
