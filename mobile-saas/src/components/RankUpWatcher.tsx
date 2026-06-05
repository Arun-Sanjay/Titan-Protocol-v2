import { useEffect, useRef } from "react";
import {
  usePendingRankUps,
  useDismissRankUp,
} from "../hooks/queries/useRankUps";
import { useCelebration } from "./CelebrationProvider";
import { rankForLevel } from "../lib/ranks";

/**
 * Watches the `rank_up_events` queue and fires the themed celebration when a
 * new level-up lands, then dismisses the event(s) so they don't replay. RN port
 * of web's `app/(os)/components/RankUpWatcher.tsx`.
 *
 * One banner per burst (the highest level reached). If the burst crosses a
 * rank-tier name boundary it shows "RANK UP"; a same-tier level-up shows
 * "LEVEL UP". A ref guards against re-firing the same event across renders /
 * before the dismiss propagates. Renders nothing.
 */
export function RankUpWatcher() {
  const { data: pending } = usePendingRankUps();
  const dismiss = useDismissRankUp();
  const { celebrateRankUp } = useCelebration();
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!pending || pending.length === 0) return;
    const fresh = pending.filter((e) => !seen.current.has(e.id));
    if (fresh.length === 0) return;
    fresh.forEach((e) => seen.current.add(e.id));

    const top = fresh.reduce((a, b) => (b.to_level > a.to_level ? b : a));
    const lowestFrom = fresh.reduce(
      (a, b) => (b.from_level < a.from_level ? b : a),
    ).from_level;
    const toRank = rankForLevel(top.to_level);
    const isMajor = rankForLevel(lowestFrom).name !== toRank.name;

    celebrateRankUp({
      rankName: toRank.name,
      level: top.to_level,
      color: toRank.color,
      isMajor,
    });

    fresh.forEach((e) => dismiss.mutate(e.id));
  }, [pending, celebrateRankUp, dismiss]);

  return null;
}
