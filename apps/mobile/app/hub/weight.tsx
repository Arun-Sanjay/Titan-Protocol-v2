import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  AppState,
  Alert,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, fonts } from "../../src/theme";
import { Panel } from "../../src/components/ui/Panel";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { SparklineChart } from "../../src/components/ui/SparklineChart";
import { getTodayKey, formatDateShort } from "../../src/lib/date";
import { useWeightStore, type WeightEntry } from "../../src/stores/useWeightStore";

export default function WeightScreen() {
  const router = useRouter();

  // Bug 12: use useWindowDimensions instead of static Dimensions.get
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const CHART_PADDING = spacing.lg * 2 + 40; // screen padding + panel padding

  // Bug 13: AppState listener for stale todayKey
  const [appActive, setAppActive] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setAppActive(c => c + 1);
    });
    return () => sub.remove();
  }, []);
  const todayKey = useMemo(() => getTodayKey(), [appActive]);

  const entries = useWeightStore((s) => s.entries);
  const goalWeight = useWeightStore((s) => s.goalWeight);
  const load = useWeightStore((s) => s.load);
  const addEntry = useWeightStore((s) => s.addEntry);
  const deleteEntry = useWeightStore((s) => s.deleteEntry);
  const setGoalWeight = useWeightStore((s) => s.setGoalWeight);
  const getLatest = useWeightStore((s) => s.getLatest);
  const getChangeFromFirst = useWeightStore((s) => s.getChangeFromFirst);
  const getGoalProgress = useWeightStore((s) => s.getGoalProgress);

  const [weightInput, setWeightInput] = useState("");
  const [goalInput, setGoalInput] = useState("");
  const [showGoalForm, setShowGoalForm] = useState(false);

  // Bug 14: include todayKey and load in deps
  useEffect(() => {
    load();
  }, [todayKey, load]);

  const latest = getLatest();
  const changeInfo = getChangeFromFirst();
  // Bug 11: use direction-aware goal progress
  const goalProgress = getGoalProgress();

  // Bug 11: determine change color based on goal direction
  const changeColor = useMemo(() => {
    if (!changeInfo) return colors.textSecondary;
    if (!goalProgress) {
      // No goal: weight loss = green, gain = red (default)
      return changeInfo.change > 0 ? colors.danger : colors.success;
    }
    // Goal-aware coloring
    if (goalProgress.direction === "lose") {
      return changeInfo.change <= 0 ? colors.success : colors.danger;
    }
    if (goalProgress.direction === "gain") {
      return changeInfo.change >= 0 ? colors.success : colors.danger;
    }
    // maintain
    return Math.abs(changeInfo.change) < 1 ? colors.success : colors.warning;
  }, [changeInfo, goalProgress]);

  // Sparkline data — last 30 entries normalized 0-100
  const sparkData = useMemo(() => {
    if (entries.length < 2) return [];
    const recent = entries.slice(-30);
    const weights = recent.map((e) => e.weightKg);
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const range = max - min || 1;
    return weights.map((w) => ((w - min) / range) * 80 + 10); // 10-90 range for padding
  }, [entries]);

  const handleSaveWeight = useCallback(() => {
    const val = parseFloat(weightInput);
    if (isNaN(val) || val <= 0 || val > 500) return;
    addEntry(todayKey, +val.toFixed(1));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setWeightInput("");
  }, [weightInput, todayKey, addEntry]);

  const handleSaveGoal = useCallback(() => {
    const val = parseFloat(goalInput);
    if (isNaN(val) || val <= 0 || val > 500) return;
    setGoalWeight(+val.toFixed(1));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setGoalInput("");
    setShowGoalForm(false);
  }, [goalInput, setGoalWeight]);

  const handleDeleteEntry = useCallback(
    (dateKey: string) => {
      Alert.alert("Delete Entry", "Remove this weight entry?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteEntry(dateKey);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ]);
    },
    [deleteEntry],
  );

  // Last 10 entries in reverse
  const recentEntries = useMemo(() => {
    return [...entries].reverse().slice(0, 10);
  }, [entries]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Weight Tracker</Text>
        <View style={{ width: 48 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Current Weight Hero ── */}
          <SectionHeader title="Current" />
          <Panel style={styles.heroCard}>
            <Text style={styles.heroValue}>
              {latest ? latest.weightKg.toFixed(1) : "--.-"}
            </Text>
            <Text style={styles.heroUnit}>kg</Text>
            {changeInfo && (
              <View style={styles.changeRow}>
                <Ionicons
                  name={changeInfo.change > 0 ? "trending-up" : "trending-down"}
                  size={16}
                  color={changeColor}
                />
                <Text
                  style={[
                    styles.changeText,
                    { color: changeColor },
                  ]}
                >
                  {changeInfo.change > 0 ? "+" : ""}
                  {changeInfo.change} kg from start
                </Text>
              </View>
            )}
            {!latest && (
              <Text style={styles.heroHint}>No weight logged yet</Text>
            )}
          </Panel>

          {/* ── Weight Input ── */}
          <SectionHeader title="Log Weight" />
          <Panel>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.weightInput}
                placeholder="72.5"
                placeholderTextColor={colors.textMuted}
                value={weightInput}
                onChangeText={setWeightInput}
                keyboardType="decimal-pad"
                maxLength={6}
              />
              <Text style={styles.inputUnit}>kg</Text>
              <Pressable
                style={[
                  styles.saveBtn,
                  !weightInput && styles.saveBtnDisabled,
                ]}
                onPress={handleSaveWeight}
                disabled={!weightInput}
              >
                <Text style={styles.saveBtnText}>Save</Text>
              </Pressable>
            </View>
          </Panel>

          {/* ── 30-Day Trend ── */}
          {sparkData.length >= 2 && (
            <>
              <SectionHeader
                title="30-Day Trend"
                right={`${entries.length} entries`}
              />
              <Panel style={styles.chartPanel}>
                <SparklineChart
                  data={sparkData}
                  width={SCREEN_WIDTH - CHART_PADDING}
                  height={80}
                  color={colors.body}
                />
                <View style={styles.chartLabels}>
                  <Text style={styles.chartLabel}>
                    {entries.length >= 2
                      ? formatDateShort(entries[Math.max(entries.length - 30, 0)].dateKey)
                      : ""}
                  </Text>
                  <Text style={styles.chartLabel}>
                    {entries.length >= 1
                      ? formatDateShort(entries[entries.length - 1].dateKey)
                      : ""}
                  </Text>
                </View>
              </Panel>
            </>
          )}

          {/* ── Goal Weight ── */}
          <SectionHeader title="Goal" />
          {goalWeight !== null && !showGoalForm ? (
            <Panel>
              <View style={styles.goalRow}>
                <View>
                  <Text style={styles.goalValue}>{goalWeight.toFixed(1)} kg</Text>
                  <Text style={styles.goalLabel}>Target Weight</Text>
                </View>
                {goalProgress && (
                  <View style={styles.goalRight}>
                    <Text style={styles.goalPct}>{goalProgress.pct}%</Text>
                    <Text style={styles.goalRemaining}>
                      {goalProgress.remaining > 0
                        ? `${goalProgress.remaining.toFixed(1)} kg to go`
                        : goalProgress.overshot
                          ? `${Math.abs(goalProgress.remaining).toFixed(1)} kg past goal`
                          : "Goal reached!"}
                    </Text>
                  </View>
                )}
              </View>
              {goalProgress && (
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${goalProgress.pct}%` },
                    ]}
                  />
                </View>
              )}
              <Pressable
                onPress={() => {
                  setGoalInput(goalWeight.toString());
                  setShowGoalForm(true);
                }}
                style={styles.goalEditBtn}
              >
                <Ionicons name="create-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.goalEditText}>Update Goal</Text>
              </Pressable>
            </Panel>
          ) : (
            <Panel>
              {showGoalForm || goalWeight === null ? (
                <>
                  <Text style={styles.fieldLabel}>Goal Weight (kg)</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.weightInput}
                      placeholder="70.0"
                      placeholderTextColor={colors.textMuted}
                      value={goalInput}
                      onChangeText={setGoalInput}
                      keyboardType="decimal-pad"
                      maxLength={6}
                    />
                    <Pressable
                      style={[
                        styles.saveBtn,
                        !goalInput && styles.saveBtnDisabled,
                      ]}
                      onPress={handleSaveGoal}
                      disabled={!goalInput}
                    >
                      <Text style={styles.saveBtnText}>Set</Text>
                    </Pressable>
                  </View>
                  {showGoalForm && (
                    <Pressable
                      onPress={() => setShowGoalForm(false)}
                      style={styles.cancelBtn}
                    >
                      <Text style={styles.cancelText}>Cancel</Text>
                    </Pressable>
                  )}
                </>
              ) : null}
            </Panel>
          )}

          {/* ── Recent Entries ── */}
          <SectionHeader
            title="Recent Entries"
            right={`${entries.length} total`}
          />
          {recentEntries.length === 0 ? (
            <Panel>
              <Text style={styles.emptyText}>No entries yet</Text>
              <Text style={styles.emptySub}>
                Log your first weight to start tracking
              </Text>
            </Panel>
          ) : (
            recentEntries.map((entry, idx) => {
              // Show delta from previous entry
              const prevEntry = recentEntries[idx + 1]; // reverse order, so next in array is earlier
              const delta = prevEntry
                ? +(entry.weightKg - prevEntry.weightKg).toFixed(1)
                : null;

              // Bug 11: goal-aware delta coloring
              let deltaColor: string = colors.textSecondary;
              if (delta !== null && delta !== 0) {
                if (goalProgress) {
                  if (goalProgress.direction === "lose") {
                    deltaColor = delta < 0 ? colors.success : colors.danger;
                  } else if (goalProgress.direction === "gain") {
                    deltaColor = delta > 0 ? colors.success : colors.danger;
                  } else {
                    deltaColor = Math.abs(delta) < 0.5 ? colors.success : colors.warning;
                  }
                } else {
                  deltaColor = delta > 0 ? colors.danger : colors.success;
                }
              }

              return (
                <Panel key={entry.dateKey} style={styles.entryCard}>
                  <View style={styles.entryRow}>
                    <View>
                      <Text style={styles.entryDate}>
                        {formatDateShort(entry.dateKey)}
                      </Text>
                    </View>
                    <View style={styles.entryRight}>
                      <Text style={styles.entryWeight}>
                        {entry.weightKg.toFixed(1)} kg
                      </Text>
                      {delta !== null && delta !== 0 && (
                        <Text
                          style={[
                            styles.entryDelta,
                            { color: deltaColor },
                          ]}
                        >
                          {delta > 0 ? "+" : ""}
                          {delta}
                        </Text>
                      )}
                      <Pressable
                        onPress={() => handleDeleteEntry(entry.dateKey)}
                        style={styles.entryDeleteBtn}
                        hitSlop={8}
                      >
                        <Ionicons name="trash-outline" size={14} color={colors.danger} />
                      </Pressable>
                    </View>
                  </View>
                </Panel>
              );
            })
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  body: { flex: 1, paddingHorizontal: spacing.lg },
  bodyContent: { paddingBottom: spacing["5xl"] },

  // Hero
  heroCard: { alignItems: "center", paddingVertical: spacing["3xl"] },
  heroValue: {
    fontSize: 56,
    fontWeight: "200",
    color: colors.text,
    fontVariant: ["tabular-nums"],
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
  },
  heroUnit: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  heroHint: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  changeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  changeText: { fontSize: 14, fontWeight: "600" },

  // Input
  fieldLabel: {
    ...fonts.kicker,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  weightInput: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 20,
    fontWeight: "600",
    color: colors.text,
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
  },
  inputUnit: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  saveBtn: {
    backgroundColor: colors.body,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 16, fontWeight: "700", color: "#000" },

  // Chart
  chartPanel: { alignItems: "center", paddingVertical: spacing.lg },
  chartLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: spacing.sm,
  },
  chartLabel: { fontSize: 11, color: colors.textMuted },

  // Goal
  goalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  goalValue: { ...fonts.monoValue, fontSize: 20 },
  goalLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  goalRight: { alignItems: "flex-end" },
  goalPct: { ...fonts.monoValue, fontSize: 18, color: colors.body },
  goalRemaining: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  progressTrack: {
    height: 6,
    backgroundColor: colors.surfaceBorder,
    borderRadius: radius.full,
    overflow: "hidden",
    marginTop: spacing.lg,
  },
  progressFill: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.body,
  },
  goalEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingVertical: spacing.xs,
  },
  goalEditText: { fontSize: 13, color: colors.textSecondary },
  cancelBtn: { alignItems: "center", marginTop: spacing.md },
  cancelText: { fontSize: 14, color: colors.textMuted },

  // Entries
  entryCard: { marginBottom: spacing.sm },
  entryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  entryDate: { fontSize: 14, fontWeight: "600", color: colors.text },
  entryRight: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  entryWeight: { ...fonts.mono, fontSize: 16 },
  entryDelta: { fontSize: 12, fontWeight: "600" },
  entryDeleteBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    marginLeft: spacing.xs,
  },

  // Empty
  emptyText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.xs,
  },
});
