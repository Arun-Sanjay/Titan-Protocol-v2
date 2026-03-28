import React, { useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, fonts, shadows } from "../../src/theme";
import { HUDBackground } from "../../src/components/ui/AnimatedBackground";
import { XPBar } from "../../src/components/ui/XPBar";
import { StreakBadge } from "../../src/components/ui/StreakBadge";
import { Card } from "../../src/components/ui/Card";
import { useProfileStore } from "../../src/stores/useProfileStore";
import { getRankForLevel, RANKS } from "../../src/db/gamification";

export default function ProfileScreen() {
  const router = useRouter();
  const xp = useProfileStore((s) => s.profile.xp);
  const level = useProfileStore((s) => s.profile.level);
  const streak = useProfileStore((s) => s.profile.streak);
  const bestStreak = useProfileStore((s) => s.profile.best_streak);
  const load = useProfileStore((s) => s.load);

  useEffect(() => { load(); }, []);

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
        <Text style={styles.title}>Profile</Text>

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

        <Pressable
          onPress={() => router.push("/hub/settings" as any)}
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg },
  title: { fontSize: 28, fontWeight: "800", color: colors.text, marginTop: spacing.lg },
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
