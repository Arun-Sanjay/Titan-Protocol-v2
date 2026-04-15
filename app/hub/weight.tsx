import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import Svg, { Polyline, Polygon, Circle, Line, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import Animated, { FadeInDown, FadeInRight, ZoomIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, fonts } from "../../src/theme";
import { Panel } from "../../src/components/ui/Panel";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { MetricValue } from "../../src/components/ui/MetricValue";
import { getTodayKey, formatDateShort } from "../../src/lib/date";
import {
  getMovingAverage,
  getWeeklyRate,
  getGoalETA,
  getTrend,
  isValidWeight,
  type WeightEntry,
  type GoalProgress,
  type WeightTrend,
} from "../../src/lib/weight-helpers";
import {
  computeBMI,
  getBMICategory,
} from "../../src/lib/nutrition-helpers";
import { useWeightLogs, useCreateWeightLog, useDeleteWeightLog } from "../../src/hooks/queries/useWeight";
import { useNutritionProfile } from "../../src/hooks/queries/useNutrition";
import type { WeightLog } from "../../src/services/weight";

// ─── Cloud-to-legacy adapter (pure helpers expect WeightEntry shape) ────────

function toWeightEntry(log: WeightLog): WeightEntry {
  return {
    dateKey: log.date_key,
    weightKg: log.weight_kg,
    createdAt: new Date(log.created_at).getTime(),
  };
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MONO_FONT = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });
const CHART_HEIGHT = 140;
const CHART_PADDING_TOP = 20;
const CHART_PADDING_BOTTOM = 24;

// ─── Helpers ────────────────────────────────────────────────────────────────

function trendIcon(trend: WeightTrend): keyof typeof Ionicons.glyphMap {
  switch (trend) {
    case "gaining": return "trending-up";
    case "losing": return "trending-down";
    case "stable": return "remove-outline";
  }
}

function trendLabel(trend: WeightTrend): string {
  switch (trend) {
    case "gaining": return "Gaining";
    case "losing": return "Losing";
    case "stable": return "Stable";
  }
}

// ─── Weight Chart Component ──────────────────────────────────────────────────

