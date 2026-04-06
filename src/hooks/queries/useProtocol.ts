/**
 * Phase 3.3e: Protocol session query hooks.
 *
 * Wraps src/services/protocol.ts in React Query. The morning/evening
 * mutations both update the same per-day row; cache invalidation hits
 * the per-date and recent-sessions queries so the dashboard stays in
 * sync after either completion.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  getProtocolSession,
  listRecentProtocolSessions,
  saveEveningSession,
  saveMorningSession,
  type ProtocolSession,
  type Archetype,
} from "../../services/protocol";

export const protocolKeys = {
  all: ["protocol"] as const,
  byDate: (dateKey: string) => ["protocol", "date", dateKey] as const,
  recent: (limit: number) => ["protocol", "recent", limit] as const,
};

// ─── Reads ──────────────────────────────────────────────────────────────────

export function useProtocolSession(dateKey: string) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<ProtocolSession | null>({
    queryKey: protocolKeys.byDate(dateKey),
    queryFn: () => getProtocolSession(dateKey),
    enabled: Boolean(userId),
  });
}

export function useRecentProtocolSessions(limit: number = 30) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<ProtocolSession[]>({
    queryKey: protocolKeys.recent(limit),
    queryFn: () => listRecentProtocolSessions(limit),
    enabled: Boolean(userId),
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

type SaveMorningVars = { dateKey: string; intention: string };

export function useSaveMorningSession() {
  const queryClient = useQueryClient();
  return useMutation<ProtocolSession, Error, SaveMorningVars>({
    mutationFn: ({ dateKey, intention }) =>
      saveMorningSession(dateKey, intention),
    onSuccess: (session) => {
      queryClient.setQueryData<ProtocolSession | null>(
        protocolKeys.byDate(session.date_key),
        session,
      );
      queryClient.invalidateQueries({ queryKey: protocolKeys.recent(30) });
    },
  });
}

type SaveEveningVars = {
  dateKey: string;
  reflection: string;
  titanScore: number;
  identityVote: Archetype | null;
  habitChecks?: Record<string, boolean>;
};

export function useSaveEveningSession() {
  const queryClient = useQueryClient();
  return useMutation<ProtocolSession, Error, SaveEveningVars>({
    mutationFn: saveEveningSession,
    onSuccess: (session) => {
      queryClient.setQueryData<ProtocolSession | null>(
        protocolKeys.byDate(session.date_key),
        session,
      );
      queryClient.invalidateQueries({ queryKey: protocolKeys.recent(30) });
    },
  });
}
