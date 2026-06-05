import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { Panel } from "../../src/components/ui/Panel";
import { RadarChart } from "../../src/components/ui/RadarChart";
import { WeekStrip } from "../../src/components/ui/WeekStrip";

import { useDashboardWeek, useDailyPlanning } from "../../src/hooks/queries/useDashboard";
import { useProfile } from "../../src/hooks/queries/useProfile";
import { getRankForLevel } from "../../src/db/gamification";
import { ENGINES } from "../../src/lib/scoring";
import { ENGINE_META } from "../../src/lib/dashboard-stats";
import { getGreeting } from "../../src/lib/date";
import { colors, fonts, spacing, radius, shadows } from "../../src/theme";

const RADAR_SIZE = Math.min(300, Dimensions.get("window").width - 96);

function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function HQScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const planning = useDailyPlanning();
  const week = useDashboardWeek();
  const { data: profile } = useProfile();
  const titan = planning.titan;

  const radarData = useMemo(
    () =>
      ENGINES.map((engine) => ({
        subject: ENGINE_META[engine].label,
        score: titan.perEngine[engine].percent,
      })),
    [titan],
  );

  const weekScoreMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of week.titanSparkline) map[d.dateKey] = d.percent;
    return map;
  }, [week.titanSparkline]);

  const streak = profile?.streak_current ?? 0;
  const level = profile?.level ?? 1;
  const rank = getRankForLevel(level);
  const displayName = profile?.display_name?.trim() || profile?.email?.split("@")[0] || "Operator";
  const initials = initialsFor(displayName);

  const onRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["dailyPlanning"] });
    void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    void queryClient.invalidateQueries({ queryKey: ["completions"] });
    void queryClient.invalidateQueries({ queryKey: ["profile"] });
  }, [queryClient]);

  const goProfile = useCallback(() => router.navigate("/(tabs)/profile"), [router]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.textMuted} />
        }
      >
        {/* ── Header: greeting + streak + avatar ── */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{getGreeting().toUpperCase()}</Text>
            <Text style={styles.title}>HQ</Text>
          </View>

          <View style={styles.headerRight}>
            {streak > 0 && (
              <View style={styles.streakChip}>
                <Text style={styles.streakFire}>🔥</Text>
                <Text style={styles.streakCount}>{streak}</Text>
              </View>
            )}
            <Pressable
              onPress={goProfile}
              style={({ pressed }) => [
                styles.avatar,
                { borderColor: rank.color, backgroundColor: rank.color + "22" },
                pressed && styles.pressed,
              ]}
              accessibilityLabel="Open profile"
            >
              <Text style={[styles.avatarText, { color: rank.color }]}>{initials}</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Radar centerpiece + 7-day strip ── */}
        <Panel tone="hero" style={styles.heroPanel}>
          <Text style={styles.panelKicker}>Engine Overview</Text>
          <View style={styles.radarWrap}>
            <RadarChart data={radarData} size={RADAR_SIZE} />
          </View>

          <View style={styles.weekBlock}>
            <Text style={styles.weekKicker}>This Week</Text>
            <WeekStrip scoreMap={weekScoreMap} />
          </View>
        </Panel>

        <View style={{ height: spacing["2xl"] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, gap: spacing.lg },
  pressed: { opacity: 0.7 },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  headerLeft: { gap: spacing.xs },
  greeting: { ...fonts.kicker, color: colors.textMuted, letterSpacing: 2 },
  title: { ...fonts.title, fontSize: 32, letterSpacing: -0.5 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  streakChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.warningDim,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.45)",
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    ...shadows.glow,
    shadowColor: colors.warning,
    shadowOpacity: 0.4,
  },
  streakFire: { fontSize: 15 },
  streakCount: { ...fonts.mono, fontSize: 15, fontWeight: "800", color: colors.warning },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { ...fonts.mono, fontSize: 14, fontWeight: "700" },

  // Hero
  heroPanel: { gap: spacing.lg },
  panelKicker: { ...fonts.kicker, color: colors.textMuted, letterSpacing: 2 },
  radarWrap: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.sm },
  weekBlock: { gap: spacing.sm },
  weekKicker: { ...fonts.kicker, color: colors.textMuted, fontSize: 10, letterSpacing: 1.5 },
});
