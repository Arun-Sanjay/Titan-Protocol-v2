import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { colors, spacing, fonts, radius } from "../../src/theme";
import { OpsBanner } from "../../src/components/ui/OpsBanner";
import {
  useActiveFieldOp,
  useResolveFieldOp,
  useRecordFieldOpDay,
} from "../../src/hooks/queries/useFieldOps";
import { useAwardXP } from "../../src/hooks/queries/useProfile";
import { useEnqueueRankUp } from "../../src/hooks/queries/useRankUps";
import { getFieldOpDef } from "../../src/lib/field-ops";
import { getTodayKey, toLocalDateKey } from "../../src/lib/date";
import { logError } from "../../src/lib/error-log";

/**
 * Field op detail screen.
 *
 * Reached from the active-mission banner on `/field-ops`. Lets the user:
 *   - See the field op's objective + day-by-day progress.
 *   - Log today's outcome (pass / fail). The service applies sprint /
 *     endurance resolution rules and resolves the op when appropriate.
 *   - Abandon the active op (same consequences as failure).
 *
 * Created to fix the dead-link bug: previously this route was referenced
 * by the field-ops list page but had no implementation, so tapping the
 * active mission landed on +not-found.
 *
 * The route param `id` is the static `field_op_id` (e.g. `"sprint_alpha"`),
 * which matches what the list page passes; the row id from the cloud
 * `field_ops` table is looked up via `useActiveFieldOp` at render time.
 */
export default function FieldOpDetailScreen() {
  const router = useRouter();
  const { id: fieldOpDefId } = useLocalSearchParams<{ id: string }>();

  const { data: active, isLoading } = useActiveFieldOp();
  const resolveFieldOpMutation = useResolveFieldOp();
  const recordDayMutation = useRecordFieldOpDay();
  const awardXPMutation = useAwardXP();
  const enqueueRankUpMutation = useEnqueueRankUp();

  const def = useMemo(() => {
    const id = active?.field_op_id ?? fieldOpDefId;
    if (!id) return null;
    return getFieldOpDef(id) ?? null;
  }, [active, fieldOpDefId]);

  const dayResults = useMemo(() => {
    if (!active) return [] as boolean[];
    return Array.isArray(active.day_results)
      ? (active.day_results as boolean[])
      : [];
  }, [active]);

  const loggedToday = useMemo(() => {
    if (!active) return false;
    if (dayResults.length === 0) return false;
    const today = getTodayKey();
    const stamp = active.completed_at ?? active.started_at;
    if (typeof stamp !== "string") return false;
    return toLocalDateKey(new Date(stamp)) === today;
  }, [active, dayResults.length]);

  const handleLog = useCallback(
    async (passed: boolean) => {
      if (!active) return;
      try {
        const res = await recordDayMutation.mutateAsync({
          id: active.id,
          passed,
        });
        if (res.alreadyLoggedToday) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          Alert.alert(
            "Already logged today",
            "You can log the next day after midnight.",
          );
          return;
        }
        if (res.resolved === "completed") {
          // Award XP once, on the resolving day. atomic awardXP service
          // handles level recompute inside one transaction.
          const reward = def?.xpReward ?? 0;
          if (reward > 0) {
            const xp = await awardXPMutation.mutateAsync(reward);
            if (xp.leveledUp) {
              await enqueueRankUpMutation.mutateAsync({
                fromLevel: xp.fromLevel,
                toLevel: xp.toLevel,
              });
            }
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(
            "Field op cleared",
            `${def?.name ?? "Operation"} complete. +${def?.xpReward ?? 0} XP awarded.`,
            [{ text: "OK", onPress: () => router.back() }],
          );
        } else if (res.resolved === "failed") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert(
            "Field op failed",
            "Cooldown applied. Try another op when ready.",
            [{ text: "OK", onPress: () => router.back() }],
          );
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } catch (e) {
        logError("FieldOpDetail.recordDay", e);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [
      active,
      def,
      recordDayMutation,
      awardXPMutation,
      enqueueRankUpMutation,
      router,
    ],
  );

  const handleAbandon = useCallback(() => {
    if (!active) return;
    Alert.alert(
      "Abandon Field Op",
      "All progress is lost and a cooldown will apply. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Abandon",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            resolveFieldOpMutation.mutate(
              { id: active.id, status: "abandoned" },
              { onSuccess: () => router.back() },
            );
          },
        },
      ],
    );
  }, [active, resolveFieldOpMutation, router]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!active || !def) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>{"←"} BACK</Text>
          </Pressable>
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No active field op.</Text>
          <Text style={styles.emptyHint}>
            Pick one from the Field Ops list to begin.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          hitSlop={12}
        >
          <Text style={styles.back}>{"←"} BACK</Text>
        </Pressable>
        <Text style={styles.title}>{def.name.toUpperCase()}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(300)}>
          <OpsBanner
            opName={def.name}
            currentDay={dayResults.length}
            totalDays={def.durationDays}
            dailyResults={dayResults}
            onPress={() => {}}
          />
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(300).delay(80)}
          style={styles.descBlock}
        >
          <Text style={styles.kicker}>OBJECTIVE</Text>
          <Text style={styles.body}>{def.description}</Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(300).delay(160)}
          style={styles.actions}
        >
          {loggedToday ? (
            <View style={styles.loggedPill}>
              <Text style={styles.loggedText}>LOGGED FOR TODAY</Text>
              <Text style={styles.loggedSub}>
                Come back tomorrow to log day {dayResults.length + 1}.
              </Text>
            </View>
          ) : (
            <View style={styles.logRow}>
              <Pressable
                style={styles.passBtn}
                onPress={() => handleLog(true)}
              >
                <Text style={styles.passText}>LOG PASS</Text>
              </Pressable>
              <Pressable
                style={styles.failBtn}
                onPress={() => handleLog(false)}
              >
                <Text style={styles.failText}>LOG FAIL</Text>
              </Pressable>
            </View>
          )}

          <Pressable style={styles.abandonBtn} onPress={handleAbandon}>
            <Text style={styles.abandonText}>ABANDON</Text>
          </Pressable>
        </Animated.View>

        <View style={{ height: spacing["2xl"] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  back: {
    fontFamily: fonts.mono.fontFamily,
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: 1.5,
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.md, gap: spacing.lg },
  descBlock: {
    paddingTop: spacing.lg,
    gap: spacing.xs,
  },
  kicker: { ...fonts.kicker, fontSize: 9, color: colors.textMuted },
  body: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  actions: { gap: spacing.md, marginTop: spacing.md },
  logRow: { flexDirection: "row", gap: spacing.md },
  passBtn: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.success,
    alignItems: "center",
  },
  passText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.bg,
    letterSpacing: 2,
  },
  failBtn: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: "center",
  },
  failText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.danger,
    letterSpacing: 2,
  },
  loggedPill: {
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: "rgba(52, 211, 153, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.20)",
    alignItems: "center",
    gap: spacing.xs,
  },
  loggedText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.success,
    letterSpacing: 2,
  },
  loggedSub: { fontSize: 12, color: colors.textMuted },
  abandonBtn: {
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  abandonText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
    letterSpacing: 1.5,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  emptyText: { fontSize: 16, color: colors.text, fontWeight: "600" },
  emptyHint: { fontSize: 13, color: colors.textMuted, textAlign: "center" },
});
