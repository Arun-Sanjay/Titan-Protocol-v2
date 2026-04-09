/**
 * Phase 4: Field ops query hooks.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  getActiveFieldOp,
  getCooldown,
  listFieldOpHistory,
  recordFieldOpDay,
  resolveFieldOp,
  setCooldown,
  startFieldOp,
  type FieldOp,
  type FieldOpCooldown,
  type FieldOpStatus,
  type RecordFieldOpDayInput,
  type StartFieldOpInput,
} from "../../services/field-ops";

export const fieldOpsKeys = {
  all: ["field_ops"] as const,
  active: () => ["field_ops", "active"] as const,
  history: () => ["field_ops", "history"] as const,
  cooldown: () => ["field_op_cooldown"] as const,
};

export function useActiveFieldOp() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<FieldOp | null>({
    queryKey: fieldOpsKeys.active(),
    queryFn: getActiveFieldOp,
    enabled: Boolean(userId),
  });
}

export function useFieldOpHistory() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<FieldOp[]>({
    queryKey: fieldOpsKeys.history(),
    queryFn: listFieldOpHistory,
    enabled: Boolean(userId),
  });
}

export function useFieldOpCooldown() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<FieldOpCooldown | null>({
    queryKey: fieldOpsKeys.cooldown(),
    queryFn: getCooldown,
    enabled: Boolean(userId),
  });
}

export function useStartFieldOp() {
  const qc = useQueryClient();
  return useMutation<FieldOp, Error, StartFieldOpInput>({
    mutationFn: startFieldOp,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: fieldOpsKeys.all });
    },
  });
}

export function useRecordFieldOpDay() {
  const qc = useQueryClient();
  return useMutation<FieldOp, Error, RecordFieldOpDayInput>({
    mutationFn: recordFieldOpDay,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: fieldOpsKeys.all });
    },
  });
}

export function useResolveFieldOp() {
  const qc = useQueryClient();
  return useMutation<
    FieldOp,
    Error,
    { id: string; status: Exclude<FieldOpStatus, "active"> }
  >({
    mutationFn: ({ id, status }) => resolveFieldOp(id, status),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: fieldOpsKeys.all });
    },
  });
}

export function useSetCooldown() {
  const qc = useQueryClient();
  return useMutation<FieldOpCooldown, Error, string | null>({
    mutationFn: setCooldown,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: fieldOpsKeys.cooldown() });
    },
  });
}
