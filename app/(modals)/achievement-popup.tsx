import React, { useEffect, useCallback } from "react";
import { useRouter } from "expo-router";
import { AchievementPopup } from "../../src/components/v2/achievements/AchievementPopup";
// Phase 4.1: achievement store from barrel — no direct store import.
import { useAchievementData } from "../../src/lib/achievement-helpers";
import { useAwardXP } from "../../src/hooks/queries/useProfile";
import { useEnqueueRankUp } from "../../src/hooks/queries/useRankUps";

export default function AchievementPopupModal() {
  const router = useRouter();
  const pendingCelebration = useAchievementData((s) => s.pendingCelebration);
  const dismissCelebration = useAchievementData((s) => s.dismissCelebration);
  // Phase 3.5d: achievement XP is awarded via the cloud mutation so it
  // survives cross-device sync. The pending queue itself stays in the
  // legacy achievement store for now (it's an unlock queue, not a
  // data-bearing write).
  const awardXPMutation = useAwardXP();
  const enqueueRankUpMutation = useEnqueueRankUp();

  // Dismiss modal only when no more celebrations (queue empty + pending null)
  useEffect(() => {
    if (!pendingCelebration) {
      router.back();
    }
  }, [pendingCelebration, router]);

  const handleDismiss = useCallback(async () => {
    if (!pendingCelebration) return;
    try {
      const xpResult = await awardXPMutation.mutateAsync(pendingCelebration.xpReward);
      if (xpResult.leveledUp) {
        await enqueueRankUpMutation.mutateAsync({
          fromLevel: xpResult.fromLevel,
          toLevel: xpResult.toLevel,
        });
      }
    } catch (_e) {
      // Non-fatal: unlock is still recorded in the achievement store.
    }
    // Advance queue (sets next pendingCelebration or null)
    dismissCelebration();
  }, [pendingCelebration, awardXPMutation, enqueueRankUpMutation, dismissCelebration]);

  if (!pendingCelebration) return null;

  return <AchievementPopup achievement={pendingCelebration} onDismiss={handleDismiss} />;
}
