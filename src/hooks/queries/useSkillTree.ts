import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  listSkillProgress,
  claimSkillNode,
  type SkillProgress,
} from "../../services/skill-tree";
import type { Enums } from "../../types/supabase";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const skillTreeKeys = {
  all: ["skill_tree_progress"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Screens call useSkillProgress() or useSkillProgress(engine).
 * The optional `engine` param is accepted for forward-compatibility;
 * the underlying service returns all progress rows (RLS-scoped)
 * regardless.
 */
export function useSkillProgress(_engine?: Enums<"engine_key">) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: skillTreeKeys.all,
    queryFn: listSkillProgress,
    enabled: Boolean(userId),
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * Screens call: mutate({ nodeId, engine })
 * Service expects snake_case: { node_id, engine }
 */
export function useClaimSkillNode() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: {
      nodeId: string;
      engine: Enums<"engine_key">;
    }) => {
      return claimSkillNode({
        node_id: vars.nodeId,
        engine: vars.engine,
      });
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: skillTreeKeys.all });
      const prev = qc.getQueryData<SkillProgress[]>(skillTreeKeys.all);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(skillTreeKeys.all, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: skillTreeKeys.all });
    },
  });
}
