import React from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { BossDefeatCelebration } from "../../src/components/v2/celebrations/BossDefeatCelebration";
// Phase 4.1: BossChallenge type inlined — no store import needed.
type BossChallenge = {
  id: string;
  title: string;
  description: string;
  requirement: string;
  daysRequired: number;
  currentDay: number;
  dayResults: boolean[];
  xpReward: number;
  active: boolean;
  completed: boolean;
  failed: boolean;
};

export default function BossChallengeModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    title: string;
    daysRequired: string;
    xpReward: string;
  }>();

  // Build a minimal BossChallenge object from params for the celebration component
  const challenge: BossChallenge = {
    id: "defeated",
    title: params.title ?? "Boss",
    description: "",
    requirement: "",
    daysRequired: parseInt(params.daysRequired ?? "3", 10),
    currentDay: parseInt(params.daysRequired ?? "3", 10),
    dayResults: Array(parseInt(params.daysRequired ?? "3", 10)).fill(true),
    xpReward: parseInt(params.xpReward ?? "200", 10),
    active: false,
    completed: true,
    failed: false,
  };

  function handleClaim() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Rewards already claimed in protocol-completion.ts
    // Boss already cleared from store
    router.back();
  }

  return <BossDefeatCelebration challenge={challenge} onClaim={handleClaim} />;
}
