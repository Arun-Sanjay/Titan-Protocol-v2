import React from "react";
import { LevelUpOverlay } from "./ui/LevelUpOverlay";
import {
  usePendingRankUps,
  useDismissRankUp,
} from "../hooks/queries/useRankUps";

/**
 * Phase 3.5d: Cloud-backed rank-up overlay mount.
 *
 * Reads the pending rank-ups queue from Supabase via React Query and
 * renders the head of the list. On dismiss, fires the
 * useDismissRankUp mutation (which optimistically removes the row
 * from the cache so the next event slides in instantly).
 *
 * Replaces the Phase 2.1E mount in app/_layout.tsx that read from
 * useProfileStore.pendingRankUps[0]. The store-backed queue stays in
 * place for now but is no longer the source of truth — the migration
 * script copies any pending events into rank_up_events on first run,
 * and new events go straight to Supabase via useEnqueueRankUp from
 * the consumer cutover commits.
 *
 * Lives inside the QueryClientProvider tree (mounted from
 * app/_layout.tsx authenticated render path).
 */
export function RankUpOverlayMount(): React.ReactElement | null {
  const { data: pending = [] } = usePendingRankUps();
  const dismissMutation = useDismissRankUp();

  const head = pending[0];
  if (!head) return null;

  return (
    <LevelUpOverlay
      key={head.id}
      newLevel={head.to_level}
      onDismiss={() => dismissMutation.mutate(head.id)}
    />
  );
}
