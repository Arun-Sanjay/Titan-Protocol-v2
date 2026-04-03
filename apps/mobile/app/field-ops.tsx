import React, { useMemo } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../src/theme";
import { useFieldOpStore } from "../src/stores/useFieldOpStore";
import { useRankStore } from "../src/stores/useRankStore";
import { OpsBanner } from "../src/components/ui/OpsBanner";
import { OpsCard } from "../src/components/ui/OpsCard";
import { getFieldOpDef, isOnCooldown, type FieldOpDef } from "../src/lib/field-ops";
import fieldOpDefs from "../src/data/field-ops.json";
import { RANK_ORDER, type Rank } from "../src/lib/ranks-v2";

export default function FieldOpsScreen() {
  const router = useRouter();
  const fieldOpStore = useFieldOpStore();
  const rankStore = useRankStore();

  const activeFieldOp = fieldOpStore.activeFieldOp;
  const activeDef = activeFieldOp ? getFieldOpDef(activeFieldOp.fieldOpId) : null;

  const currentRankIndex = RANK_ORDER.indexOf(rankStore.rank);

  const availableFieldOps = useMemo(() => {
    const allDefs: FieldOpDef[] = fieldOpStore.getAvailable(rankStore.rank);

    return allDefs
      .filter((def: FieldOpDef) => {
        if (activeFieldOp && def.id === activeFieldOp.fieldOpId) return false;
        const minRankIndex = RANK_ORDER.indexOf(def.minRank as Rank);
        if (minRankIndex > currentRankIndex) return false;
        if (isOnCooldown()) return false;
        return true;
      })
      .sort((a: FieldOpDef, b: FieldOpDef) => {
        const rankDiff = RANK_ORDER.indexOf(a.minRank as Rank) - RANK_ORDER.indexOf(b.minRank as Rank);
        if (rankDiff !== 0) return rankDiff;
        return a.durationDays - b.durationDays;
      });
  }, [fieldOpStore, rankStore.rank, activeFieldOp, currentRankIndex]);

  const lockedFieldOps = useMemo(() => {
    return (fieldOpDefs as FieldOpDef[]).filter((def: FieldOpDef) => {
      if (activeFieldOp && def.id === activeFieldOp.fieldOpId) return false;
      const minRankIndex = RANK_ORDER.indexOf(def.minRank as Rank);
      return minRankIndex > currentRankIndex;
    });
  }, [activeFieldOp, currentRankIndex]);

  const handleAbandon = () => {
    Alert.alert(
      "Abandon Field Op",
      "Are you sure? All progress will be lost and cooldown will apply.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Abandon",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            fieldOpStore.abandon();
          },
        },
      ],
    );
  };

  const handleStartFieldOp = (fieldOpId: string) => {
    const def = getFieldOpDef(fieldOpId);
    if (!def) return;

    Alert.alert(
      "Begin Field Op",
      `Begin "${def.name}" (${def.durationDays} days)? You can only run one field op at a time.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Begin",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            fieldOpStore.start(fieldOpId);
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            hitSlop={12}
          >
            <Text style={styles.backButton}>{"\u2190"} BACK</Text>
          </Pressable>
          <Text style={styles.pageTitle}>FIELD OPS</Text>
          <View style={styles.headerSpacer} />
        </Animated.View>

        {/* Active field op */}
        {activeFieldOp && activeDef && (
          <Animated.View
            entering={FadeInDown.duration(400).delay(100)}
            style={styles.section}
          >
            <Text style={styles.sectionTitle}>ACTIVE MISSION</Text>
            <OpsBanner
              opName={activeDef.name}
              currentDay={activeFieldOp.currentDay}
              totalDays={activeDef.durationDays}
              dailyResults={activeFieldOp.dailyResults}
              onPress={() => router.push(`/field-op/${activeFieldOp.fieldOpId}`)}
            />
            <Pressable onPress={handleAbandon} style={styles.abandonButton}>
              <Text style={styles.abandonText}>ABANDON</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Available field ops */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(200)}
          style={styles.section}
        >
          <Text style={styles.sectionTitle}>AVAILABLE FIELD OPS</Text>

          {availableFieldOps.length === 0 && lockedFieldOps.length === 0 && (
            <Text style={styles.emptyText}>
              No field ops available for your current rank.
            </Text>
          )}

          {availableFieldOps.map((def, index) => (
            <Animated.View
              key={def.id}
              entering={FadeInDown.duration(350).delay(300 + index * 80)}
              style={styles.cardWrapper}
            >
              <OpsCard
                fieldOp={def}
                isLocked={false}
                isOnCooldown={false}
                onStart={() => handleStartFieldOp(def.id)}
              />
            </Animated.View>
          ))}

          {/* Locked field ops shown below */}
          {lockedFieldOps.map((def, index) => (
            <Animated.View
              key={def.id}
              entering={FadeInDown.duration(350).delay(
                300 + (availableFieldOps.length + index) * 80,
              )}
              style={styles.cardWrapper}
            >
              <OpsCard
                fieldOp={def}
                isLocked={true}
                isOnCooldown={false}
                onStart={() => {}}
              />
            </Animated.View>
          ))}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing["2xl"],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  backButton: {
    fontFamily: fonts.mono.fontFamily,
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 0.8,
  },
  pageTitle: {
    fontSize: fonts.title.fontSize,
    fontWeight: fonts.title.fontWeight,
    color: colors.text,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  headerSpacer: {
    width: 60,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.mono.fontFamily,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  abandonButton: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.4)",
    borderRadius: radius.sm,
    marginTop: spacing.xs,
  },
  abandonText: {
    fontFamily: fonts.mono.fontFamily,
    fontSize: 11,
    color: "#ef4444",
    letterSpacing: 1.2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.surfaceBorder,
    marginVertical: spacing.lg,
  },
  cardWrapper: {
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: fonts.body.fontSize,
    fontWeight: fonts.body.fontWeight,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: spacing.xl,
  },
});
