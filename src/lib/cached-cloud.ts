import { queryClient } from "./query-client";
import { profileQueryKey } from "../hooks/queries/useProfile";
import { protocolKeys } from "../hooks/queries/useProtocol";
import { questsKeys } from "../hooks/queries/useQuests";
import { bossChallengesKeys } from "../hooks/queries/useBossChallenges";
import { mindTrainingKeys } from "../hooks/queries/useMindTraining";
import { mapCloudQuest, type Quest } from "../types/quest-ui";
import { mapCloudBossChallenge, type BossChallenge } from "../types/boss-ui";
import type { Tables } from "../types/supabase";

export type MindTrainingRow = Tables<"mind_training_results">;

type CachedProfile = {
  xp?: number;
  level?: number;
  streak_current?: number;
  streak_best?: number;
  streak_last_date?: string | null;
};

type CachedProtocolSession = {
  morning_completed_at?: string | null;
  evening_completed_at?: string | null;
} | null;

export function cachedStreakCurrent(): number {
  return queryClient.getQueryData<CachedProfile>(profileQueryKey)?.streak_current ?? 0;
}

export function cachedStreakBest(): number {
  return queryClient.getQueryData<CachedProfile>(profileQueryKey)?.streak_best ?? 0;
}

export function cachedTodayCompleted(dateKey: string): boolean {
  const session = queryClient.getQueryData<CachedProtocolSession>(
    protocolKeys.session(dateKey),
  );
  return Boolean(session?.evening_completed_at);
}

export function cachedActiveQuests(): Quest[] {
  const rows = queryClient.getQueryData<Tables<"quests">[]>(questsKeys.active) ?? [];
  return rows.map(mapCloudQuest);
}

export function cachedActiveBossChallenge(): BossChallenge | null {
  const rows =
    queryClient.getQueryData<Tables<"boss_challenges">[]>(bossChallengesKeys.active) ?? [];
  const first = rows[0];
  return first ? mapCloudBossChallenge(first) : null;
}

export function cachedMindTrainingResults(): MindTrainingRow[] {
  return queryClient.getQueryData<MindTrainingRow[]>(mindTrainingKeys.results) ?? [];
}

export function cachedTitanModeUnlocked(): boolean {
  const row = queryClient.getQueryData<Tables<"titan_mode_state"> | null>([
    "titan_mode_state",
  ]);
  return Boolean(row?.unlocked);
}

export function cachedCurrentPhase(): string {
  const row = queryClient.getQueryData<Tables<"progression"> | null>(["progression"]);
  return row?.current_phase ?? "foundation";
}

export function cachedCurrentWeek(): number {
  const row = queryClient.getQueryData<Tables<"progression"> | null>(["progression"]);
  return row?.current_week ?? 1;
}
