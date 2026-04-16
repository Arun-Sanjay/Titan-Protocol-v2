import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  getNutritionProfile,
  upsertNutritionProfile,
  listMealLogs,
  createMealLog,
  deleteMealLog,
  type NutritionProfile,
  type MealLog,
} from "../../services/nutrition";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const nutritionKeys = {
  profile: ["nutrition_profile"] as const,
  meals: ["meal_logs"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useNutritionProfile() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: nutritionKeys.profile,
    queryFn: getNutritionProfile,
    enabled: Boolean(userId),
  });
}

export function useMealLogs() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: nutritionKeys.meals,
    queryFn: listMealLogs,
    enabled: Boolean(userId),
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useUpsertNutritionProfile() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: upsertNutritionProfile,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: nutritionKeys.profile });
      const prev = qc.getQueryData<NutritionProfile | null>(
        nutritionKeys.profile,
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined)
        qc.setQueryData(nutritionKeys.profile, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: nutritionKeys.profile });
    },
  });
}

export function useCreateMealLog() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: createMealLog,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: nutritionKeys.meals });
      const prev = qc.getQueryData<MealLog[]>(nutritionKeys.meals);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(nutritionKeys.meals, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: nutritionKeys.meals });
    },
  });
}

export function useDeleteMealLog() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: deleteMealLog,
    onMutate: async (mealId) => {
      await qc.cancelQueries({ queryKey: nutritionKeys.meals });
      const prev = qc.getQueryData<MealLog[]>(nutritionKeys.meals);
      qc.setQueryData<MealLog[]>(nutritionKeys.meals, (old) =>
        old?.filter((m) => m.id !== mealId) ?? [],
      );
      return { prev };
    },
    onError: (_err, _mealId, ctx) => {
      if (ctx?.prev) qc.setQueryData(nutritionKeys.meals, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: nutritionKeys.meals });
    },
  });
}
