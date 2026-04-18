import { useEffect } from "react";
import { useAuthStore } from "../stores/useAuthStore";
import { startBackgroundSync, stopBackgroundSync } from "../sync/engine";

/**
 * Mount point for the sync engine. Starts the engine when a user signs
 * in, stops it when they sign out. Must live inside QueryClientProvider
 * so the engine's invalidate-on-pull uses the active queryClient.
 */
export function SyncEngineMount(): null {
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!userId) {
      stopBackgroundSync();
      return;
    }
    startBackgroundSync(userId);
    return () => {
      stopBackgroundSync();
    };
  }, [userId]);

  return null;
}
