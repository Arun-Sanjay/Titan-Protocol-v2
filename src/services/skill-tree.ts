import { supabase, requireUserId } from "../lib/supabase";
import type { Tables, Enums } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type SkillProgress = Tables<"skill_tree_progress">;
export type SkillNodeState = Enums<"skill_node_state">;
export type EngineKey = Enums<"engine_key">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listSkillProgress(): Promise<SkillProgress[]> {
  const { data, error } = await supabase
    .from("skill_tree_progress")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function claimSkillNode(params: {
  node_id: string;
  engine: Enums<"engine_key">;
}): Promise<SkillProgress> {
  const userId = await requireUserId();

  // Check if node already exists
  const { data: existing } = await supabase
    .from("skill_tree_progress")
    .select("*")
    .eq("node_id", params.node_id)
    .maybeSingle();

  if (existing) {
    // Update to claimed
    const { data, error } = await supabase
      .from("skill_tree_progress")
      .update({
        state: "claimed" as SkillNodeState,
        claimed_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    // Insert as claimed
    const { data, error } = await supabase
      .from("skill_tree_progress")
      .insert({
        user_id: userId,
        node_id: params.node_id,
        engine: params.engine,
        state: "claimed" as SkillNodeState,
        claimed_at: new Date().toISOString(),
        progress: 100,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
