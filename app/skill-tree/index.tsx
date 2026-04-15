import React, { useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { colors, spacing, fonts, radius } from "../../src/theme";
import { HUDBackground } from "../../src/components/ui/AnimatedBackground";
import { TitanProgress } from "../../src/components/ui/TitanProgress";
// Phase 4.1: cloud-backed skill tree progress via React Query
import { useSkillProgress } from "../../src/hooks/queries/useSkillTree";
import type { EngineKey } from "../../src/db/schema";

const ENGINES: EngineKey[] = ["body", "mind", "money", "charisma"];

const ENGINE_LABELS: Record<EngineKey, string> = {
  body: "BODY", mind: "MIND", money: "MONEY", charisma: "CHARISMA",
};
const ENGINE_COLORS: Record<EngineKey, string> = {
  body: colors.body, mind: colors.mind, money: colors.money, charisma: colors.charisma,
};
const ENGINE_DIM: Record<EngineKey, string> = {
  body: colors.bodyDim, mind: colors.mindDim, money: colors.moneyDim, charisma: colors.charismaDim,
};
const ENGINE_ICONS: Record<EngineKey, string> = {
  body: "fitness", mind: "bulb", money: "cash", charisma: "people",
};
const ENGINE_DESCRIPTIONS: Record<EngineKey, string> = {
  body: "Physical performance & endurance",
  mind: "Focus, learning & mental acuity",
  money: "Financial systems & growth",
  charisma: "Social influence & presence",
};

export default function SkillTreeSelector() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = (screenWidth - spacing.lg * 2 - spacing.md) / 2;

  // Phase 4.1: cloud-backed skill progress via React Query (auto-fetches, no init needed)
  const { data: cloudProgress = [] } = useSkillProgress();

  // Calculate per-engine stats from cloud data
  const engineStats = useMemo(() => {
    return ENGINES.map((engine) => {
      const nodes = cloudProgress.filter((n) => n.engine === engine);
      const total = nodes.length;
      const claimed = nodes.filter((n) => n.state === "claimed").length;
      const ready = nodes.filter((n) => n.state === "ready").length;
      const percent = total > 0 ? Math.round((claimed / total) * 100) : 0;
      return { engine, total, claimed, ready, percent };
    });
  }, [cloudProgress]);

  // Overall stats
  const overallTotal = engineStats.reduce((s, e) => s + e.total, 0);
  const overallClaimed = engineStats.reduce((s, e) => s + e.claimed, 0);
  const overallReady = engineStats.reduce((s, e) => s + e.ready, 0);
  const overallPercent = overallTotal > 0 ? Math.round((overallClaimed / overallTotal) * 100) : 0;

  const handleSelect = (engine: EngineKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/skill-tree/${engine}`);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <HUDBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>SKILL TREES</Text>
          <View style={{ width: 34 }} />
        </View>

        {/* Overall progress card */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.overviewCard}>
          <Text style={styles.overviewKicker}>OVERALL MASTERY</Text>
          <View style={styles.overviewRow}>
            <Text style={styles.overviewPercent}>{overallPercent}%</Text>
            <View style={styles.overviewStats}>
              <Text style={styles.overviewStat}>{overallClaimed}/{overallTotal} nodes claimed</Text>
              {overallReady > 0 && (
                <Text style={[styles.overviewStat, { color: colors.success }]}>
                  {overallReady} ready to claim
                </Text>
              )}
            </View>
          </View>
          <TitanProgress value={overallPercent} color={colors.text} height={4} shimmer={false} />
        </Animated.View>

        {/* Engine cards grid */}
        <View style={styles.grid}>
          {engineStats.map((stat, index) => {
            const engineColor = ENGINE_COLORS[stat.engine];
            const engineDim = ENGINE_DIM[stat.engine];
            const icon = ENGINE_ICONS[stat.engine];

            return (
              <Animated.View
                key={stat.engine}
                entering={FadeInDown.delay(200 + index * 100).duration(400)}
                style={{ width: cardWidth }}
              >
                <Pressable
                  style={[styles.engineCard, { borderColor: `${engineColor}30` }]}
                  onPress={() => handleSelect(stat.engine)}
                >
                  {/* Color accent bar */}
                  <View style={[styles.cardAccent, { backgroundColor: engineColor }]} />

                  {/* Icon + label */}
                  <View style={styles.cardHeader}>
                    <View style={[styles.iconWrap, { backgroundColor: engineDim }]}>
                      <Ionicons name={icon as any} size={20} color={engineColor} />
                    </View>
                    <Text style={[styles.cardLabel, { color: engineColor }]}>
                      {ENGINE_LABELS[stat.engine]}
                    </Text>
                  </View>

                  {/* Description */}
                  <Text style={styles.cardDesc} numberOfLines={2}>
                    {ENGINE_DESCRIPTIONS[stat.engine]}
                  </Text>

                  {/* Progress */}
                  <View style={styles.progressSection}>
                    <TitanProgress value={stat.percent} color={engineColor} height={4} shimmer={false} />
                    <View style={styles.progressRow}>
                      <Text style={styles.progressText}>
                        {stat.claimed}/{stat.total} nodes
                      </Text>
                      <Text style={[styles.progressPercent, { color: engineColor }]}>
                        {stat.percent}%
                      </Text>
                    </View>
                  </View>

                  {/* Ready badge */}
                  {stat.ready > 0 && (
                    <View style={[styles.readyBadge, { backgroundColor: engineDim }]}>
                      <View style={[styles.readyDot, { backgroundColor: engineColor }]} />
                      <Text style={[styles.readyText, { color: engineColor }]}>
                        {stat.ready} READY
                      </Text>
                    </View>
                  )}

                  {/* Arrow */}
                  <Text style={styles.arrow}>→</Text>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xl,
  },
  backButton: {
    width: 34, height: 34,
    alignItems: "center", justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  title: {
    ...fonts.heading,
    fontSize: 20,
    letterSpacing: 4,
    color: colors.text,
  },

  // Overview card
  overviewCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  overviewKicker: {
    ...fonts.kicker,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 3,
    marginBottom: spacing.md,
  },
  overviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  overviewPercent: {
    fontSize: 36,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: 1,
  },
  overviewStats: {
    flex: 1,
    gap: 2,
  },
  overviewStat: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  // Grid
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },

  // Engine card
  engineCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    padding: spacing.md,
    paddingTop: spacing.md + 4,
    minHeight: 180,
  },
  cardAccent: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  iconWrap: {
    width: 32, height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cardLabel: {
    ...fonts.kicker,
    fontSize: 11,
    letterSpacing: 2,
  },
  cardDesc: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
    marginBottom: spacing.md,
  },

  // Progress
  progressSection: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressText: {
    ...fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
  },
  progressPercent: {
    ...fonts.mono,
    fontSize: 11,
    fontWeight: "700",
  },

  // Ready badge
  readyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  readyDot: {
    width: 6, height: 6, borderRadius: 3,
  },
  readyText: {
    ...fonts.kicker,
    fontSize: 8,
    letterSpacing: 1,
  },

  // Arrow
  arrow: {
    position: "absolute",
    bottom: spacing.md,
    right: spacing.md,
    fontSize: 16,
    color: colors.textMuted,
  },
});
