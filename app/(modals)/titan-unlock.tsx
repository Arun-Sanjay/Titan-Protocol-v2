import React from "react";
import { useRouter } from "expo-router";
import { TitanUnlockCelebration } from "../../src/components/v2/celebrations/TitanUnlockCelebration";
// Phase 4.1: cloud-backed hooks replace legacy stores.
import { useTitanMode } from "../../src/hooks/queries/useTitanMode";
import { useProgression } from "../../src/hooks/queries/useProgression";
import { useAddNarrativeLogEntry } from "../../src/hooks/queries/useNarrative";
import { useModeStore } from "../../src/stores/useModeStore";
import { useIdentityStore } from "../../src/stores/useIdentityStore";
import { useProfile } from "../../src/hooks/queries/useProfile";
import { getTodayKey } from "../../src/lib/date";

export default function TitanUnlockModal() {
  const router = useRouter();
  // Phase 4.1: cloud-backed titan mode and progression
  const { data: titanData } = useTitanMode();
  const titanState = {
    days: titanData?.consecutive_days ?? 0,
    avgScore: titanData?.average_score ?? 0,
  };
  const totalVotes = useIdentityStore((s) => s.totalVotes);
  const { data: profile } = useProfile();
  const totalXP = profile?.xp ?? 0;
  const { data: progression } = useProgression();
  const addNarrativeEntry = useAddNarrativeLogEntry();

  function handleActivate() {
    const today = getTodayKey();

    // Set mode to titan
    useModeStore.getState().setMode("titan");

    // Narrative entry via cloud mutation
    const firstUseDate = progression?.first_use_date ?? null;
    let dayNumber = 1;
    if (firstUseDate) {
      const start = new Date(firstUseDate + "T00:00:00");
      const now = new Date(today + "T00:00:00");
      dayNumber = Math.max(1, Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1);
    }

    addNarrativeEntry.mutate({
      dateKey: today,
      type: "milestone",
      text: `Day ${dayNumber}: Titan Mode activated. The ultimate challenge begins. No weak links. No excuses.`,
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
