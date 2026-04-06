import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { colors, spacing, fonts, radius } from "../../theme";
import { useProfileStore } from "../../stores/useProfileStore";
import { useEngineStore, ENGINES, selectTotalScore } from "../../stores/useEngineStore";
import { useIdentityStore, selectIdentityMeta } from "../../stores/useIdentityStore";
import { useModeStore, IDENTITY_LABELS } from "../../stores/useModeStore";
import { getDailyRank } from "../../db/gamification";
import { getDayNumber } from "../../data/chapters";
import { getJSON } from "../../db/storage";
import { getTodayKey } from "../../lib/date";
import type { EngineKey } from "../../db/schema";

// ─── Engine display metadata ──────────────────────────────────────────────────

const ENGINE_META: Record<EngineKey, { label: string; color: string }> = {
  body: { label: "BODY", color: colors.body },
  mind: { label: "MIND", color: colors.mind },
  money: { label: "MONEY", color: colors.money },
  charisma: { label: "CHARISMA", color: colors.charisma },
};

// ─── Archetype icon map ───────────────────────────────────────────────────────

const ARCHETYPE_ICONS: Record<string, string> = {
  titan: "\u26A1",
  athlete: "\uD83C\uDFCB\uFE0F",
  scholar: "\uD83D\uDCDA",
  hustler: "\uD83D\uDCC8",
  showman: "\uD83C\uDFA4",
  warrior: "\uD83D\uDEE1\uFE0F",
  founder: "\uD83D\uDE80",
  charmer: "\u2728",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function StatScreen() {
  const profile = useProfileStore((s) => s.profile);
  const scores = useEngineStore((s) => s.scores);
  const archetype = useIdentityStore((s) => s.archetype);
  const identity = useModeStore((s) => s.identity);

  const dateKey = getTodayKey();
  const totalScore = useMemo(() => selectTotalScore(scores, dateKey), [scores, dateKey]);
  const rank = getDailyRank(totalScore);
  const meta = selectIdentityMeta(archetype);

  const firstActiveDate = getJSON<string | null>("first_active_date", null);
  const daysActive = getDayNumber(firstActiveDate);

  const displayName = identity
    ? IDENTITY_LABELS[identity] ?? "Unknown"
    : meta?.name ?? "Unranked";

  const archetypeIcon = archetype ? ARCHETYPE_ICONS[archetype] ?? "\u26A1" : "\u26A1";

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={styles.container}>
      {/* Kicker */}
      <Animated.Text
        entering={FadeInDown.delay(50).duration(350)}
        style={styles.kicker}
      >
        STATUS WINDOW
      </Animated.Text>

      {/* Character info */}
      <Animated.View
        entering={FadeInDown.delay(120).duration(350)}
        style={styles.charRow}
      >
        <Text style={styles.archetypeIcon}>{archetypeIcon}</Text>
        <View style={styles.charInfo}>
          <Text style={styles.charName}>{displayName}</Text>
          <View style={styles.charMeta}>
            <Text style={styles.levelBadge}>LEVEL {profile.level}</Text>
            <Text style={[styles.rankBadge, { color: rank.color }]}>
              RANK {rank.letter}
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Engine stat bars */}
      <View style={styles.statsBlock}>
        {ENGINES.map((engine, i) => {
          const { label, color } = ENGINE_META[engine];
          const score = scores[`${engine}:${dateKey}`] ?? 0;

          return (
            <Animated.View
              key={engine}
              entering={FadeInDown.delay(200 + i * 80).duration(350)}
              style={styles.statRow}
            >
              <View style={styles.statHeader}>
                <Text style={[styles.statLabel, { color }]}>{label}</Text>
                <Text style={[styles.statValue, { color }]}>{score}%</Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.min(100, score)}%`, backgroundColor: color },
                  ]}
                />
              </View>
            </Animated.View>
          );
        })}
      </View>

      {/* Footer stats */}
      <Animated.View
        entering={FadeInDown.delay(550).duration(350)}
        style={styles.footerRow}
      >
        <View style={styles.footerItem}>
          <Text style={styles.footerLabel}>STREAK</Text>
          <Text style={styles.footerValue}>{profile.streak}</Text>
        </View>
        <View style={styles.footerItem}>
          <Text style={styles.footerLabel}>XP</Text>
          <Text style={styles.footerValue}>{profile.xp}</Text>
        </View>
        <View style={styles.footerItem}>
          <Text style={styles.footerLabel}>DAYS ACTIVE</Text>
          <Text style={styles.footerValue}>{daysActive}</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(0,0,10,0.95)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: spacing["2xl"],
  },
  kicker: {
    ...fonts.kicker,
    marginBottom: spacing.lg,
  },

  // Character info
  charRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  archetypeIcon: {
    fontSize: 36,
    marginRight: spacing.md,
  },
  charInfo: {
    flex: 1,
  },
  charName: {
    ...fonts.heading,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  charMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  levelBadge: {
    ...fonts.caption,
    color: colors.textSecondary,
  },
  rankBadge: {
    ...fonts.caption,
  },

  // Stat bars
  statsBlock: {
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  statRow: {
    gap: spacing.xs,
  },
  statHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },

  // Footer
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  footerItem: {
    alignItems: "center",
    gap: spacing.xs,
  },
  footerLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 2,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  footerValue: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
});
