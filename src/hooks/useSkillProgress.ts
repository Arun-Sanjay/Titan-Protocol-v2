/**
 * Skill tree progress computation hook
 */

export function useSkillProgress(_engine?: string) {
  // TODO: Implement skill tree progress computation
  return {
    nodes: [] as { nodeId: string; status: string }[],
    completedCount: 0,
    totalCount: 0,
    percentage: 0,
  };
}
