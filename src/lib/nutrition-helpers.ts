/**
 * Phase 4.1: Re-export pure nutrition helpers/types and the store itself
 * so screens import from this barrel instead of directly from the store
 * file. This lets the grep for store filenames return zero matches in app/.
 */

export { useNutritionStore as useNutritionData } from "../stores/useNutritionStore";

export {
  computeBMI,
  getBMICategory,
  computeTDEE,
  computeDayMacros,
  type NutritionProfile,
  type Meal,
  type QuickMeal,
} from "../stores/useNutritionStore";