const WeightChart = React.memo(function WeightChart({
  entries,
  movingAvg,
  goalWeight,
  width,
}: {
  entries: WeightEntry[];
  movingAvg: { dateKey: string; value: number }[];
  goalWeight: number | null;
  width: number;
}) {
  const gradId = useRef(`wtGrad-${Math.random().toString(36).slice(2)}`).current;
  const maGradId = useRef(`wtMaGrad-${Math.random().toString(36).slice(2)}`).current;

  if (entries.length < 2) return null;

  const recent = entries.slice(-30);
  const recentMA = movingAvg.slice(-30);
  const weights = recent.map((e) => e.weightKg);
  const allValues = [...weights, ...(goalWeight ? [goalWeight] : [])];
  const min = Math.min(...allValues) - 1;
  const max = Math.max(...allValues) + 1;
  const range = max - min || 1;

  const padX = 4;
  const chartW = width - padX * 2;
  const chartH = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;

  const toX = (i: number) => padX + (i / (recent.length - 1)) * chartW;
  const toY = (val: number) =>
    CHART_PADDING_TOP + chartH - ((val - min) / range) * chartH;

  // Raw data points
  const rawPoints = recent.map((e, i) => `${toX(i)},${toY(e.weightKg)}`);
  const rawLine = rawPoints.join(" ");

  // Area under raw line
  const rawArea = [
    ...rawPoints,
    `${toX(recent.length - 1)},${CHART_HEIGHT - CHART_PADDING_BOTTOM}`,
    `${toX(0)},${CHART_HEIGHT - CHART_PADDING_BOTTOM}`,
  ].join(" ");

  // Moving average line
  let maLine = "";
  if (recentMA.length >= 2) {
    // Align MA entries with recent entries by dateKey
    const maMap = new Map(recentMA.map((m) => [m.dateKey, m.value]));
    const maPoints: string[] = [];
    recent.forEach((e, i) => {
      const val = maMap.get(e.dateKey);
      if (val !== undefined) {
        maPoints.push(`${toX(i)},${toY(val)}`);
      }
    });
    if (maPoints.length >= 2) {
      maLine = maPoints.join(" ");
    }
  }

  // Goal line Y
  const goalY = goalWeight ? toY(goalWeight) : null;

  // Y-axis labels
  const yLabels = [min, min + range / 2, max].map((v) => ({
    value: v.toFixed(1),
    y: toY(v),
  }));

  return (
    <View>
      <Svg width={width} height={CHART_HEIGHT}>
        <Defs>
          <SvgGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={colors.body} stopOpacity="0.15" />
            <Stop offset="100%" stopColor={colors.body} stopOpacity="0" />
          </SvgGradient>
        </Defs>

        {/* Grid lines */}
        {yLabels.map((l, i) => (
          <Line
            key={i}
            x1={padX}
            y1={l.y}
            x2={width - padX}
            y2={l.y}
            stroke={colors.surfaceBorder}
            strokeWidth={1}
            strokeDasharray="4,4"
          />
        ))}

        {/* Goal line */}
        {goalY !== null && (
          <Line
            x1={padX}
            y1={goalY}
            x2={width - padX}
            y2={goalY}
            stroke={colors.warning}
            strokeWidth={1.5}
            strokeDasharray="6,4"
            opacity={0.6}
          />
        )}

        {/* Area fill */}
        <Polygon points={rawArea} fill={`url(#${gradId})`} />

        {/* Raw data line */}
        <Polyline
          points={rawLine}
          fill="none"
          stroke={colors.body}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.5}
        />

        {/* Moving average line */}
        {maLine && (
          <Polyline
            points={maLine}
            fill="none"
            stroke={colors.body}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Latest point dot */}
        <Circle
          cx={toX(recent.length - 1)}
          cy={toY(recent[recent.length - 1].weightKg)}
          r={4}
          fill={colors.body}
        />
      </Svg>

      {/* Date labels */}
      <View style={chartStyles.dateLabels}>
        <Text style={chartStyles.dateLabel}>
          {formatDateShort(recent[0].dateKey)}
        </Text>
        <Text style={chartStyles.dateLabel}>
          {formatDateShort(recent[recent.length - 1].dateKey)}
        </Text>
      </View>

      {/* Legend */}
      <View style={chartStyles.legend}>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendLine, { backgroundColor: colors.body, opacity: 0.5 }]} />
          <Text style={chartStyles.legendText}>Raw</Text>
        </View>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendLine, { backgroundColor: colors.body }]} />
          <Text style={chartStyles.legendText}>7-day avg</Text>
        </View>
        {goalWeight !== null && (
          <View style={chartStyles.legendItem}>
            <View style={[chartStyles.legendLine, { backgroundColor: colors.warning }]} />
            <Text style={chartStyles.legendText}>Goal</Text>
          </View>
        )}
      </View>
    </View>
  );
});

