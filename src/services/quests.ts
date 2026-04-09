/**
 * Phase 4: Quests service.
 *
 * Quests are weekly. The week is identified by the Monday date_key
 * (week_start_key). One quest row per (user, week_start_key, type) so
 * the same template can recur across weeks.
 */

import { supabase, requireUserId } from "../lib/supabase";
import type { Tables, TablesInsert, TablesUpdate, Enums } from "../types/supabase";

export type Quest = Tables<"quests">;
export type QuestStatus = Enums<"quest_status">;

export async function listQuestsForWeek(weekStartKey: string): Promise<Quest[]> {
  const { data, error } = await supabase
    .from("quests")
    .select("*")
    .eq("week_start_key", weekStartKey)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listAllActiveQuests(): Promise<Quest[]> {
  const { data, error } = await supabase
    .from("quests")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type CreateQuestInput = {
  weekStartKey: string;
  type: string;
  title: string;
  description: string;
  target: number;
  xpReward?: number;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
};

export async function createQuest(input: CreateQuestInput): Promise<Quest> {
  const userId = await requireUserId();
  const row: TablesInsert<"quests"> = {
    user_id: userId,
    week_start_key: input.weekStartKey,
    type: input.type,
    title: input.title,
    description: input.description,
    target: input.target,
    progress: 0,
    status: "active",
    xp_reward: input.xpReward ?? 0,
    expires_at: input.expiresAt ?? null,
    metadata: (input.metadata ?? {}) as never,
  };
  const { data, error } = await supabase
    .from("quests")
    .upsert(row, { onConflict: "user_id,week_start_key,type" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export type UpdateQuestProgressInput = {
  id: string;
  progress: number;
};

export async function updateQuestProgress(
  input: UpdateQuestProgressInput,
): Promise<Quest> {
  const { data, error } = await supabase
    .from("quests")
    .update({ progress: input.progress })
    .eq("id", input.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function completeQuest(id: string): Promise<Quest> {
  const patch: TablesUpdate<"quests"> = { status: "completed" };
  const { data, error } = await supabase
    .from("quests")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function failQuest(id: string): Promise<Quest> {
  const { data, error } = await supabase
    .from("quests")
    .update({ status: "failed" })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
