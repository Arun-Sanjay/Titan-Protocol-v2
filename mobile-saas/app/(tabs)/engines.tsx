import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  type LayoutChangeEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { Panel } from "../../src/components/ui/Panel";
import { PageHeader } from "../../src/components/ui/PageHeader";
import { TitanProgress } from "../../src/components/ui/TitanProgress";
import { SparklineChart } from "../../src/components/ui/SparklineChart";

import { useDailyPlanning, useDashboardWeek } from "../../src/hooks/queries/useDashboard";
import type { EngineKey } from "../../src/lib/scoring";

import { colors, fonts, radius, spacing } from "../../src/theme";

type EngineMeta = {
  key: EngineKey;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  color: string;
};

const ENGINE_META: readonly EngineMeta[] = [
  { key: "body", icon: "barbell-outline", title: "BODY", subtitle: "Strength · sleep · nutrition", color: colors.body },
  { key: "mind", icon: "library-outline", title: "MIND", subtitle: "Focus · learning · reflection", color: colors.mind },
  { key: "money", icon: "trending-up-outline", title: "MONEY", subtitle: "Earn · save · invest · build", color: colors.money },
  { key: "charisma", icon: "people-outline", title: "GENERAL", subtitle: "Connection · presence · voice", color: colors.charisma },
];

type TileProps = {
  meta: EngineMeta;
  score: number;
  done: number;
  total: number;
  spark: number[];
  onPress: () => void;
};

function EngineTile({ meta, score, done, total, spark, onPress }: TileProps) {
  const [chartW, setChartW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setChartW(Math.floor(e.nativeEvent.layout.width));

  return (
    <Panel tone="subtle" onPress={onPress} style={styles.engineCard}>
      <View style={styles.iconRow}>
        <View style={[styles.iconBox, { borderColor: meta.color }]}>
          <Ionicons name={meta.icon} size={20} color={meta.color} />
        </View>
        <Text style={[styles.engineScore, { color: meta.color }]}>{score}</Text>
      </View>
      <Text style={styles.engineTitle}>{meta.title}</Text>
      <Text style={styles.engineSubtitle}>{meta.subtitle}</Text>

      <View style={styles.chart} onLayout={onLayout}>
        {chartW > 0 && spark.length > 0 ? (
          <SparklineChart data={spark} width={chartW} height={36} color={meta.color} />
        ) : null}
      </View>

      <View style={styles.progressWrap}>
        <TitanProgress value={score} color={meta.color} />
      </View>
      <Text style={styles.engineMeta}>
        {done} / {total} today
      </Text>
    </Panel>
  );
}

export default function EnginesScreen() {
  const router = useRouter();
  const planning = useDailyPlanning();
  const week = useDashboardWeek();

  const handlePress = useCallback(
    (engine: EngineKey) => {
      Haptics.selectionAsync();
      router.push(`/engine/${engine}` as never);
    },
    [router],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <PageHeader
          kicker="Four Engines"
          title="Engines"
          subtitle="Tap any engine for its missions, history, and progress."
        />
        <View style={styles.grid}>
          {ENGINE_META.map((meta) => {
            const s = planning.titan.perEngine[meta.key];
            return (
              <EngineTile
                key={meta.key}
                meta={meta}
                score={s.percent}
                done={s.mainDone + s.secondaryDone}
                total={s.mainTotal + s.secondaryTotal}
                spark={week.sparklines[meta.key].map((e) => e.percent)}
                onPress={() => handlePress(meta.key)}
              />
            );
          })}
        </View>
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, gap: spacing.lg },
  grid: { gap: spacing.md },
  engineCard: { gap: spacing.sm, padding: spacing.lg },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  engineScore: {
    ...fonts.title,
    fontSize: 32,
    letterSpacing: -0.5,
  },
  engineTitle: {
    ...fonts.kicker,
    fontSize: 14,
    color: colors.text,
    letterSpacing: 2,
  },
  engineSubtitle: {
    ...fonts.body,
    color: colors.textSecondary,
    fontSize: 13,
  },
  chart: {
    height: 40,
    justifyContent: "center",
    marginTop: spacing.xs,
  },
  progressWrap: { marginTop: spacing.xs },
  engineMeta: {
    ...fonts.small,
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1,
  },
});
