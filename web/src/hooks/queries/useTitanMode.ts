import { useQuery } from "@tanstack/react-query";
import { useCurrentUserId } from "../../lib/session";
import { getTitanModeState } from "../../services/titan-mode";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const titanModeKeys = {
  all: ["titan_mode_state"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useTitanMode() {
  const userId = useCurrentUserId();
  return useQuery({
    queryKey: titanModeKeys.all,
    queryFn: getTitanModeState,
    enabled: Boolean(userId),
  });
}
