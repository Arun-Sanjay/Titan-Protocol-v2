import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  listSessions,
  getActiveSession,
  startSession,
  endSession,
  deleteSession,
  listSetsForSession,
  addSet,
  updateSet,
  deleteSet,
  listExercises,
  createExercise,
  deleteExercise,
  listTemplates,
  createTemplate,
  deleteTemplate,
  listPersonalRecords,
  upsertPersonalRecord,
  type GymSession,
  type GymSet,
  type GymExercise,
  type GymTemplate,
  type GymPersonalRecord,
} from "../../services/gym";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const gymKeys = {
  sessions: ["gym", "sessions"] as const,
  activeSession: ["gym", "active_session"] as const,
  sets: (sessionId: string) => ["gym", "sets", sessionId] as const,
  exercises: ["gym", "exercises"] as const,
  templates: ["gym", "templates"] as const,
  personalRecords: ["gym", "prs"] as const,
};

// ─── Session Hooks ──────────────────────────────────────────────────────────

export function useGymSessions() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: gymKeys.sessions,
    queryFn: () => listSessions(30),
    enabled: Boolean(userId),
  });
}

export function useActiveGymSession() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: gymKeys.activeSession,
    queryFn: getActiveSession,
    enabled: Boolean(userId),
    refetchInterval: 30_000, // Poll while session active
  });
}

export function useStartGymSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: startSession,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: gymKeys.sessions });
      qc.invalidateQueries({ queryKey: gymKeys.activeSession });
    },
  });
}

export function useEndGymSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: endSession,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: gymKeys.sessions });
      qc.invalidateQueries({ queryKey: gymKeys.activeSession });
    },
  });
}

export function useDeleteGymSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteSession,
    onMutate: async (sessionId) => {
      await qc.cancelQueries({ queryKey: gymKeys.sessions });
      const prev = qc.getQueryData<GymSession[]>(gymKeys.sessions);
      qc.setQueryData<GymSession[]>(gymKeys.sessions, (old) =>
        old?.filter((s) => s.id !== sessionId) ?? [],
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(gymKeys.sessions, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: gymKeys.sessions });
      qc.invalidateQueries({ queryKey: gymKeys.activeSession });
    },
  });
}

// ─── Set Hooks ──────────────────────────────────────────────────────────────

export function useGymSets(sessionId: string) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: gymKeys.sets(sessionId),
    queryFn: () => listSetsForSession(sessionId),
    enabled: Boolean(userId) && Boolean(sessionId),
  });
}

export function useAddGymSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: addSet,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: gymKeys.sets(vars.session_id) });
      qc.invalidateQueries({ queryKey: gymKeys.personalRecords });
    },
  });
}

export function useUpdateGymSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      setId: string;
      sessionId: string;
      updates: { weight?: number; reps?: number; rpe?: number; notes?: string };
    }) => updateSet(vars.setId, vars.updates),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: gymKeys.sets(vars.sessionId) });
    },
  });
}

export function useDeleteGymSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { setId: string; sessionId: string }) =>
      deleteSet(vars.setId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: gymKeys.sets(vars.sessionId) });
    },
  });
}

// ─── Exercise Hooks ─────────────────────────────────────────────────────────

export function useGymExercises() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: gymKeys.exercises,
    queryFn: listExercises,
    enabled: Boolean(userId),
  });
}

export function useCreateGymExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createExercise,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: gymKeys.exercises });
    },
  });
}

export function useDeleteGymExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteExercise,
    onMutate: async (exerciseId) => {
      await qc.cancelQueries({ queryKey: gymKeys.exercises });
      const prev = qc.getQueryData<GymExercise[]>(gymKeys.exercises);
      qc.setQueryData<GymExercise[]>(gymKeys.exercises, (old) =>
        old?.filter((e) => e.id !== exerciseId) ?? [],
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(gymKeys.exercises, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: gymKeys.exercises });
    },
  });
}

// ─── Template Hooks ─────────────────────────────────────────────────────────

export function useGymTemplates() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: gymKeys.templates,
    queryFn: listTemplates,
    enabled: Boolean(userId),
  });
}

export function useCreateGymTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: gymKeys.templates });
    },
  });
}

export function useDeleteGymTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTemplate,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: gymKeys.templates });
    },
  });
}

// ─── Personal Record Hooks ──────────────────────────────────────────────────

export function useGymPersonalRecords() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: gymKeys.personalRecords,
    queryFn: listPersonalRecords,
    enabled: Boolean(userId),
  });
}

export function useUpsertGymPR() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertPersonalRecord,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: gymKeys.personalRecords });
    },
  });
}
