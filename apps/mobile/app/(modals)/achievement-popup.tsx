import React, { useEffect } from "react";
import { useRouter } from "expo-router";
import { AchievementPopup } from "../../src/components/v2/achievements/AchievementPopup";
import { useAchievementStore } from "../../src/stores/useAchievementStore";
import { useProfileStore } from "../../src/stores/useProfileStore";
import { getTodayKey } from "../../src/lib/date";

export default function AchievementPopupModal() {
  const router = useRouter();
  const pendingCelebration = useAchievementStore((s) => s.pendingCelebration);
  const dismissCelebration = useAchievementStore((s) => s.dismissCelebration);

  // Dismiss modal only when no more celebrations (queue empty + pending null)
  useEffect(() => {
    if (!pendingCelebration) {
      router.back();
    }
  }, [pendingCelebration]);

  if (!pendingCelebration) return null;

  function handleDismiss() {
    // Award XP for this achievement
    const today = getTodayKey();
    useProfileStore.getState().awardXP(today, "achievement", pendingCelebration!.xpReward);
    // Advance queue (sets next pendingCelebration or null)
    dismissCelebration();
    // If queue is now empty, useEffect will navigate back
    // If queue has more, component re-renders with next achievement
  }

  return <AchievementPopup achievement={pendingCelebration} onDismiss={handleDismiss} />;
}
