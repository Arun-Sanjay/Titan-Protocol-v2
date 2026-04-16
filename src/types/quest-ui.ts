import type { Tables } from "./supabase";

export type QuestType = "engine" | "cross_engine" | "wildcard";

/** Shape the UI renders. Cloud rows are mapped into this via mapCloudQuest. */
export type Quest = {
  id: string;
  templateId?: string;
  type: QuestType;
  title: string;
  description: string;
  targetType: string;
  targetEngine: string | undefined | null;
  targetValue: number;
  currentValue: number;
  xpReward: number;
  status: "active" | "completed" | "failed";
  completed: boolean;
  active: boolean;
  createdAt?: string;
};

export type BossChallenge = {
  id: string;
  title: string;
  description: string;
  requirement?: string;
  daysRequired: number;
  currentDay: number;
  dayResults: boolean[];
  active: boolean;
  completed: boolean;
  failed: boolean;
  xpReward: number;
};

/** Map a Supabase `quests` row into the UI shape. */
export function mapCloudQuest(row: Tables<"quests">): Quest {
  const metadata = (row.metadata as { type?: QuestType; targetType?: string; targetEngine?: string | null } | null) ?? {};
  const status = row.status as "active" | "completed" | "failed";
  return {
    id: row.id,
    type: metadata.type ?? "engine",
    title: row.title,
    description: row.description ?? "",
    targetType: metadata.targetType ?? "completion",
    targetEngine: metadata.targetEngine ?? null,
    targetValue: row.target ?? 0,
    currentValue: row.progress ?? 0,
    xpReward: row.xp_reward ?? 0,
    status,
    completed: status === "completed",
    active: status === "active",
    createdAt: row.created_at,
  };
}

export function selectActiveQuests(quests: Quest[]): Quest[] {
  return quests.filter((q) => q.active && !q.completed);
}