const chartStyles = StyleSheet.create({
  dateLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  dateLabel: { fontSize: 10, color: colors.textMuted },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendLine: {
    width: 16,
    height: 2.5,
    borderRadius: 2,
  },
  legendText: { fontSize: 10, color: colors.textMuted },
});

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function WeightScreen() {
  const router = useRouter();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const CHART_WIDTH = SCREEN_WIDTH - spacing.lg * 2 - 40;

  // AppState listener for stale todayKey
  const [appActive, setAppActive] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setAppActive((c) => c + 1);
    });
    return () => sub.remove();
  }, []);
  const todayKey = useMemo(() => getTodayKey(), [appActive]);

  const { data: weightLogs = [] } = useWeightLogs();
  const createWeightLogMut = useCreateWeightLog();
  const deleteWeightLogMut = useDeleteWeightLog();

  // Map dateKey -> cloud id for deletion
  const dateKeyToId = useMemo(() => {
    const m = new Map<string, string>();
    for (const log of weightLogs) m.set(log.date_key, log.id);
    return m;
  }, [weightLogs]);

  // Nutrition profile for BMI
  const { data: nutritionProfile } = useNutritionProfile();

  // Convert cloud logs to legacy WeightEntry shape for pure helpers
  const entries = useMemo(() => weightLogs.map(toWeightEntry), [weightLogs]);

  // Goal weight is stored locally for now (no cloud table for it)
  // TODO: migrate goal_weight to a cloud column on nutrition_profile or a dedicated table
  const [goalWeight, setGoalWeight] = useState<number | null>(null);

  const [weightInput, setWeightInput] = useState("");
  const [goalInput, setGoalInput] = useState("");
  const [showGoalForm, setShowGoalForm] = useState(false);

  // No load() needed — React Query auto-fetches

  const latest = useMemo(() => (entries.length > 0 ? entries[entries.length - 1] : null), [entries]);
  const changeInfo = useMemo(() => {
    if (entries.length < 2) return null;
    const first = entries[0];
    const last = entries[entries.length - 1];
    return {
      change: +(last.weightKg - first.weightKg).toFixed(1),
      startWeight: first.weightKg,
    };
  }, [entries]);
  const goalProgress: GoalProgress | null = useMemo(() => {
    if (!goalWeight || entries.length === 0) return null;
    const start = entries[0].weightKg;
    const current = entries[entries.length - 1].weightKg;
    const totalDistance = Math.abs(goalWeight - start);
    if (totalDistance === 0) return { pct: 100, remaining: 0, direction: "maintain" as const };
    const direction: "gain" | "lose" = goalWeight > start ? "gain" : "lose";
    const progress = direction === "lose" ? start - current : current - start;
    const pct = Math.min(Math.round((Math.max(progress, 0) / totalDistance) * 100), 100);
    const remaining = direction === "lose" ? current - goalWeight : goalWeight - current;
    return { pct, remaining, direction, overshot: remaining < 0 };
  }, [entries, goalWeight]);
  const trend = useMemo(() => getTrend(entries), [entries]);
  const weeklyRate = useMemo(() => getWeeklyRate(entries), [entries]);
  const movingAvg = useMemo(() => getMovingAverage(entries), [entries]);
  const goalETA = useMemo(() => getGoalETA(entries, goalWeight), [entries, goalWeight]);

  // BMI calculation
  const bmi = useMemo(() => {
    if (!latest || !nutritionProfile) return null;
    const heightCm = nutritionProfile.height_cm;
    if (!heightCm || heightCm < 50 || heightCm > 300) return null;
    const value = computeBMI(heightCm, latest.weightKg);
    if (value <= 0 || value > 100) return null;
    return { value, ...getBMICategory(value) };
  }, [latest, nutritionProfile]);

  // Goal-aware change color
  const changeColor = useMemo(() => {
    if (!changeInfo) return colors.textSecondary;
    if (!goalProgress) {
      return changeInfo.change > 0 ? colors.danger : colors.success;
    }
    if (goalProgress.direction === "lose") {
      return changeInfo.change <= 0 ? colors.success : colors.danger;
    }
    if (goalProgress.direction === "gain") {
      return changeInfo.change >= 0 ? colors.success : colors.danger;
    }
    return Math.abs(changeInfo.change) < 1 ? colors.success : colors.warning;
  }, [changeInfo, goalProgress]);

  // Trend color
  const trendColor = useMemo(() => {
    if (!goalProgress) {
      if (trend === "losing") return colors.success;
      if (trend === "gaining") return colors.danger;
      return colors.textSecondary;
    }
    if (goalProgress.direction === "lose") {
      return trend === "losing" ? colors.success : trend === "gaining" ? colors.danger : colors.textSecondary;
    }
    if (goalProgress.direction === "gain") {
      return trend === "gaining" ? colors.success : trend === "losing" ? colors.danger : colors.textSecondary;
    }
    return colors.textSecondary;
  }, [trend, goalProgress]);

  const handleSaveWeight = useCallback(() => {
    const val = parseFloat(weightInput);
    if (isNaN(val) || val < 20 || val > 500) {
      if (!isNaN(val) && val > 0 && val < 20) {
        Alert.alert("Invalid Weight", "Weight must be at least 20 kg");
      }
      return;
    }
    createWeightLogMut.mutate({ dateKey: todayKey, weightKg: +val.toFixed(1) });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setWeightInput("");
  }, [weightInput, todayKey, createWeightLogMut]);

  const handleSaveGoal = useCallback(() => {
    const val = parseFloat(goalInput);
    if (isNaN(val) || !isValidWeight(val)) {
      Alert.alert("Invalid Goal", "Goal weight must be between 20 and 500 kg.");
      return;
    }
    setGoalWeight(+val.toFixed(1));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setGoalInput("");
    setShowGoalForm(false);
  }, [goalInput]);

  const handleDeleteEntry = useCallback(
    (dateKey: string) => {
      const cloudId = dateKeyToId.get(dateKey);
      if (!cloudId) return;
      Alert.alert("Delete Entry", "Remove this weight entry?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteWeightLogMut.mutate(cloudId);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ]);
    },
    [dateKeyToId, deleteWeightLogMut],
  );

  // Quick adjust: pre-fill with last weight
  const handleQuickFill = useCallback(() => {
    if (latest) {
      setWeightInput(latest.weightKg.toFixed(1));
    }
  }, [latest]);

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
          <Panel tone="hero" delay={0}>
            <View style={styles.heroRow}>
              <View style={styles.heroLeft}>
                <Text style={styles.heroValue}>
                  {latest ? latest.weightKg.toFixed(1) : "--.-"}
                </Text>
                <Text style={styles.heroUnit}>kg</Text>
              </View>
              <View style={styles.heroRight}>
                {/* Trend badge */}
                <Animated.View
                  entering={FadeInRight.delay(200).duration(400)}
                  style={[styles.trendBadge, { backgroundColor: trendColor + "18" }]}
                >
                  <Ionicons name={trendIcon(trend)} size={14} color={trendColor} />
                  <Text style={[styles.trendBadgeText, { color: trendColor }]}>
                    {trendLabel(trend)}
                  </Text>
                </Animated.View>

                {/* Change from start */}
                {changeInfo && (
                  <View style={styles.changeRow}>
                    <Text style={[styles.changeText, { color: changeColor }]}>
                      {changeInfo.change > 0 ? "+" : ""}
                      {changeInfo.change} kg
                    </Text>
                    <Text style={styles.changeLabel}>from start</Text>
                  </View>
                )}

                {/* Weekly rate — only show when we have at least 7 days of data */}
                {weeklyRate !== null && entries.length >= 7 && (
                  <Text style={styles.weeklyRateText}>
                    {weeklyRate > 0 ? "+" : ""}
                    {weeklyRate} kg/week
                  </Text>
                )}
              </View>
            </View>

            {/* BMI row */}
            {bmi && (
              <View style={styles.bmiRow}>
                <Text style={styles.bmiLabel}>BMI</Text>
                <Text style={[styles.bmiValue, { color: colors[bmi.color] }]}>
                  {bmi.value}
                </Text>
                <Text style={[styles.bmiCategory, { color: colors[bmi.color] }]}>
                  {bmi.label}
                </Text>
              </View>
            )}

            {!latest && (
              <Text style={styles.heroHint}>No weight logged yet</Text>
            )}
          </Panel>

          {/* ── Weight Input ── */}
          <SectionHeader title="Log Weight" />
          <Panel delay={100}>
            <View style={styles.inputRow}>
              <Pressable onPress={handleQuickFill} style={styles.quickFillBtn}>
                <Ionicons name="arrow-undo-outline" size={16} color={colors.textSecondary} />
              </Pressable>
              <TextInput
                style={styles.weightInput}
                placeholder={latest ? latest.weightKg.toFixed(1) : "72.5"}
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
            {/* Quick adjust buttons */}
            {latest && (
              <View style={styles.quickAdjustRow}>
                {[-0.5, -0.1, +0.1, +0.5].map((delta) => (
                  <Pressable
                    key={delta}
                    style={styles.quickAdjustBtn}
                    onPress={() => {
                      const newVal = Math.max(20, Math.min(500, +(latest.weightKg + delta).toFixed(1)));
                      setWeightInput(String(newVal));
                      Haptics.selectionAsync();
                    }}
                  >
                    <Text style={styles.quickAdjustText}>
                      {delta > 0 ? "+" : ""}{delta}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </Panel>

          {/* ── 30-Day Chart ── */}
          {entries.length >= 2 && (
            <>
              <SectionHeader
                title="30-Day Trend"
                right={`${entries.length} entries`}
              />
              <Panel delay={200} style={styles.chartPanel}>
                <WeightChart
                  entries={entries}
                  movingAvg={movingAvg}
                  goalWeight={goalWeight}
                  width={CHART_WIDTH}
                />
              </Panel>
            </>
          )}

          {/* ── Goal Weight ── */}
          <SectionHeader title="Goal" />
          {goalWeight !== null && !showGoalForm ? (
            <Panel delay={300}>
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

              {/* Progress bar */}
              {goalProgress && (
                <View style={styles.progressTrack}>
                  <Animated.View
                    entering={FadeInRight.duration(600)}
                    style={[
                      styles.progressFill,
                      { width: `${Math.min(goalProgress.pct, 100)}%` },
                    ]}
                  />
                </View>
              )}

              {/* ETA */}
              {goalETA !== null && entries.length >= 7 && (
                <View style={styles.etaRow}>
                  <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.etaText}>
                    {goalETA > 104
                      ? "2+ years to goal at current rate"
                      : `~${goalETA} ${goalETA === 1 ? "week" : "weeks"} to goal at current rate`}
                  </Text>
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
            <Panel delay={300}>
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

          {/* ── Stats Row ── */}
          {entries.length >= 2 && (
            <View style={styles.statsGrid}>
              <Panel style={styles.statCard} delay={400}>
                <Ionicons name="speedometer-outline" size={18} color={colors.body} />
                <MetricValue
                  label="Weekly Rate"
                  value={weeklyRate !== null ? `${weeklyRate > 0 ? "+" : ""}${weeklyRate}` : "--"}
                  size="sm"
                  color={colors.body}
                  suffix=" kg"
                />
              </Panel>
              <Panel style={styles.statCard} delay={450}>
                <Ionicons name="analytics-outline" size={18} color={colors.charisma} />
                <MetricValue
                  label="Entries"
                  value={entries.length}
                  size="sm"
                  color={colors.charisma}
                  animated
                />
              </Panel>
            </View>
          )}

          {/* ── Recent Entries ── */}
          <SectionHeader
            title="Recent Entries"
            right={`${entries.length} total`}
          />
          {recentEntries.length === 0 ? (
            <Panel delay={500}>
              <Text style={styles.emptyText}>No entries yet</Text>
              <Text style={styles.emptySub}>
                Log your first weight to start tracking
              </Text>
            </Panel>
          ) : (
            recentEntries.map((entry, idx) => {
              const prevEntry = recentEntries[idx + 1];
              const delta = prevEntry
                ? +(entry.weightKg - prevEntry.weightKg).toFixed(1)
                : null;

              let deltaColor: string = colors.textSecondary;
              if (delta !== null && delta !== 0) {
                if (goalProgress) {
                  if (goalProgress.direction === "lose") {
                    deltaColor = delta < 0 ? colors.success : colors.danger;
                  } else if (goalProgress.direction === "gain") {
                    deltaColor = delta > 0 ? colors.success : colors.danger;
                  } else {
                    deltaColor =
                      Math.abs(delta) < 0.5 ? colors.success : colors.warning;
                  }
                } else {
                  deltaColor = delta > 0 ? colors.danger : colors.success;
                }
              }

              return (
                <Panel key={entry.dateKey} style={styles.entryCard} delay={500 + idx * 40}>
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
                        <Text style={[styles.entryDelta, { color: deltaColor }]}>
                          {delta > 0 ? "+" : ""}
                          {delta}
                        </Text>
                      )}
                      <Pressable
                        onPress={() => handleDeleteEntry(entry.dateKey)}
                        style={styles.entryDeleteBtn}
                        hitSlop={8}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={14}
                          color={colors.danger}
                        />
                      </Pressable>
                    </View>
                  </View>
                </Panel>
              );
            })
          )}

          <View style={{ height: 60 }} />
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
  heroRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  heroLeft: { alignItems: "flex-start" },
  heroValue: {
    fontSize: 52,
    fontWeight: "200",
    color: colors.text,
    fontVariant: ["tabular-nums"],
    fontFamily: MONO_FONT,
  },
  heroUnit: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  heroHint: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: "center",
  },
  heroRight: { alignItems: "flex-end", gap: spacing.sm, paddingTop: spacing.sm },

  // Trend badge
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  trendBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // Change
  changeRow: { alignItems: "flex-end" },
  changeText: { fontSize: 16, fontWeight: "700", fontFamily: MONO_FONT },
  changeLabel: { fontSize: 10, color: colors.textMuted, marginTop: 1 },
  weeklyRateText: {
    fontFamily: MONO_FONT,
    fontSize: 12,
    color: colors.textSecondary,
  },

  // BMI
  bmiRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingTop: spacing.lg,
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.panelBorder,
  },
  bmiLabel: {
    ...fonts.kicker,
    color: colors.textMuted,
  },
  bmiValue: {
    fontFamily: MONO_FONT,
    fontSize: 18,
    fontWeight: "700",
  },
  bmiCategory: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

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
  quickFillBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    alignItems: "center",
    justifyContent: "center",
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
    fontFamily: MONO_FONT,
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

  // Quick adjust
  quickAdjustRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.panelBorder,
  },
  quickAdjustBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  quickAdjustText: {
    fontFamily: MONO_FONT,
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },

  // Chart
  chartPanel: { paddingVertical: spacing.lg },

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
  etaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.panelBorder,
  },
  etaText: { fontSize: 12, color: colors.textSecondary },
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

  // Stats
  statsGrid: { flexDirection: "row", gap: spacing.md },
  statCard: { flex: 1, alignItems: "center", gap: spacing.xs },

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
