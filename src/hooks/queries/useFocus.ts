/**
 * Phase 4: Focus engine query hooks (settings + sessions).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  deleteFocusSession,
  getFocusSettings,
  listFocusSessions,
  listFocusSessionsForRange,
  recordFocusSession,
  upsertFocusSettings,
  type FocusSession,
  type FocusSettings,
  type RecordFocusSessionInput,
  type UpsertFocusSettingsInput,
} from "../../services/focus";

export const focusSettingsKey = ["focus_settings"] as const;

export function useFocusSettings() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<FocusSettings | null>({
    queryKey: focusSettingsKey,
    queryFn: getFocusSettings,
    enabled: Boolean(userId),
  });
}

export function useUpsertFocusSettings() {
  const qc = useQueryClient();
  return useMutation<FocusSettings, Error, UpsertFocusSettingsInput>({
    mutationFn: upsertFocusSettings,
    onSuccess: (settings) => {
      qc.setQueryData<FocusSettings | null>(focusSettingsKey, settings);
    },
  });
}

export const focusSessionsKeys = {
  all: ["focus_sessions"] as const,
  byDate: (dateKey: string) => ["focus_sessions", "date", dateKey] as const,
  byRange: (start: string, end: string) =>
    ["focus_sessions", "range", start, end] as const,
};

export function useFocusSessions(dateKey: string) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<FocusSession[]>({
    queryKey: focusSessionsKeys.byDate(dateKey),
    queryFn: () => listFocusSessions(dateKey),
    enabled: Boolean(userId),
  });
}

export function useFocusSessionsRange(start: string, end: string) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<FocusSession[]>({
    queryKey: focusSessionsKeys.byRange(start, end),
    queryFn: () => listFocusSessionsForRange(start, end),
    enabled: Boolean(userId),
  });
}

export function useRecordFocusSession() {
  const qc = useQueryClient();
  return useMutation<FocusSession, Error, RecordFocusSessionInput>({
    mutationFn: recordFocusSession,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: focusSessionsKeys.all });
    },
  });
}

export function useDeleteFocusSession() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteFocusSession,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: focusSessionsKeys.all });
    },
  });
}
