import { supabase, requireUserId } from "../lib/supabase";

export async function addNarrativeLogEntry(entry: {
  date_key: string;
  text: string;
  type: string;
}): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from("narrative_log").insert({
    user_id: userId,
    date_key: entry.date_key,
    text: entry.text,
    type: entry.type,
  });
  if (error) throw error;
}

export async function listNarrativeLog(limit = 100) {
  const { data, error } = await supabase
    .from("narrative_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
