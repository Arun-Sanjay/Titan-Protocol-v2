import React from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { PerfectDayCelebration } from "../../src/components/v2/celebrations/PerfectDayCelebration";

export default function PerfectDayModal() {
  const router = useRouter();
  const { xp } = useLocalSearchParams<{ xp: string }>();
  const xpAmount = parseInt(xp ?? "100", 10);

  return (
    <PerfectDayCelebration
      xpAmount={xpAmount}
      onClaim={() => router.back()}
    />
  );
}
