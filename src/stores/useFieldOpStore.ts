import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";

// ─── Types ──────────────────────────────────────────────────────────────────

export type FieldOpStatus = "available" | "active" | "completed" | "failed";

export type ActiveFieldOp = {
  opId: string;
  startDate: string;
  status: FieldOpStatus;
  progress: number;
};

// ─── Store ──────────────────────────────────────────────────────────────────

type FieldOpState = {
  activeOps: ActiveFieldOp[];
  clearedIds: string[];

  getClearedCount: () => number;
  startOp: (opId: string, startDate: string) => void;
  completeOp: (opId: string) => void;
  failOp: (opId: string) => void;
  updateProgress: (opId: string, progress: number) => void;
  load: () => void;
};

export const useFieldOpStore = create<FieldOpState>((set, get) => ({
  activeOps: getJSON<ActiveFieldOp[]>("field_ops_active", []),
  clearedIds: getJSON<string[]>("field_ops_cleared", []),

  getClearedCount: () => {
    return get().clearedIds.length;
  },

  startOp: (opId, startDate) => {
    set((s) => {
      const op: ActiveFieldOp = {
        opId,
        startDate,
        status: "active",
        progress: 0,
      };
      const activeOps = [...s.activeOps, op];
      setJSON("field_ops_active", activeOps);
      return { activeOps };
    });
  },

  completeOp: (opId) => {
    set((s) => {
      const activeOps = s.activeOps.map((op) =>
        op.opId === opId ? { ...op, status: "completed" as const } : op,
      );
      const clearedIds = [...new Set([...s.clearedIds, opId])];
      setJSON("field_ops_active", activeOps);
      setJSON("field_ops_cleared", clearedIds);
      return { activeOps, clearedIds };
    });
  },

  failOp: (opId) => {
    set((s) => {
      const activeOps = s.activeOps.map((op) =>
        op.opId === opId ? { ...op, status: "failed" as const } : op,
      );
      setJSON("field_ops_active", activeOps);
      return { activeOps };
    });
  },

  updateProgress: (opId, progress) => {
    set((s) => {
      const activeOps = s.activeOps.map((op) =>
        op.opId === opId ? { ...op, progress } : op,
      );
      setJSON("field_ops_active", activeOps);
      return { activeOps };
    });
  },

  load: () => {
    const activeOps = getJSON<ActiveFieldOp[]>("field_ops_active", []);
    const clearedIds = getJSON<string[]>("field_ops_cleared", []);
    set({ activeOps, clearedIds });
  },
}));
