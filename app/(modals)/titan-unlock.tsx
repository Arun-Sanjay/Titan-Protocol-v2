import React from "react";
import { useRouter } from "expo-router";
import { TitanUnlockCelebration } from "../../src/components/v2/celebrations/TitanUnlockCelebration";
import { useTitanModeStore } from "../../src/stores/useTitanModeStore";
import { useModeStore } from "../../src/stores/useModeStore";
import { useIdentityStore } from "../../src/stores/useIdentityStore";
import { useProfile } from "../../src/hooks/queries/useProfile";
import { useNarrativeStore } from "../../src/stores/useNarrativeStore";
import { useProgressionStore } from "../../src/stores/useProgressionStore";
import { getTodayKey } from "../../src/lib/date";

export default function TitanUnlockModal() {
  const router = useRouter();
  const titanState = useTitanModeStore((s) => ({
    days: s.consecutiveDays,
    avgScore: s.averageScore,
  }));
  const totalVotes = useIdentityStore((s) => s.totalVotes);
  // Phase 3.5d: read XP from cloud-backed profile.
  const { data: profile } = useProfile();
  const totalXP = profile?.xp ?? 0;

  function handleActivate() {
    const today = getTodayKey();

    // Set mode to titan
    useModeStore.getState().setMode("titan");

    // Narrative entry
    const firstUseDate = useProgressionStore.getState().firstUseDate;
    let dayNumber = 1;
    if (firstUseDate) {
      const start = new Date(firstUseDate + "T00:00:00");
      const now = new Date(today + "T00:00:00");
      dayNumber = Math.max(1, Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1);
    }

    useNarrativeStore.getState().addEntry({
      date: today,
      dayNumber,
      type: "milestone",
      title: "Titan Mode Activated",
      body: `Day ${dayNumber}: Titan Mode activated. The ultimate challenge begins. No weak links. No excuses.`,
      stats: { titanScore: titanState.avgScore, streak: titanState.days },
    });

    router.back();
  }

  function handleLater() {
    router.back();
  }

  return (
    <TitanUnlockCelebration
      stats={{
        days: titanState.days,
        avgScore: titanState.avgScore,
        totalXP,
        totalVotes,
      }}
      onActivate={handleActivate}
      onLater={handleLater}
    />
  );
}
