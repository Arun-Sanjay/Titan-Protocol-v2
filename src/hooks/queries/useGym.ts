/**
 * Phase 4: Gym query hooks. One file with all 5 entity hooks since
 * they share a query-key root.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  createGymExercise,
  createGymSet,
  createGymTemplate,
  deleteGymExercise,
  deleteGymSession,
  deleteGymSet,
  deleteGymTemplate,
  deletePR,
  endGymSession,
  getGymSession,
  getPRForExercise,
  listGymExercises,
  listGymPRs,
  listGymSessions,
  listGymSetsForSession,
  listGymTemplates,
  recordPR,
  startGymSession,
  updateGymExercise,
  updateGymSet,
  updateGymTemplate,
  type CreateExerciseInput,
  type CreateSetInput,
  type CreateTemplateInput,
  type GymExercise,
  type GymPR,
  type GymSession,
  type GymSet,
  type GymTemplate,
  type RecordPRInput,
  type StartSessionInput,
} from "../../services/gym";

export const gymKeys = {
  all: ["gym"] as const,
  exercises: () => ["gym", "exercises"] as const,
  templates: () => ["gym", "templates"] as const,
  sessions: (rangeDays?: number) =>
    rangeDays ? (["gym", "sessions", rangeDays] as const) : (["gym", "sessions"] as const),
  session: (id: string) => ["gym", "session", id] as const,
  setsBySession: (sessionId: string) => ["gym", "sets", sessionId] as const,
  prs: () => ["gym", "prs"] as const,
  prByExercise: (name: string) => ["gym", "pr", name] as const,
};

// ─── Exercises ──────────────────────────────────────────────────────────────

export function useGymExercises() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<GymExercise[]>({
    queryKey: gymKeys.exercises(),
    queryFn: listGymExercises,
    enabled: Boolean(userId),
  });
}

export function useCreateGymExercise() {
  const qc = useQueryClient();
  return useMutation<GymExercise, Error, CreateExerciseInput>({
    mutationFn: createGymExercise,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: gymKeys.exercises() });
    },
  });
}

export function useUpdateGymExercise() {
  const qc = useQueryClient();
  return useMutation<
    GymExercise,
    Error,
    { id: string; patch: Parameters<typeof updateGymExercise>[1] }
  >({
    mutationFn: ({ id, patch }) => updateGymExercise(id, patch),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: gymKeys.exercises() });
    },
  });
}

export function useDeleteGymExercise() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteGymExercise,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: gymKeys.exercises() });
    },
  });
}

// ─── Templates ──────────────────────────────────────────────────────────────

export function useGymTemplates() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<GymTemplate[]>({
    queryKey: gymKeys.templates(),
    queryFn: listGymTemplates,
    enabled: Boolean(userId),
  });
}

export function useCreateGymTemplate() {
  const qc = useQueryClient();
  return useMutation<GymTemplate, Error, CreateTemplateInput>({
    mutationFn: createGymTemplate,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: gymKeys.templates() });
    },
  });
}

export function useUpdateGymTemplate() {
  const qc = useQueryClient();
  return useMutation<
    GymTemplate,
    Error,
    { id: string; patch: Parameters<typeof updateGymTemplate>[1] }
  >({
    mutationFn: ({ id, patch }) => updateGymTemplate(id, patch),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: gymKeys.templates() });
    },
  });
}

export function useDeleteGymTemplate() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteGymTemplate,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: gymKeys.templates() });
    },
  });
}

// ─── Sessions ───────────────────────────────────────────────────────────────

export function useGymSessions(rangeDays?: number) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<GymSession[]>({
    queryKey: gymKeys.sessions(rangeDays),
    queryFn: () => listGymSessions(rangeDays),
    enabled: Boolean(userId),
  });
}

export function useGymSession(id: string) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<GymSession | null>({
    queryKey: gymKeys.session(id),
    queryFn: () => getGymSession(id),
    enabled: Boolean(userId) && Boolean(id),
  });
}

export function useStartGymSession() {
  const qc = useQueryClient();
  return useMutation<GymSession, Error, StartSessionInput | undefined>({
    mutationFn: (input) => startGymSession(input),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: gymKeys.all });
    },
  });
}

export function useEndGymSession() {
  const qc = useQueryClient();
  return useMutation<GymSession, Error, { id: string; notes?: string }>({
    mutationFn: ({ id, notes }) => endGymSession(id, notes),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: gymKeys.all });
    },
  });
}

export function useDeleteGymSession() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteGymSession,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: gymKeys.all });
    },
  });
}

// ─── Sets ───────────────────────────────────────────────────────────────────

export function useGymSetsForSession(sessionId: string) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<GymSet[]>({
    queryKey: gymKeys.setsBySession(sessionId),
    queryFn: () => listGymSetsForSession(sessionId),
    enabled: Boolean(userId) && Boolean(sessionId),
  });
}

export function useCreateGymSet() {
  const qc = useQueryClient();
  return useMutation<GymSet, Error, CreateSetInput>({
    mutationFn: createGymSet,
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: gymKeys.setsBySession(vars.sessionId) });
    },
  });
}

export function useUpdateGymSet() {
  const qc = useQueryClient();
  return useMutation<
    GymSet,
    Error,
    { id: string; patch: Parameters<typeof updateGymSet>[1] }
  >({
    mutationFn: ({ id, patch }) => updateGymSet(id, patch),
    onSettled: (data) => {
      if (data?.session_id) {
        qc.invalidateQueries({ queryKey: gymKeys.setsBySession(data.session_id) });
      }
    },
  });
}

export function useDeleteGymSet() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; sessionId: string }>({
    mutationFn: ({ id }) => deleteGymSet(id),
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: gymKeys.setsBySession(vars.sessionId) });
    },
  });
}

// ─── Personal records ───────────────────────────────────────────────────────

export function useGymPRs() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<GymPR[]>({
    queryKey: gymKeys.prs(),
    queryFn: listGymPRs,
    enabled: Boolean(userId),
  });
}

export function useGymPRForExercise(name: string) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<GymPR | null>({
    queryKey: gymKeys.prByExercise(name),
    queryFn: () => getPRForExercise(name),
    enabled: Boolean(userId) && Boolean(name),
  });
}

export function useRecordPR() {
  const qc = useQueryClient();
  return useMutation<GymPR, Error, RecordPRInput>({
    mutationFn: recordPR,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: gymKeys.prs() });
    },
  });
}

export function useDeletePR() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deletePR,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: gymKeys.prs() });
    },
  });
}
