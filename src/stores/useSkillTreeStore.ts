import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";
import type { EngineKey } from "../db/schema";

export type NodeStatus = "locked" | "ready" | "claimed";

export type SkillNode = {
  nodeId: string;
  engine: EngineKey;
  branch: string;
  level: number;
  status: NodeStatus;
  name?: string;
};

/** Extended node type used by UI components with optional display fields. */
export type SkillNodeProgress = SkillNode & {
  progress?: number;
  progressText?: string;
};

/** Alias for NodeStatus used by UI components. */
export type SkillNodeStatus = NodeStatus;

type SkillTreeState = {
  progress: Record<string, SkillNode[]>;

  claimNode: (nodeId: string) => void;
  setNodeStatus: (nodeId: string, status: NodeStatus) => void;
  setProgress: (nodes: SkillNode[]) => void;
  initializeTree: (engine: string, nodes: { nodeId: string; engine: string; branch: string; level: number; name: string }[]) => void;
  unlockNode: (engine: string, nodeId: string) => void;
};

export const useSkillTreeStore = create<SkillTreeState>((set, get) => ({
  progress: getJSON<Record<string, SkillNode[]>>("skill_tree_progress", {}),

  claimNode: (nodeId) => {
    set((s) => {
      const updated: Record<string, SkillNode[]> = {};
      for (const [engine, nodes] of Object.entries(s.progress)) {
        updated[engine] = nodes.map((n) =>
          n.nodeId === nodeId ? { ...n, status: "claimed" as NodeStatus } : n,
        );
      }
      setJSON("skill_tree_progress", updated);
      return { progress: updated };
    });
  },

  setNodeStatus: (nodeId, status) => {
    set((s) => {
      const updated: Record<string, SkillNode[]> = {};
      for (const [engine, nodes] of Object.entries(s.progress)) {
        updated[engine] = nodes.map((n) =>
          n.nodeId === nodeId ? { ...n, status } : n,
        );
      }
      setJSON("skill_tree_progress", updated);
      return { progress: updated };
    });
  },

  setProgress: (nodes) => {
    // Group flat array by engine for backward compat callers
    const grouped: Record<string, SkillNode[]> = {};
    for (const n of nodes) {
      const key = n.engine as string;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(n);
    }
    setJSON("skill_tree_progress", grouped);
    set({ progress: grouped });
  },

  initializeTree: (engine, nodes) => {
    const existing = get().progress[engine];
    if (existing && existing.length > 0) return; // Already initialized
    const skillNodes: SkillNode[] = nodes.map((n) => ({
      nodeId: n.nodeId,
      engine: n.engine as EngineKey,
      branch: n.branch,
      level: n.level,
      status: "locked" as NodeStatus,
    }));
    set((s) => {
      const updated = { ...s.progress, [engine]: skillNodes };
      setJSON("skill_tree_progress", updated);
      return { progress: updated };
    });
  },

  unlockNode: (engine, nodeId) => {
    set((s) => {
      const nodes = s.progress[engine] ?? [];
      const updated = nodes.map((n) =>
        n.nodeId === nodeId ? { ...n, status: "ready" as NodeStatus } : n,
      );
      const newProgress = { ...s.progress, [engine]: updated };
      setJSON("skill_tree_progress", newProgress);
      return { progress: newProgress };
    });
  },
}));
