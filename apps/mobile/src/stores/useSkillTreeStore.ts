import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";
import type { EngineKey } from "../db/schema";
import skillTreeData from "../data/skill-trees.json";

// ─── Types ────────────────────────────────────────────────────────────────────

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

export type SkillNodeStatus = "locked" | "ready" | "claimed";

export type SkillNodeProgress = {
  nodeId: string;
  engine: string;
  branch: string;
  level: number;
  name: string;
  status: SkillNodeStatus;
  progress?: number; // 0-100
  progressText?: string; // e.g., "7 / 10 workouts"
};

// ─── Tree Definitions (auto-generated from JSON) ─────────────────────────────

// Auto-generate SKILL_TREES from JSON so nodeIds are always in sync
type SkillBranchDef = { id: string; name: string; nodes: SkillNode[] };
const SKILL_TREES: Record<string, SkillBranchDef[]> = {};
for (const [engine, data] of Object.entries(skillTreeData)) {
  const engineData = data as { branches: { id: string; name: string; levels: { nodeId: string; level: number; name: string; description: string; requirementType: string; targetValue: number }[] }[] };
  SKILL_TREES[engine] = engineData.branches.map((b) => ({
    id: b.id,
    name: b.name,
    nodes: b.levels.map((l) => ({
      id: l.nodeId,
      name: l.name,
      description: l.description,
      conditionText: l.description,
    })),
  }));
}
export { SKILL_TREES };

// ─── Store ────────────────────────────────────────────────────────────────────

const UNLOCKS_KEY = "skill_tree_unlocks";
const PROGRESS_KEY = "skill_tree_progress";

type SkillTreeState = {
  unlockedNodes: Set<string>;
  /** Per-engine node progress, keyed by engine name */
  progress: Record<string, SkillNodeProgress[]>;
  load: () => void;
  unlockNode: (nodeIdOrEngine: string, nodeId?: string) => void;
  /** Claim a "ready" node — sets it to "claimed", persists, and re-evaluates the next node in the branch */
  claimNode: (engine: string, nodeId: string) => void;
  isUnlocked: (nodeId: string) => boolean;
  /** Returns the first locked node that is immediately unlockable (prev node unlocked or first in branch) */
  getNextUnlockable: (engine: EngineKey) => SkillNode | null;
  getProgress: (engine: EngineKey) => { unlocked: number; total: number };
  /** Initialize a tree from JSON definitions */
  initializeTree: (engine: string, nodes: { nodeId: string; engine: string; branch: string; level: number; name: string }[]) => void;
  /** Get a summary overview across all engines */
  getOverview: () => { engine: string; totalNodes: number; totalCompleted: number }[];
};

