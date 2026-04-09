/**
 * Phase 4: User titles query hooks.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  equipTitle,
  getEquippedTitle,
  listUserTitles,
  unequipAllTitles,
  unlockTitle,
  type UserTitle,
} from "../../services/titles";

export const titlesKeys = {
  all: ["user_titles"] as const,
  list: () => ["user_titles", "list"] as const,
  equipped: () => ["user_titles", "equipped"] as const,
};

export function useUserTitles() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<UserTitle[]>({
    queryKey: titlesKeys.list(),
    queryFn: listUserTitles,
    enabled: Boolean(userId),
  });
}

export function useEquippedTitle() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<UserTitle | null>({
    queryKey: titlesKeys.equipped(),
    queryFn: getEquippedTitle,
    enabled: Boolean(userId),
  });
}

export function useUnlockTitle() {
  const qc = useQueryClient();
  return useMutation<UserTitle, Error, string>({
    mutationFn: unlockTitle,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: titlesKeys.all });
    },
  });
}

export function useEquipTitle() {
  const qc = useQueryClient();
  return useMutation<UserTitle, Error, string>({
    mutationFn: equipTitle,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: titlesKeys.all });
    },
  });
}

export function useUnequipAllTitles() {
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: unequipAllTitles,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: titlesKeys.all });
    },
  });
}
