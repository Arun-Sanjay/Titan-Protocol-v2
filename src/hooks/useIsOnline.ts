import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

/**
 * Simple hook that returns whether the device has network connectivity.
 * Used by OfflineBanner and any component that needs to adapt UI
 * when the user is offline.
 */
export function useIsOnline(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(
        state.isConnected !== null ? state.isConnected : true,
      );
    });
    return unsubscribe;
  }, []);

  return isOnline;
}
