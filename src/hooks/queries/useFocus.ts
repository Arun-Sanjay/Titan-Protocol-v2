import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  listFocusSessions,
  getFocusSettings,
  upsertFocusSettings,
  recordFocusSession,
} from "../../services/focus";
import type { FocusSession, FocusSettings } from "../../services/focus";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const focusKeys = {
  sessions: ["focus_sessions"] as const,
  settings: ["focus_settings"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useFocusSessions() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: focusKeys.sessions,
    queryFn: listFocusSessions,
    enabled: Boolean(userId),
  });
}

export function useFocusSettings() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: focusKeys.settings,
    queryFn: getFocusSettings,
    enabled: Boolean(userId),
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useUpsertFocusSettings() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: upsertFocusSettings,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: focusKeys.settings });
    },
  });
}

export function useRecordFocusSession() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: recordFocusSession,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: focusKeys.sessions });
    },
  });
}
