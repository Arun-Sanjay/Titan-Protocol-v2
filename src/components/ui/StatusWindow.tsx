import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";

import { colors, spacing, radius } from "../../theme";
import { StatBar } from "./StatBar";
import { RankBadge } from "./RankBadge";

import { useUserTitles } from "../../hooks/queries/useTitles";
import { useProfile } from "../../hooks/queries/useProfile";
import { useFieldOpHistory } from "../../hooks/queries/useFieldOps";
import { useStoryStore } from "../../stores/useStoryStore";
import { useIdentityStore } from "../../stores/useIdentityStore";
import { IDENTITY_LABELS } from "../../stores/useModeStore";
import { getTitleDef, RARITY_COLORS } from "../../lib/titles";
import { RANK_NAMES, rankFromLevel } from "../../lib/ranks-v2";

import type { EngineKey } from "../../db/schema";
import type { IdentityArchetype } from "../../stores/useModeStore";

// ─── Types ───────────────────────────────────────────────────────────────────

type StatusWindowProps = {
  onClose: () => void;
  highlightChanges?: Record<string, number>; // engine -> gain amount
};

// ─── Constants ───────────────────────────────────────────────────────────────

const monoFont = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

const ENGINE_CONFIG: Array<{
  key: EngineKey;
  label: string;
  color: string;
}> = [
  { key: "body", label: "BODY", color: colors.body },
  { key: "mind", label: "MIND", color: colors.mind },
  { key: "money", label: "MONEY", color: colors.money },
  { key: "charisma", label: "CHARISMA", color: colors.charisma },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function StatusWindow({
  onClose,
  highlightChanges,
}: StatusWindowProps) {
  // Engine aggregate stats derived in-memory from today's completions
  // are not implemented in the cloud yet; zero them for now so the
  // UI renders without a legacy MMKV store. Values update live as the
  // user completes tasks via the engine/[id] screen.
  const stats = { body: 0, mind: 0, money: 0, charisma: 0 };
  const totalOutput = 0;
  const todayGains = { body: 0, mind: 0, money: 0, charisma: 0 };
  const { data: cloudTitles = [] } = useUserTitles();
  const equippedRow = cloudTitles.find((t) => t.equipped);
  const equippedId = equippedRow?.title_id ?? null;
  const unlockedIds = cloudTitles.map((t) => t.title_id);
  const { data: profile } = useProfile();
  const profileLevel = profile?.level ?? 1;
  const streakCurrent = profile?.streak_current ?? 0;
  const rank = rankFromLevel(profileLevel);
  const { data: fieldOpHistory = [] } = useFieldOpHistory();
  const { userName } = useStoryStore();
  const { archetype } = useIdentityStore();

  // Resolve equipped title
  const equippedTitle = equippedId ? getTitleDef(equippedId) : null;
  const titleColor = equippedTitle
    ? RARITY_COLORS[equippedTitle.rarity] ?? colors.textMuted
    : colors.textMuted;

  // Archetype display
  const archetypeLabel =
    IDENTITY_LABELS[(archetype ?? "titan") as IdentityArchetype] ?? "The Titan";
  const archetypeColor = getArchetypeColor(archetype);

  // Total output delta
  const toGain = highlightChanges
    ? Object.values(highlightChanges).reduce((sum, v) => sum + v, 0)
    : 0;
  const prevTotalOutput = totalOutput - toGain;

  const clearedCount = fieldOpHistory.filter((op) => op.status === "completed").length;

  return (
    <Animated.View entering={FadeIn.duration(250)} style={styles.overlay}>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Text style={styles.header}>STATUS WINDOW</Text>

          {/* Identity section */}
          <View style={styles.section}>
            <KeyValue label="Name" value={userName || "Player"} />
            <KeyValue
              label="Class"
              value={archetypeLabel}
              valueColor={archetypeColor}
            />
            <KeyValue
              label="Title"
              value={equippedTitle?.name ?? "\u2014"}
              valueColor={titleColor}
            />
            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Rank</Text>
              <View style={styles.rankRow}>
                <RankBadge rank={rank} size="sm" />
                <Text style={styles.kvValue}>
                  {"  "}{RANK_NAMES[rank] ?? rank}
                </Text>
              </View>
            </View>
            <KeyValue label="Level" value={String(profileLevel)} />
          </View>

          {/* Stats section */}
          <SectionDivider label="STATS" />
          <View style={styles.section}>
            {ENGINE_CONFIG.map((eng) => (
              <StatBar
                key={eng.key}
                engine={eng.key}
                label={eng.label}
                value={stats[eng.key] ?? 0}
                gain={
                  highlightChanges?.[eng.key] ??
                  (todayGains[eng.key] > 0 ? todayGains[eng.key] : undefined)
                }
                color={eng.color}
              />
            ))}
          </View>

          {/* Total Output section */}
          <SectionDivider label="TOTAL OUTPUT" />
          <View style={styles.section}>
            {highlightChanges && toGain > 0 ? (
              <View style={styles.cpRow}>
                <Text style={styles.cpPrev}>{Math.floor(prevTotalOutput)}</Text>
                <Text style={styles.cpArrow}>{" \u2192 "}</Text>
                <Text style={styles.cpValue}>{Math.floor(totalOutput)}</Text>
                <Text style={styles.cpGain}>
                  {" (+"}
                  {toGain % 1 === 0 ? toGain : toGain.toFixed(1)}
                  {")"}
                </Text>
              </View>
            ) : (
              <Text style={styles.cpValue}>{Math.floor(totalOutput)}</Text>
            )}
          </View>

          {/* Record section */}
          <SectionDivider label="RECORD" />
          <View style={styles.section}>
            <KeyValue
              label="Streak"
              value={`${streakCurrent} day${streakCurrent === 1 ? "" : "s"}`}
            />
            <KeyValue label="Field Ops" value={`${clearedCount} cleared`} />
            <KeyValue label="Titles" value={`${unlockedIds.length} earned`} />
          </View>

          {/* Close button */}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}
          >
            <Text style={styles.closeButtonText}>CLOSE</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Animated.View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KeyValue({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={[styles.kvValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <View style={styles.dividerRow}>
      <Text style={styles.dividerDash}>{"\u2500\u2500"} </Text>
      <Text style={styles.dividerLabel}>{label}</Text>
      <Text style={styles.dividerDash}>
        {" "}
        {"\u2500".repeat(16)}
      </Text>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getArchetypeColor(archetype: string | null | undefined): string {
  switch (archetype) {
    case "athlete":
    case "warrior":
      return colors.body;
    case "scholar":
      return colors.mind;
    case "hustler":
    case "founder":
      return colors.money;
    case "showman":
    case "charmer":
      return colors.charisma;
    case "titan":
    default:
      return colors.text;
  }
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    zIndex: 5000,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing["4xl"],
  },
  header: {
    fontFamily: monoFont,
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: spacing["2xl"],
  },
  section: {
    marginBottom: spacing.lg,
  },

  // Key-value rows
  kvRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.xs + 2,
  },
  kvLabel: {
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  kvValue: {
    fontFamily: monoFont,
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  // Section dividers
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  dividerDash: {
    fontFamily: monoFont,
    fontSize: 10,
    color: colors.textMuted,
  },
  dividerLabel: {
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 2,
    textTransform: "uppercase",
  },

  // Total output
  cpRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  cpPrev: {
    fontFamily: monoFont,
    fontSize: 24,
    fontWeight: "300",
    color: colors.textMuted,
  },
  cpArrow: {
    fontFamily: monoFont,
    fontSize: 16,
    color: colors.textMuted,
  },
  cpValue: {
    fontFamily: monoFont,
    fontSize: 32,
    fontWeight: "800",
    color: colors.text,
  },
  cpGain: {
    fontFamily: monoFont,
    fontSize: 14,
    fontWeight: "700",
    color: colors.success,
    marginLeft: spacing.xs,
  },

  // Close button
  closeButton: {
    marginTop: spacing["3xl"],
    alignSelf: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing["3xl"],
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radius.sm,
  },
  closeButtonPressed: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  closeButtonText: {
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
});
