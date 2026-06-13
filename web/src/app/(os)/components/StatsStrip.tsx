/**
 * Dashboard gamification strip — streak, rank/level, XP-to-next-level, and a
 * "?" explainer. Web previously surfaced none of this (audit §5.6): the
 * streak appeared nowhere, XP/rank hid inside the collapsed account menu, and
 * the 10/day cap + 3× multiplier were never explained. All values come from
 * the Realtime-synced profile, so they update the instant the server XP
 * trigger awards.
 */
import { useState } from "react";
import { useProfile } from "@/hooks/queries/useProfile";
import { getRankForLevel } from "@titan/shared/db/gamification";
import { XP_PER_LEVEL } from "@/lib/xp-math";

export function StatsStrip() {
  const { data: profile } = useProfile();
  const [showInfo, setShowInfo] = useState(false);

  if (!profile) return null;

  const level = profile.level ?? 1;
  const xp = profile.xp ?? 0;
  const streak = profile.streak_current ?? 0;
  const best = profile.streak_best ?? 0;
  const rank = getRankForLevel(level);
  const xpIntoLevel = Math.max(0, xp - (level - 1) * XP_PER_LEVEL);
  const pct = Math.max(0, Math.min(100, Math.round((xpIntoLevel / XP_PER_LEVEL) * 100)));

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 20,
        margin: "12px 0 4px",
        padding: "12px 16px",
        background: "var(--panel, #161616)",
        border: "1px solid var(--stroke, #2a2a2a)",
        borderRadius: 12,
        fontSize: 13,
      }}
    >
      {/* Streak */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 16 }} aria-hidden="true">🔥</span>
        <span style={{ fontWeight: 600, color: "var(--text, #e6e6e6)" }}>
          {streak} day{streak === 1 ? "" : "s"}
        </span>
        <span style={{ color: "var(--muted, #808080)", fontSize: 11 }}>
          streak · best {best}
        </span>
      </div>

      <div style={{ width: 1, height: 22, background: "var(--stroke, #2a2a2a)" }} aria-hidden="true" />

      {/* Rank + level */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontWeight: 600, color: rank.color }}>{rank.name}</span>
        <span style={{ color: "var(--muted, #808080)", fontSize: 11 }}>Level {level}</span>
      </div>

      {/* XP toward next level */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 180 }}>
        <span style={{ color: "var(--muted, #808080)", fontSize: 11, whiteSpace: "nowrap" }}>
          {xpIntoLevel} / {XP_PER_LEVEL} XP
        </span>
        <div
          style={{
            flex: 1,
            height: 5,
            background: "var(--chrome2, #1f1f1f)",
            borderRadius: 999,
            overflow: "hidden",
            minWidth: 80,
          }}
        >
          <div style={{ width: `${pct}%`, height: "100%", background: rank.color, transition: "width 240ms ease-out" }} />
        </div>
      </div>

      <button
        type="button"
        aria-label="How XP and streaks work"
        onClick={() => setShowInfo((v) => !v)}
        style={{
          width: 20,
          height: 20,
          borderRadius: 999,
          border: "1px solid var(--stroke, #2a2a2a)",
          background: "transparent",
          color: "var(--muted, #808080)",
          cursor: "pointer",
          fontSize: 11,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ?
      </button>

      {showInfo && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 8,
            zIndex: 50,
            width: "min(320px, calc(100vw - 40px))",
            padding: 14,
            background: "var(--panel, #1a1a1a)",
            border: "1px solid var(--stroke, #333)",
            borderRadius: 10,
            boxShadow: "0 12px 36px rgba(0,0,0,0.5)",
            fontSize: 12,
            lineHeight: 1.55,
            color: "var(--muted, #b0b0b0)",
          }}
        >
          <p style={{ margin: 0, color: "var(--text, #e6e6e6)", fontWeight: 600 }}>How XP &amp; streaks work</p>
          <p style={{ margin: "8px 0 0" }}>
            Completing a task earns <strong>20 XP</strong> (main) or <strong>10 XP</strong> (secondary),
            multiplied by your streak — up to <strong>3×</strong> at a 10-day streak. The first
            <strong> 10 completions</strong> each day earn XP. Every <strong>{XP_PER_LEVEL} XP</strong> is a level.
          </p>
          <p style={{ margin: "8px 0 0" }}>
            Keep your daily Titan Score at <strong>60%+</strong> to extend your streak; miss a day and it resets.
          </p>
        </div>
      )}
    </div>
  );
}
