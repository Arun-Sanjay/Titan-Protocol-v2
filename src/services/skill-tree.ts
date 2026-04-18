import { requireUserId } from "../lib/supabase";
import {
  newId,
  sqliteList,
  sqliteUpsert,
} from "../db/sqlite/service-helpers";
import type { Tables, Enums } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type SkillProgress = Tables<"skill_tree_progress">;
export type SkillNodeState = Enums<"skill_node_state">;
export type EngineKey = Enums<"engine_key">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listSkillProgress(): Promise<SkillProgress[]> {
  return sqliteList<SkillProgress>("skill_tree_progress", {
    order: "updated_at DESC",
  });
}

/**
 * Mark a node as eligible-to-claim (state='ready'). Used by the
 * evaluator when a node's requirement is met but the user hasn't
 * tapped to claim yet. Idempotent — upserts by node_id.
 */
export async function setSkillNodeReady(params: {
  node_id: string;
  engine: Enums<"engine_key">;
}): Promise<void> {
  const userId = await requireUserId();
  const [existing] = await sqliteList<SkillProgress>("skill_tree_progress", {
    where: "node_id = ?",
    params: [params.node_id],
    limit: 1,
  });

  if (existing) {
    if (existing.state === "claimed") return; // don't downgrade
    await sqliteUpsert("skill_tree_progress", {
      ...existing,
      state: "ready" as SkillNodeState,
    });
    return;
  }

  const now = new Date().toISOString();
  const row: SkillProgress = {
    id: newId(),
    user_id: userId,
    node_id: params.node_id,
    engine: params.engine,
    state: "ready" as SkillNodeState,
    progress: 0,
    claimed_at: null,
    updated_at: now,
  };
  await sqliteUpsert("skill_tree_progress", row);
}

export async function claimSkillNode(params: {
  node_id: string;
  engine: Enums<"engine_key">;
}): Promise<SkillProgress> {
  const userId = await requireUserId();
  const now = new Date().toISOString();

  const [existing] = await sqliteList<SkillProgress>("skill_tree_progress", {
    where: "node_id = ?",
    params: [params.node_id],
    limit: 1,
  });

  if (existing) {
    const merged: SkillProgress = {
      ...existing,
      state: "claimed" as SkillNodeState,
      claimed_at: now,
    };
    return sqliteUpsert("skill_tree_progress", merged);
  }

  const row: SkillProgress = {
    id: newId(),
    user_id: userId,
    node_id: params.node_id,
    engine: params.engine,
    state: "claimed" as SkillNodeState,
    claimed_at: now,
    progress: 100,
    updated_at: now,
  };
  return sqliteUpsert("skill_tree_progress", row);
}
