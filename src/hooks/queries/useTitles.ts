import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  listUserTitles,
  equipTitle,
  unequipAllTitles,
} from "../../services/titles";
import type { UserTitle } from "../../services/titles";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const titlesKeys = {
  all: ["user_titles"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useUserTitles() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: titlesKeys.all,
    queryFn: listUserTitles,
    enabled: Boolean(userId),
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useEquipTitle() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: equipTitle,
    onMutate: async (titleId) => {
      await qc.cancelQueries({ queryKey: titlesKeys.all });
      const prev = qc.getQueryData<UserTitle[]>(titlesKeys.all);
      qc.setQueryData<UserTitle[]>(titlesKeys.all, (old) =>
        old?.map((t) => ({ ...t, equipped: t.title_id === titleId })) ?? [],
      );
      return { prev };
    },
    onError: (_err, _titleId, ctx) => {
      if (ctx?.prev) qc.setQueryData(titlesKeys.all, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: titlesKeys.all });
    },
  });
}

export function useUnequipAllTitles() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: unequipAllTitles,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: titlesKeys.all });
      const prev = qc.getQueryData<UserTitle[]>(titlesKeys.all);
      qc.setQueryData<UserTitle[]>(titlesKeys.all, (old) =>
        old?.map((t) => ({ ...t, equipped: false })) ?? [],
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(titlesKeys.all, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: titlesKeys.all });
    },
  });
}
