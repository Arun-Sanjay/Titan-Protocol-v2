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

/**
 * Mark a node as eligible-to-claim (state='ready'). Used by the
 * evaluator when a node's requirement is met but the user hasn't
 * tapped to claim yet. Idempotent — upserts on (user_id, node_id).
 */
export async function setSkillNodeReady(params: {
  node_id: string;
  engine: Enums<"engine_key">;
}): Promise<void> {
  const userId = await requireUserId();
  const { data: existing } = await supabase
    .from("skill_tree_progress")
    .select("id, state")
    .eq("node_id", params.node_id)
    .maybeSingle();
  if (existing) {
    if (existing.state === "claimed") return; // don't downgrade
    await supabase
      .from("skill_tree_progress")
      .update({ state: "ready" as SkillNodeState })
      .eq("id", existing.id);
    return;
  }
  await supabase.from("skill_tree_progress").insert({
    user_id: userId,
    node_id: params.node_id,
    engine: params.engine,
    state: "ready" as SkillNodeState,
    progress: 0,
  });
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
