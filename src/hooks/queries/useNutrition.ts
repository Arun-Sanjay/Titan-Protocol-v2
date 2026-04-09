/**
 * Phase 4: Nutrition query hooks (profile + meal logs).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  createMealLog,
  deleteMealLog,
  getNutritionProfile,
  listMealLogs,
  listMealLogsForRange,
  updateMealLog,
  upsertNutritionProfile,
  type CreateMealLogInput,
  type MealLog,
  type NutritionProfile,
  type UpdateMealLogInput,
} from "../../services/nutrition";

// ─── Profile ────────────────────────────────────────────────────────────────

export const nutritionProfileKey = ["nutrition_profile"] as const;

export function useNutritionProfile() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<NutritionProfile | null>({
    queryKey: nutritionProfileKey,
    queryFn: getNutritionProfile,
    enabled: Boolean(userId),
  });
}

export function useUpsertNutritionProfile() {
  const qc = useQueryClient();
  return useMutation<
    NutritionProfile,
    Error,
    Parameters<typeof upsertNutritionProfile>[0]
  >({
    mutationFn: upsertNutritionProfile,
    onSuccess: (profile) => {
      qc.setQueryData<NutritionProfile | null>(nutritionProfileKey, profile);
    },
  });
}

// ─── Meal logs ──────────────────────────────────────────────────────────────

export const mealsKeys = {
  all: ["meals"] as const,
  byDate: (dateKey: string) => ["meals", "date", dateKey] as const,
  byRange: (start: string, end: string) => ["meals", "range", start, end] as const,
};

export function useMealLogs(dateKey: string) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<MealLog[]>({
    queryKey: mealsKeys.byDate(dateKey),
    queryFn: () => listMealLogs(dateKey),
    enabled: Boolean(userId),
  });
}

export function useMealLogsRange(startDateKey: string, endDateKey: string) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<MealLog[]>({
    queryKey: mealsKeys.byRange(startDateKey, endDateKey),
    queryFn: () => listMealLogsForRange(startDateKey, endDateKey),
    enabled: Boolean(userId),
  });
}

export function useCreateMealLog() {
  const qc = useQueryClient();
  return useMutation<MealLog, Error, CreateMealLogInput>({
    mutationFn: createMealLog,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: mealsKeys.all });
    },
  });
}

export function useUpdateMealLog() {
  const qc = useQueryClient();
  return useMutation<MealLog, Error, UpdateMealLogInput>({
    mutationFn: updateMealLog,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: mealsKeys.all });
    },
  });
}

export function useDeleteMealLog() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteMealLog,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: mealsKeys.all });
    },
  });
}
