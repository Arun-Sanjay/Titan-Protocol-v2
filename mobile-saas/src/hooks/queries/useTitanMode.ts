import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/useAuthStore";
import { getTitanModeState } from "../../services/titan-mode";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const titanModeKeys = {
  all: ["titan_mode_state"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useTitanMode() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: titanModeKeys.all,
    queryFn: getTitanModeState,
    enabled: Boolean(userId),
  });
}
