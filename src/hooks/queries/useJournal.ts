import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  listJournalEntries,
  getJournalEntry,
  upsertJournalEntry,
  deleteJournalEntry,
  type JournalEntry,
} from "../../services/journal";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const journalKeys = {
  all: ["journal_entries"] as const,
  byDate: (dateKey: string) => ["journal_entries", dateKey] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Screens call useJournalEntries() or useJournalEntries(90).
 * The `days` param is accepted but the underlying service already
 * returns all entries (filtered by RLS); we keep the param for
 * forward-compatibility and simply pass through.
 */
export function useJournalEntries(_days?: number) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: journalKeys.all,
    queryFn: listJournalEntries,
    enabled: Boolean(userId),
  });
}

export function useJournalEntry(dateKey: string) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: journalKeys.byDate(dateKey),
    queryFn: () => getJournalEntry(dateKey),
    enabled: Boolean(userId),
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * Screens call: mutateAsync({ dateKey, content })
 * Service expects: { date_key, content }
 */
export function useUpsertJournalEntry() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { dateKey: string; content: string }) => {
      return upsertJournalEntry({
        date_key: vars.dateKey,
        content: vars.content,
      });
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: journalKeys.all });
      const prev = qc.getQueryData<JournalEntry[]>(journalKeys.all);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(journalKeys.all, ctx.prev);
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: journalKeys.all });
      qc.invalidateQueries({ queryKey: journalKeys.byDate(vars.dateKey) });
    },
  });
}

export function useDeleteJournalEntry() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: deleteJournalEntry,
    onMutate: async (entryId) => {
      await qc.cancelQueries({ queryKey: journalKeys.all });
      const prev = qc.getQueryData<JournalEntry[]>(journalKeys.all);
      qc.setQueryData<JournalEntry[]>(journalKeys.all, (old) =>
        old?.filter((e) => e.id !== entryId) ?? [],
      );
      return { prev };
    },
    onError: (_err, _entryId, ctx) => {
      if (ctx?.prev) qc.setQueryData(journalKeys.all, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: journalKeys.all });
    },
  });
}
