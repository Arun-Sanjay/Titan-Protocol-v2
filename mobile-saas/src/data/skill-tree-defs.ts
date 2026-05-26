/**
 * Phase 4.1: Skill tree definitions extracted from useSkillTreeStore so
 * screens can import the tree data without pulling in the Zustand store.
 * The store still re-exports SKILL_TREES for backward compat.
 */

import type { EngineKey } from "../db/schema";
import skillTreeData from "./skill-trees.json";
import { SkillTreeDataSchema, parseOrFallback } from "../lib/schemas";

export type SkillNode = {
  id: string;
  name: string;
  description: string;
  conditionText: string;
};

export type SkillBranch = {
  id: string;
  name: string;
  nodes: SkillNode[];
};

function buildSkillTrees(): Record<string, SkillBranch[]> {
  const validated = parseOrFallback(
    SkillTreeDataSchema,
    skillTreeData,
    {},
    "src/data/skill-trees.json",
  );
  const trees: Record<string, SkillBranch[]> = {};
  const engines: EngineKey[] = ["body", "mind", "money", "charisma"];
  for (const engine of engines) {
    const raw = validated[engine];
    if (!raw) { trees[engine] = []; continue; }
    const branches: SkillBranch[] = [];
    for (const branch of raw.branches) {
      const nodes: SkillNode[] = branch.levels.map((lv) => ({
        id: lv.nodeId,
        name: lv.name,
        description: lv.description,
        conditionText: lv.description,
      }));
      branches.push({ id: branch.id, name: branch.name, nodes });
    }
    trees[engine] = branches;
  }
  return trees;
}

export const SKILL_TREES = buildSkillTrees();
