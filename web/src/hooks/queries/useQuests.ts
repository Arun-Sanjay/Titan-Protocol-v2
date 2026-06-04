import { useQuery } from "@tanstack/react-query";
import { useCurrentUserId } from "../../lib/session";
import { listActiveQuests } from "../../services/quests";
import type { Quest } from "../../services/quests";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const questsKeys = {
  active: ["quests", "active"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useActiveQuests() {
  const userId = useCurrentUserId();
  return useQuery({
    queryKey: questsKeys.active,
    queryFn: listActiveQuests,
    enabled: Boolean(userId),
  });
}
