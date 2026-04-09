/**
 * Phase 4: Narrative query hooks (cinematic flags + rich log).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  addNarrativeLogEntry,
  deleteNarrativeLogEntry,
  listNarrativeLog,
  listSeenFlags,
  markFlagSeen,
  type AddNarrativeEntryInput,
  type NarrativeFlag,
  type NarrativeLogEntry,
} from "../../services/narrative";

// ─── Cinematic flags ────────────────────────────────────────────────────────

export const narrativeFlagsKey = ["narrative_flags"] as const;

export function useSeenFlags() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<NarrativeFlag[]>({
    queryKey: narrativeFlagsKey,
    queryFn: listSeenFlags,
    enabled: Boolean(userId),
  });
}

export function useMarkFlagSeen() {
  const qc = useQueryClient();
  return useMutation<NarrativeFlag, Error, string>({
    mutationFn: markFlagSeen,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: narrativeFlagsKey });
    },
  });
}

// ─── Rich log ───────────────────────────────────────────────────────────────

export const narrativeLogKeys = {
  all: ["narrative_log"] as const,
  list: (rangeDays?: number) =>
    rangeDays ? (["narrative_log", "list", rangeDays] as const) : (["narrative_log", "list"] as const),
};

export function useNarrativeLog(rangeDays?: number) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<NarrativeLogEntry[]>({
    queryKey: narrativeLogKeys.list(rangeDays),
    queryFn: () => listNarrativeLog(rangeDays),
    enabled: Boolean(userId),
  });
}

export function useAddNarrativeLogEntry() {
  const qc = useQueryClient();
  return useMutation<NarrativeLogEntry, Error, AddNarrativeEntryInput>({
    mutationFn: addNarrativeLogEntry,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: narrativeLogKeys.all });
    },
  });
}

export function useDeleteNarrativeLogEntry() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteNarrativeLogEntry,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: narrativeLogKeys.all });
    },
  });
}
