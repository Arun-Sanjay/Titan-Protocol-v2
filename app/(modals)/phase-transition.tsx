import React from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { PhaseTransition } from "../../src/components/v2/progression/PhaseTransition";
// Phase 4.1: cloud-backed hooks replace legacy stores.
import { useProgression } from "../../src/hooks/queries/useProgression";
import { useAddNarrativeLogEntry } from "../../src/hooks/queries/useNarrative";
import { useIdentityStore, selectIdentityMeta } from "../../src/stores/useIdentityStore";
import { getTodayKey } from "../../src/lib/date";
import type { Phase, PhaseStats } from "../../src/lib/progression-engine";

export default function PhaseTransitionModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    oldPhase: string;
    newPhase: string;
    avgScore: string;
    daysCompleted: string;
    totalDays: string;
    bestStreak: string;
    bestRank: string;
  }>();

  const archetype = useIdentityStore((s) => s.archetype);
  const meta = selectIdentityMeta(archetype);
  // Phase 4.1: cloud-backed progression
  const { data: progression } = useProgression();
  const firstUseDate = progression?.first_use_date ?? null;
  const addNarrativeEntry = useAddNarrativeLogEntry();

  const oldPhase = (params.oldPhase ?? "foundation") as Phase;
  const newPhase = (params.newPhase ?? "building") as Phase;
  const stats: PhaseStats = {
    avgScore: parseInt(params.avgScore ?? "0", 10),
    daysCompleted: parseInt(params.daysCompleted ?? "0", 10),
    totalDays: parseInt(params.totalDays ?? "28", 10),
    bestStreak: parseInt(params.bestStreak ?? "0", 10),
    bestRank: params.bestRank ?? "D",
  };

  function handleComplete() {
    const today = getTodayKey();

    // Add narrative entry
    let dayNumber = 1;
    if (firstUseDate) {
      const start = new Date(firstUseDate + "T00:00:00");
      const now = new Date(today + "T00:00:00");
      dayNumber = Math.max(1, Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1);
    }

    const newLabel = newPhase.charAt(0).toUpperCase() + newPhase.slice(1);
    addNarrativeEntry.mutate({
      dateKey: today,
      type: "phase",
      text: `${meta?.name ?? "You"} enters ${newLabel} Phase. Average improved to ${stats.avgScore}%. ${stats.daysCompleted} days completed.`,
    });

    router.back();
  }

  return (
    <PhaseTransition
      oldPhase={oldPhase}
      newPhase={newPhase}
      stats={stats}
      onComplete={handleComplete}
    />
  );
}