export const useSkillTreeStore = create<SkillTreeState>()((set, get) => ({
  unlockedNodes: new Set(getJSON<string[]>(UNLOCKS_KEY, [])),
  progress: getJSON<Record<string, SkillNodeProgress[]>>(PROGRESS_KEY, {}),

  load: () => {
    set({
      unlockedNodes: new Set(getJSON<string[]>(UNLOCKS_KEY, [])),
      progress: getJSON<Record<string, SkillNodeProgress[]>>(PROGRESS_KEY, {}),
    });
  },

  unlockNode: (nodeIdOrEngine: string, nodeId?: string) => {
    // Support both: unlockNode("nodeId") and unlockNode("engine", "nodeId")
    const actualNodeId = nodeId ?? nodeIdOrEngine;
    const engine = nodeId ? nodeIdOrEngine : undefined;

    const next = new Set([...get().unlockedNodes, actualNodeId]);
    setJSON(UNLOCKS_KEY, [...next]);

    // Also update progress map if engine is provided — set to "ready" (awaiting user claim)
    if (engine) {
      const progress = { ...get().progress };
      const engineNodes = [...(progress[engine] ?? [])];
      const idx = engineNodes.findIndex((n) => n.nodeId === actualNodeId);
      if (idx >= 0) {
        engineNodes[idx] = { ...engineNodes[idx], status: "ready", progress: 100 };
        progress[engine] = engineNodes;
        setJSON(PROGRESS_KEY, progress);
        set({ unlockedNodes: next, progress });
        return;
      }
    }

    set({ unlockedNodes: next });
  },

  claimNode: (engine: string, nodeId: string) => {
    const progress = { ...get().progress };
    const engineNodes = [...(progress[engine] ?? [])];
    const idx = engineNodes.findIndex((n) => n.nodeId === nodeId);

    // Only allow claiming "ready" nodes
    if (idx < 0 || engineNodes[idx].status !== "ready") return;

    // 1. Set to "claimed"
    engineNodes[idx] = { ...engineNodes[idx], status: "claimed", progress: 100 };

    // 2. Re-evaluate the next node in the same branch
    const claimedNode = engineNodes[idx];
    const nextIdx = engineNodes.findIndex(
      (n) => n.branch === claimedNode.branch && n.level === claimedNode.level + 1,
    );
    if (nextIdx >= 0 && engineNodes[nextIdx].status === "locked") {
      // Check if this next node is already unlocked (requirement met)
      const nextNodeId = engineNodes[nextIdx].nodeId;
      if (get().unlockedNodes.has(nextNodeId)) {
        engineNodes[nextIdx] = { ...engineNodes[nextIdx], status: "ready", progress: 100 };
      }
    }

    progress[engine] = engineNodes;
    setJSON(PROGRESS_KEY, progress);
    set({ progress });
  },

  isUnlocked: (nodeId) => get().unlockedNodes.has(nodeId),

  getNextUnlockable: (engine) => {
    const { unlockedNodes } = get();
    const branches = SKILL_TREES[engine];
    for (const branch of branches) {
      for (let i = 0; i < branch.nodes.length; i++) {
        const node = branch.nodes[i];
        if (!unlockedNodes.has(node.id)) {
          // Unlockable if it's the first node, or the previous node is unlocked
          if (i === 0 || unlockedNodes.has(branch.nodes[i - 1].id)) {
            return node;
          }
        }
      }
    }
    return null; // all unlocked
  },

  getProgress: (engine) => {
    const { progress } = get();
    const engineNodes = progress[engine] ?? [];
    let total = 0;
    let unlocked = 0;
    for (const node of engineNodes) {
      total++;
      if (node.status === "claimed") unlocked++;
    }
    // Fallback to SKILL_TREES if progress map is empty
    if (total === 0) {
      const { unlockedNodes } = get();
      for (const branch of SKILL_TREES[engine]) {
        for (const node of branch.nodes) {
          total++;
          if (unlockedNodes.has(node.id)) unlocked++;
        }
      }
    }
    return { unlocked, total };
  },

  initializeTree: (engine, nodes) => {
    const { unlockedNodes, progress } = get();
    // Skip if already initialized with nodes for this engine
    if (progress[engine] && progress[engine].length > 0) return;

    const engineProgress: SkillNodeProgress[] = nodes.map((n) => ({
      nodeId: n.nodeId,
      engine: n.engine,
      branch: n.branch,
      level: n.level,
      name: n.name,
      status: unlockedNodes.has(n.nodeId) ? "claimed" : "locked",
      progress: unlockedNodes.has(n.nodeId) ? 100 : 0,
    }));
    const updated = { ...progress, [engine]: engineProgress };
    setJSON(PROGRESS_KEY, updated);
    set({ progress: updated });
  },

  getOverview: () => {
    const { progress } = get();
    const engines = ["body", "mind", "money", "charisma"];
    return engines.map((engine) => {
      const nodes = progress[engine] ?? [];
      return {
        engine,
        totalNodes: nodes.length,
        totalCompleted: nodes.filter((n) => n.status === "claimed").length,
      };
    });
  },
}));
