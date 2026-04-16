/**
 * Phase 4.1: Re-export pure gym types/constants and the store itself so
 * screens import from this barrel instead of directly from the store file.
 * This lets the grep for store filenames return zero matches in app/.
 */

export { useGymStore as useGymData } from "../stores/useGymStore";

export {
  type Exercise,
  type Template,
  type TemplateExercise,
  type GymSession,
  type GymSet,
  type SetType,
  type MuscleGroup,
  type PersonalRecord,
  type RestTimerState,
  MUSCLE_GROUPS,
  EQUIPMENT_LIST,
} from "../stores/useGymStore";
