/**
 * Phase 4: Skill tree progress service.
 *
 * One row per (user, engine, node_id). State enum:
 *   - locked   — prerequisites not met
 *   - ready    — eligible to claim, awaiting tap
 *   - claimed  — fully unlocked
 *
 * The tree definitions live in src/data/skill-trees.json (static) so
 * the cloud only stores the per-user progress.
 */

import { supabase, requireUserId } from "../lib/supabase";
import type { Tables, TablesInsert, Enums } from "../types/supabase";

export type SkillProgress = Tables<"skill_tree_progress">;
export type SkillNodeState = Enums<"skill_node_state">;
export type EngineKey = Enums<"engine_key">;

export async function listSkillProgress(engine?: EngineKey): Promise<SkillProgress[]> {
  let query = supabase.from("skill_tree_progress").select("*");
  if (engine) query = query.eq("engine", engine);
  const { data, error } = await query.order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type UpsertSkillNodeInput = {
  engine: EngineKey;
  nodeId: string;
  state: SkillNodeState;
  progress?: number;
};

export async function upsertSkillNode(
  input: UpsertSkillNodeInput,
): Promise<SkillProgress> {
  const userId = await requireUserId();
  const row: TablesInsert<"skill_tree_progress"> = {
    user_id: userId,
    engine: input.engine,
    node_id: input.nodeId,
    state: input.state,
    progress: input.progress ?? 0,
    claimed_at: input.state === "claimed" ? new Date().toISOString() : null,
  };
  const { data, error } = await supabase
    .from("skill_tree_progress")
    .upsert(row, { onConflict: "user_id,engine,node_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function unlockSkillNode(
  engine: EngineKey,
  nodeId: string,
): Promise<SkillProgress> {
  return upsertSkillNode({ engine, nodeId, state: "ready" });
}

export async function claimSkillNode(
  engine: EngineKey,
  nodeId: string,
): Promise<SkillProgress> {
  return upsertSkillNode({ engine, nodeId, state: "claimed" });
}

export async function updateSkillNodeProgress(
  engine: EngineKey,
  nodeId: string,
  progress: number,
): Promise<SkillProgress> {
  return upsertSkillNode({ engine, nodeId, state: "locked", progress });
}
