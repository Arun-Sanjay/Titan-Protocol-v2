/**
 * Phase 4: Skill tree query hooks.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  claimSkillNode,
  listSkillProgress,
  unlockSkillNode,
  updateSkillNodeProgress,
  upsertSkillNode,
  type EngineKey,
  type SkillProgress,
  type UpsertSkillNodeInput,
} from "../../services/skill-tree";

export const skillTreeKeys = {
  all: ["skill_tree"] as const,
  list: (engine?: EngineKey) =>
    engine ? (["skill_tree", "list", engine] as const) : (["skill_tree", "list"] as const),
};

export function useSkillProgress(engine?: EngineKey) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<SkillProgress[]>({
    queryKey: skillTreeKeys.list(engine),
    queryFn: () => listSkillProgress(engine),
    enabled: Boolean(userId),
  });
}

export function useUpsertSkillNode() {
  const qc = useQueryClient();
  return useMutation<SkillProgress, Error, UpsertSkillNodeInput>({
    mutationFn: upsertSkillNode,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: skillTreeKeys.all });
    },
  });
}

export function useUnlockSkillNode() {
  const qc = useQueryClient();
  return useMutation<SkillProgress, Error, { engine: EngineKey; nodeId: string }>({
    mutationFn: ({ engine, nodeId }) => unlockSkillNode(engine, nodeId),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: skillTreeKeys.all });
    },
  });
}

export function useClaimSkillNode() {
  const qc = useQueryClient();
  return useMutation<SkillProgress, Error, { engine: EngineKey; nodeId: string }>({
    mutationFn: ({ engine, nodeId }) => claimSkillNode(engine, nodeId),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: skillTreeKeys.all });
    },
  });
}

export function useUpdateSkillNodeProgress() {
  const qc = useQueryClient();
  return useMutation<
    SkillProgress,
    Error,
    { engine: EngineKey; nodeId: string; progress: number }
  >({
    mutationFn: ({ engine, nodeId, progress }) =>
      updateSkillNodeProgress(engine, nodeId, progress),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: skillTreeKeys.all });
    },
  });
}
