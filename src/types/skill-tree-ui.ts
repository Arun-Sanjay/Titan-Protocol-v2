import type { Tables, Enums } from "./supabase";
import skillTreeData from "../data/skill-trees.json";

export type SkillNodeStatus = "locked" | "ready" | "claimed";

export type SkillNode = {
  nodeId: string;
  engine: Enums<"engine_key">;
  branch: string;
  level: number;
  status: SkillNodeStatus;
  name?: string;
};

export type SkillNodeProgress = SkillNode & {
  progress?: number;
  progressText?: string;
};

type SkillTreeJsonShape = Record<
  string,
  {
    branches: {
      id: string;
      name: string;
      levels: { nodeId: string; name: string; level: number }[];
    }[];
  }
>;

const SKILL_TREE = skillTreeData as unknown as SkillTreeJsonShape;

type CloudRow = Tables<"skill_tree_progress">;

/**
 * Merge cloud progress rows with the static skill tree definitions so
 * the UI renders every node, not just those with a row in the DB.
 * Rows that are absent default to "locked".
 */
export function buildSkillProgress(
  engine: string,
  cloudRows: CloudRow[],
): SkillNodeProgress[] {
  const engineData = SKILL_TREE[engine];
  if (!engineData) return [];
  const rowsById = new Map(cloudRows.filter((r) => r.engine === engine).map((r) => [r.node_id, r]));

  const nodes: SkillNodeProgress[] = [];
  for (const branch of engineData.branches) {
    for (const lv of branch.levels) {
      const row = rowsById.get(lv.nodeId);
      const state = (row?.state as SkillNodeStatus | undefined) ?? "locked";
      nodes.push({
        nodeId: lv.nodeId,
        engine: engine as Enums<"engine_key">,
        branch: branch.id,
        level: lv.level,
        name: lv.name,
        status: state,
        progress: row?.progress ?? undefined,
      });
    }
  }
  return nodes;
}
