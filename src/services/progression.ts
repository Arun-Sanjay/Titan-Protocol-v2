import { requireUserId } from "../lib/supabase";
import {
  sqliteGet,
  sqliteUpsert,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";
import type { Json } from "../types/supabase";

export type Progression = Tables<"progression">;

export async function getProgression(): Promise<Progression | null> {
  const userId = await requireUserId();
  return sqliteGet<Progression>("progression", { user_id: userId });
}

export async function upsertProgression(params: {
  current_phase?: string;
  current_week?: number;
  phase_start_week?: number;
  first_use_date?: string;
  phase_start_date?: string;
  phase_history?: Json;
}): Promise<Progression> {
  const userId = await requireUserId();
  const existing = await sqliteGet<Progression>("progression", {
    user_id: userId,
  });
  const base: Progression = existing ?? {
    user_id: userId,
    current_phase: "foundation",
    current_week: 0,
    phase_start_week: 0,
    first_use_date: null,
    phase_start_date: null,
    phase_history: [],
    updated_at: new Date().toISOString(),
  };
  const merged: Progression = {
    ...base,
    ...(params.current_phase !== undefined && {
      current_phase: params.current_phase as Progression["current_phase"],
    }),
    ...(params.current_week !== undefined && { current_week: params.current_week }),
    ...(params.phase_start_week !== undefined && { phase_start_week: params.phase_start_week }),
    ...(params.first_use_date !== undefined && { first_use_date: params.first_use_date }),
    ...(params.phase_start_date !== undefined && { phase_start_date: params.phase_start_date }),
    ...(params.phase_history !== undefined && { phase_history: params.phase_history }),
  };
  return sqliteUpsert("progression", merged);
}
