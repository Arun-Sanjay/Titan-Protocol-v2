import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUserId } from "../../lib/session";
import { listNarrativeLog, addNarrativeLogEntry } from "../../services/narrative";
import type { Tables } from "@titan/shared/types/supabase";

// ─── Types ─────────────────────────────────────────────────────────────────

export type NarrativeLogRow = Tables<"narrative_log">;

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const narrativeKeys = {
  log: ["narrative_log"] as const,
};

// ─── Queries ───────────────────────────────────────────────────────────────

export function useNarrativeLog(limit?: number) {
  const userId = useCurrentUserId();
  return useQuery({
    queryKey: narrativeKeys.log,
    queryFn: () => listNarrativeLog(limit),
    enabled: Boolean(userId),
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * Screens call: mutate({ dateKey, text, type })
 * Service expects: { date_key, text, type }
 */
export function useAddNarrativeLogEntry() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: {
      dateKey: string;
      text: string;
      type: string;
    }) => {
      return addNarrativeLogEntry({
        date_key: vars.dateKey,
        text: vars.text,
        type: vars.type,
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: narrativeKeys.log });
    },
  });
}
