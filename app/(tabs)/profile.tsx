import React from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, fonts, shadows } from "../../src/theme";
import { HUDBackground } from "../../src/components/ui/AnimatedBackground";
import { XPBar } from "../../src/components/ui/XPBar";
import { StreakBadge } from "../../src/components/ui/StreakBadge";
import { Card } from "../../src/components/ui/Card";
import { useProfile } from "../../src/hooks/queries/useProfile";
import { useSkillTreeStore } from "../../src/stores/useSkillTreeStore";
import { useAchievementStore } from "../../src/stores/useAchievementStore";
import { useTitanModeStore, selectUnlockProgress, selectDaysRemaining } from "../../src/stores/useTitanModeStore";
import { useModeStore, checkFeatureVisible } from "../../src/stores/useModeStore";
import { TitanProgress } from "../../src/components/ui/TitanProgress";
import { NarrativeTimeline } from "../../src/components/v2/narrative/NarrativeTimeline";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { getRankForLevel, RANKS } from "../../src/db/gamification";

export default function ProfileScreen() {
  const profileMode = useModeStore((s) => s.mode);
  const showNarrative = checkFeatureVisible(profileMode, "narrative");
  const showSkillTrees = checkFeatureVisible(profileMode, "skill_trees");
  const router = useRouter();
  // Phase 3.5d: read profile from React Query (Supabase-backed). The
  // old useProfileStore.load() bootstrap is no longer needed —
  // React Query handles the fetch on mount and refetches on focus.
  const { data: profile } = useProfile();
  const xp = profile?.xp ?? 0;
  const level = profile?.level ?? 1;
  const streak = profile?.streak_current ?? 0;
  const bestStreak = profile?.streak_best ?? 0;

  const rank = getRankForLevel(level);
  const nextRank = RANKS.find((r) => r.minLevel > level);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <HUDBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Profile</Text>
          <View style={{ width: 34 }} />
        </View>

        <View style={styles.rankBadge}>
          <Text style={[styles.rankLetter, { color: rank.color }]}>
            {rank.name.toUpperCase()}
          </Text>
          <Text style={styles.levelText}>Level {level}</Text>
        </View>

        <View style={styles.xpWrap}>
          <XPBar xp={xp} level={level} />
        </View>

        <StreakBadge streak={streak} />

        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{xp.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total XP</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>Current Streak</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{bestStreak}</Text>
            <Text style={styles.statLabel}>Best Streak</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{level}</Text>
            <Text style={styles.statLabel}>Level</Text>
          </Card>
        </View>

        {nextRank && (
          <Card style={styles.nextRankCard}>
            <Text style={styles.nextRankTitle}>Next Rank</Text>
            <Text style={[styles.nextRankName, { color: nextRank.color }]}>
              {nextRank.name.toUpperCase()}
            </Text>
            <Text style={styles.nextRankLevel}>
              Reach Level {nextRank.minLevel} ({nextRank.minLevel - level} levels to go)
            </Text>
          </Card>
        )}

        {/* Titan Mode Card */}
        <TitanModeCard />

        {/* Achievements */}
        <AchievementLink />

        {/* Narrative Preview */}
        {showNarrative && (
          <View style={{ marginTop: spacing.xl }}>
            <SectionHeader title="YOUR STORY" />
            <NarrativeTimeline limit={3} />
            <Pressable
              onPress={() => router.push("/narrative")}
              style={{ alignItems: "center", paddingVertical: spacing.md }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary }}>
                View Full Story
              </Text>
            </Pressable>
          </View>
        )}

        {/* Skill Trees Section */}
        {showSkillTrees && (
          <SkillTreesOverview />
        )}

        <Pressable
          onPress={() => router.push("/hub/settings")}
          style={styles.settingsBtn}
        >
          <Ionicons name="settings-outline" size={20} color={colors.text} />
          <Text style={styles.settingsBtnText}>Settings</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function AchievementLink() {
  const router = useRouter();
  const count = useAchievementStore((s) => s.unlockedIds.length);
  return (
    <Pressable onPress={() => router.push("/achievements")} style={styles.settingsBtn}>
      <Ionicons name="ribbon-outline" size={20} color={colors.mind} />
      <Text style={styles.settingsBtnText}>Achievements ({count}/35)</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

function TitanModeCard() {
  const unlocked = useTitanModeStore((s) => s.unlocked);
  const days = useTitanModeStore((s) => s.consecutiveDays);
  const avg = useTitanModeStore((s) => s.averageScore);
  const mode = useModeStore((s) => s.mode);

  if (mode === "titan") {
    return (
      <View style={titanStyles.card}>
        <Ionicons name="flash" size={24} color="#FFD700" />
        <Text style={titanStyles.activeLabel}>TITAN MODE ACTIVE</Text>
        <Text style={titanStyles.activeDesc}>Equal weighting. No excuses. 85%+ standard.</Text>
      </View>
    );
  }

  if (unlocked) {
    return (
      <View style={titanStyles.card}>
        <Ionicons name="flash" size={24} color="#FFD700" />
        <Text style={titanStyles.unlockedLabel}>TITAN MODE UNLOCKED</Text>
        <Text style={titanStyles.unlockedDesc}>Activate in Settings to enter the ultimate challenge.</Text>
      </View>
    );
  }

  if (days === 0) return null;

  return (
    <View style={titanStyles.card}>
      <View style={titanStyles.row}>
        <Ionicons name="lock-closed-outline" size={18} color="#FFD700" />
        <Text style={titanStyles.lockLabel}>TITAN MODE</Text>
      </View>
      <Text style={titanStyles.lockDesc}>Day {days}/30 at {avg.toFixed(0)}% avg — {selectDaysRemaining(days)} days remaining</Text>
      <View style={titanStyles.track}>
        <View style={[titanStyles.fill, { width: `${selectUnlockProgress(days)}%` }]} />
      </View>
    </View>
  );
}

const titanStyles = StyleSheet.create({
  card: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.20)",
    backgroundColor: "rgba(255, 215, 0, 0.03)",
    alignItems: "center",
    gap: spacing.sm,
  },
  activeLabel: { fontSize: 12, fontWeight: "700", color: "#FFD700", letterSpacing: 3 },
  activeDesc: { fontSize: 12, color: colors.textMuted, textAlign: "center" },
  unlockedLabel: { fontSize: 12, fontWeight: "700", color: "#FFD700", letterSpacing: 2 },
  unlockedDesc: { fontSize: 12, color: colors.textMuted, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  lockLabel: { fontSize: 11, fontWeight: "700", color: "#FFD700", letterSpacing: 2 },
  lockDesc: { fontSize: 11, color: colors.textMuted, textAlign: "center" },
  track: { width: "100%", height: 3, backgroundColor: "rgba(255, 215, 0, 0.10)", borderRadius: 2, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: "#FFD700", borderRadius: 2 },
});

const SKILL_ENGINES = [
  { id: "body", label: "Body", color: colors.body },
  { id: "mind", label: "Mind", color: colors.mind },
  { id: "money", label: "Money", color: colors.money },
  { id: "charisma", label: "Charisma", color: colors.charisma },
];

function SkillTreesOverview() {
  const router = useRouter();
  const progress = useSkillTreeStore((s) => s.progress);
  const overview = React.useMemo(() => useSkillTreeStore.getState().getOverview(), [progress]);

  return (
    <View style={skillStyles.container}>
      <Text style={skillStyles.title}>SKILL TREES</Text>
      <View style={skillStyles.grid}>
        {SKILL_ENGINES.map((eng) => {
          const data = overview.find((o) => o.engine === eng.id);
          const total = data?.totalNodes ?? 0;
          const completed = data?.totalCompleted ?? 0;
          const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

          return (
            <Pressable
              key={eng.id}
              style={skillStyles.card}
              onPress={() => router.push(`/skill-tree/${eng.id}`)}
            >
              <View style={[skillStyles.dot, { backgroundColor: eng.color }]} />
              <Text style={skillStyles.engineName}>{eng.label}</Text>
              <TitanProgress value={pct} color={eng.color} height={3} />
              <Text style={skillStyles.nodeCount}>{completed}/{total}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const skillStyles = StyleSheet.create({
  container: { marginTop: spacing.xl },
  title: { ...fonts.kicker, fontSize: 10, letterSpacing: 2, marginBottom: spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  card: {
    flex: 1,
    minWidth: "45%",
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    gap: spacing.sm,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  engineName: { fontSize: 14, fontWeight: "600", color: colors.text },
  nodeCount: { fontSize: 11, fontWeight: "500", color: colors.textMuted },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.lg },
  backButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.surfaceBorder },
  title: { fontSize: 28, fontWeight: "800", color: colors.text },
  rankBadge: { alignItems: "center", marginTop: spacing["2xl"] },
  rankLetter: { ...fonts.monoValue, fontSize: 32, fontWeight: "900", letterSpacing: 2, textShadowColor: "rgba(56, 189, 248, 0.6)", textShadowRadius: 12 },
  levelText: { ...fonts.kicker, marginTop: spacing.xs },
  xpWrap: { marginTop: spacing.xl, marginBottom: spacing.lg },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.xl },
  statCard: { flex: 1, minWidth: "45%", alignItems: "center", ...shadows.card },
  statValue: { ...fonts.monoValue },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs },
  nextRankCard: { marginTop: spacing.xl, alignItems: "center" },
  nextRankTitle: { fontSize: 12, fontWeight: "600", color: colors.textSecondary, letterSpacing: 1 },
  nextRankName: { fontSize: 24, fontWeight: "900", letterSpacing: 2, marginTop: spacing.xs },
  nextRankLevel: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs },
  settingsBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  settingsBtnText: { flex: 1, fontSize: 16, fontWeight: "500", color: colors.text },
});
