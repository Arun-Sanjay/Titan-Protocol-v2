import { create } from "zustand";
import { getJSON } from "../db/storage";
import {
  getAvailableFieldOps,
  getActiveFieldOp,
  startFieldOp,
  evaluateFieldOpDay,
  completeFieldOp,
  failFieldOp,
  abandonFieldOp,
  getFieldOpHistory,
  getClearedCount,
  isOnCooldown,
} from "../lib/field-ops";
import type {
  FieldOpDef,
  ActiveFieldOp,
  FieldOpHistoryEntry,
} from "../lib/field-ops";

type FieldOpState = {
  activeFieldOp: ActiveFieldOp | null;
  history: FieldOpHistoryEntry[];
  cooldownUntil: string | null;

  load: () => void;
  getAvailable: (rank: string) => FieldOpDef[];
  start: (fieldOpId: string) => void;
  evaluateDay: (
    engineScores: Record<string, number>,
    titanScore: number,
  ) => "passed" | "failed" | "completed" | null;
  complete: () => FieldOpDef;
  fail: () => void;
  abandon: () => void;
  getClearedCount: () => number;
};

export const useFieldOpStore = create<FieldOpState>()((set, _get) => ({
  activeFieldOp: null,
  history: [],
  cooldownUntil: null,

  load: () => {
    set({
      activeFieldOp: getActiveFieldOp(),
      history: getFieldOpHistory(),
      cooldownUntil: getJSON<string | null>("field_op_cooldown", null),
    });
  },

  getAvailable: (rank) => {
    return getAvailableFieldOps(rank);
  },

  start: (fieldOpId) => {
    startFieldOp(fieldOpId);
    set({
      activeFieldOp: getActiveFieldOp(),
      cooldownUntil: getJSON<string | null>("field_op_cooldown", null),
    });
  },

  evaluateDay: (engineScores, titanScore) => {
    const result = evaluateFieldOpDay(engineScores, titanScore);
    set({
      activeFieldOp: getActiveFieldOp(),
      history: getFieldOpHistory(),
      cooldownUntil: getJSON<string | null>("field_op_cooldown", null),
    });
    return result;
  },

  complete: () => {
    const def = completeFieldOp();
    set({
      activeFieldOp: null,
      history: getFieldOpHistory(),
    });
    return def;
  },

  fail: () => {
    failFieldOp();
    set({
      activeFieldOp: null,
      history: getFieldOpHistory(),
      cooldownUntil: getJSON<string | null>("field_op_cooldown", null),
    });
  },

  abandon: () => {
    abandonFieldOp();
    set({
      activeFieldOp: null,
      history: getFieldOpHistory(),
      cooldownUntil: getJSON<string | null>("field_op_cooldown", null),
    });
  },

  getClearedCount: () => {
    return getClearedCount();
  },
}));
