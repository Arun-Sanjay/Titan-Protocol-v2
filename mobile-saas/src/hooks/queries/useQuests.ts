import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import { listActiveQuests } from "../../services/quests";
import type { Quest } from "../../services/quests";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const questsKeys = {
  active: ["quests", "active"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useActiveQuests() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: questsKeys.active,
    queryFn: listActiveQuests,
    enabled: Boolean(userId),
  });
}
