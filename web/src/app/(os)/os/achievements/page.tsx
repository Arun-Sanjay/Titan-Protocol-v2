import * as React from "react";

import {
  ALL_ACHIEVEMENTS,
  isSupportedOnWeb,
} from "@/lib/achievement-checker";
import { useUnlockedAchievements } from "@/hooks/queries/useAchievements";

const RARITY_COLOR: Record<string, string> = {
  common: "#9ca3af",
  uncommon: "#34d399",
  rare: "#38bdf8",
  epic: "#a78bfa",
  legendary: "#fbbf24",
};

function formatUnlockedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AchievementsPage() {
  const { data: unlocked } = useUnlockedAchievements();

  const unlockedMap = React.useMemo(() => {
    const m = new Map<string, string>(); // achievement_id → unlocked_at
    for (const row of unlocked ?? []) m.set(row.achievement_id, row.unlocked_at);
    return m;
  }, [unlocked]);

  const unlockedCount = React.useMemo(
    () => ALL_ACHIEVEMENTS.filter((a) => unlockedMap.has(a.id)).length,
    [unlockedMap],
  );

  // Unlocked first (most recent at the top), then everything still locked.
  const sorted = React.useMemo(
    () =>
      [...ALL_ACHIEVEMENTS].sort((a, b) => {
        const ua = unlockedMap.get(a.id);
        const ub = unlockedMap.get(b.id);
        if (ua && ub) return ub.localeCompare(ua);
        if (ua) return -1;
        if (ub) return 1;
        return 0;
      }),
    [unlockedMap],
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header>
        <p className="tp-kicker">Progression</p>
        <h1 className="tp-title text-3xl font-bold md:text-4xl">ACHIEVEMENTS</h1>
        <p className="tp-muted mt-1 text-sm">
          {unlockedCount} / {ALL_ACHIEVEMENTS.length} unlocked
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {sorted.map((a) => {
          const unlockedAt = unlockedMap.get(a.id);
          const isUnlocked = Boolean(unlockedAt);
          const color = RARITY_COLOR[a.rarity] ?? "#9ca3af";
          const supported = isSupportedOnWeb(a.conditionType);

          return (
            <div
              key={a.id}
              className="tp-panel p-4"
              style={{
                opacity: isUnlocked ? 1 : 0.55,
                borderColor: isUnlocked ? `${color}66` : undefined,
                boxShadow: isUnlocked ? `0 0 18px ${color}22` : undefined,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 flex-none items-center justify-center rounded-lg text-lg"
                    style={{
                      background: isUnlocked ? `${color}22` : "rgba(255,255,255,0.04)",
                      border: `1px solid ${isUnlocked ? `${color}66` : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    {isUnlocked ? "🏆" : "🔒"}
                  </div>
                  <div>
                    <p
                      className="text-sm font-semibold"
                      style={{ color: isUnlocked ? "#f5f8ff" : "rgba(245,248,255,0.7)" }}
                    >
                      {a.name}
                    </p>
                    <p className="tp-muted text-xs">{a.description}</p>
                  </div>
                </div>
                <span
                  className="flex-none rounded px-1.5 py-0.5 text-[10px] uppercase tracking-widest"
                  style={{ color, border: `1px solid ${color}66` }}
                >
                  {a.rarity}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs">
                <span style={{ color }}>+{a.xpReward} XP</span>
                {isUnlocked ? (
                  <span className="tp-muted">
                    Unlocked {formatUnlockedAt(unlockedAt!)}
                  </span>
                ) : supported ? (
                  <span className="tp-muted">Locked</span>
                ) : (
                  <span className="tp-muted" title="This achievement's data isn't tracked on web yet — earn it in the mobile app.">
                    Mobile only for now
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
