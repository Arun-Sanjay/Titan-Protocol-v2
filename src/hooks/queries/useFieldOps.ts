import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  getActiveFieldOp,
  listFieldOpHistory,
  getFieldOpCooldown,
  startFieldOp,
  resolveFieldOp,
} from "../../services/field-ops";
import type { FieldOp, FieldOpCooldown } from "../../services/field-ops";
import type { Json } from "../../types/supabase";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const fieldOpsKeys = {
  active: ["field_ops", "active"] as const,
  history: ["field_ops", "history"] as const,
  cooldown: ["field_op_cooldown"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useActiveFieldOp() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: fieldOpsKeys.active,
    queryFn: getActiveFieldOp,
    enabled: Boolean(userId),
  });
}

export function useFieldOpHistory() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: fieldOpsKeys.history,
    queryFn: listFieldOpHistory,
    enabled: Boolean(userId),
  });
}

export function useFieldOpCooldown() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: fieldOpsKeys.cooldown,
    queryFn: getFieldOpCooldown,
    enabled: Boolean(userId),
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * Screens call: mutate({ fieldOpId })
 * Service converts camelCase to snake_case for the DB insert.
 */
export function useStartFieldOp() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: startFieldOp,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: fieldOpsKeys.active });
      qc.invalidateQueries({ queryKey: fieldOpsKeys.history });
      qc.invalidateQueries({ queryKey: fieldOpsKeys.cooldown });
    },
  });
}

/**
 * Screens call: mutate({ id, status })
 * Service maps `id` to the row ID for the update query.
 */
export function useResolveFieldOp() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: resolveFieldOp,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: fieldOpsKeys.active });
      qc.invalidateQueries({ queryKey: fieldOpsKeys.history });
      qc.invalidateQueries({ queryKey: fieldOpsKeys.cooldown });
    },
  });
}
