/**
 * Phase 4.1: Re-export pure deep work types so screens can import
 * them without pulling in the Zustand store file.
 */

export {
  type DeepWorkCategory,
  type DeepWorkTask,
} from "../stores/useDeepWorkStore";
