import React from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { BossDefeatCelebration } from "../../src/components/v2/celebrations/BossDefeatCelebration";
import type { BossChallenge } from "../../src/stores/useQuestStore";

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
