import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  getNutritionProfile,
  upsertNutritionProfile,
  listMealLogs,
  createMealLog,
  deleteMealLog,
  listQuickMeals,
  createQuickMeal,
  deleteQuickMeal,
  getWaterLog,
  adjustWaterGlasses,
  type NutritionProfile,
  type MealLog,
  type QuickMeal,
  type WaterLog,
} from "../../services/nutrition";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const nutritionKeys = {
  profile: ["nutrition_profile"] as const,
  meals: ["meal_logs"] as const,
  quickMeals: ["quick_meals"] as const,
  water: (dateKey: string) => ["water_logs", dateKey] as const,
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

// ─── Quick Meals ───────────────────────────────────────────────────────────

export function useQuickMeals() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: nutritionKeys.quickMeals,
    queryFn: listQuickMeals,
    enabled: Boolean(userId),
  });
}

export function useCreateQuickMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createQuickMeal,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: nutritionKeys.quickMeals });
    },
  });
}

export function useDeleteQuickMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteQuickMeal,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: nutritionKeys.quickMeals });
      const prev = qc.getQueryData<QuickMeal[]>(nutritionKeys.quickMeals);
      qc.setQueryData<QuickMeal[]>(nutritionKeys.quickMeals, (old) =>
        old?.filter((m) => m.id !== id) ?? [],
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(nutritionKeys.quickMeals, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: nutritionKeys.quickMeals });
    },
  });
}

// ─── Water Log ─────────────────────────────────────────────────────────────

export function useWaterLog(dateKey: string) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: nutritionKeys.water(dateKey),
    queryFn: () => getWaterLog(dateKey),
    enabled: Boolean(userId),
  });
}

export function useAdjustWater() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { dateKey: string; delta: number }) =>
      adjustWaterGlasses(vars.dateKey, vars.delta),
    onMutate: async (vars) => {
      const key = nutritionKeys.water(vars.dateKey);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<WaterLog | null>(key);
      const currentGlasses = prev?.glasses ?? 0;
      const next = Math.max(0, currentGlasses + vars.delta);
      qc.setQueryData<WaterLog | null>(key, (old) =>
        old
          ? { ...old, glasses: next }
          : ({
              id: "optimistic",
              user_id: "",
              date_key: vars.dateKey,
              glasses: next,
              updated_at: new Date().toISOString(),
            } as WaterLog),
      );
      return { prev };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prev !== undefined)
        qc.setQueryData(nutritionKeys.water(vars.dateKey), ctx.prev);
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: nutritionKeys.water(vars.dateKey) });
    },
  });
}
