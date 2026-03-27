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
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, fonts } from "../../src/theme";
import { Panel } from "../../src/components/ui/Panel";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { getTodayKey, addDays, formatDateShort, getDayOfWeek } from "../../src/lib/date";
import {
  useSleepStore,
  computeDurationMinutes,
  type SleepEntry,
} from "../../src/stores/useSleepStore";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function qualityLabel(q: number): string {
  switch (q) {
    case 1: return "Poor";
    case 2: return "Fair";
    case 3: return "Good";
    case 4: return "Great";
    case 5: return "Excellent";
    default: return "";
  }
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function SleepScreen() {
  const router = useRouter();

  // Bug 5: AppState listener to refresh todayKey past midnight
  const [appActive, setAppActive] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setAppActive(c => c + 1);
    });
    return () => sub.remove();
  }, []);
  const todayKey = useMemo(() => getTodayKey(), [appActive]);

  const entries = useSleepStore((s) => s.entries);
  const loadEntry = useSleepStore((s) => s.loadEntry);
  const addEntry = useSleepStore((s) => s.addEntry);
  const deleteEntry = useSleepStore((s) => s.deleteEntry);
  const getRange = useSleepStore((s) => s.getRange);

  // Form state
  const [bedtime, setBedtime] = useState("");
  const [wakeTime, setWakeTime] = useState("");
  const [quality, setQuality] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [notes, setNotes] = useState("");
  const [showForm, setShowForm] = useState(false);

  // Bug 6: include todayKey and loadEntry in deps
  useEffect(() => {
    for (let i = 0; i <= 7; i++) {
      loadEntry(addDays(todayKey, -i));
    }
  }, [todayKey, loadEntry]);

  const todayEntry = entries[todayKey] ?? null;

  // 7-day history (excluding today)
  const history = useMemo(() => {
    const result: SleepEntry[] = [];
    for (let i = 1; i <= 7; i++) {
      const key = addDays(todayKey, -i);
      const entry = entries[key];
      if (entry) result.push(entry);
    }
    return result;
  }, [entries, todayKey]);

  // Weekly stats
  const weekStats = useMemo(() => {
    const all = todayEntry ? [todayEntry, ...history] : history;
    if (all.length === 0) return { avgDuration: 0, avgQuality: 0 };
    const totalDuration = all.reduce((sum, e) => sum + e.durationMinutes, 0);
    const totalQuality = all.reduce((sum, e) => sum + e.quality, 0);
    return {
      avgDuration: Math.round(totalDuration / all.length),
      avgQuality: +(totalQuality / all.length).toFixed(1),
    };
  }, [todayEntry, history]);

  const handleSave = useCallback(() => {
    if (!bedtime || !wakeTime) return;

    // Validate HH:MM format
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(bedtime) || !timeRegex.test(wakeTime)) return;

    const durationMinutes = computeDurationMinutes(bedtime, wakeTime);

    // Bug 8: reject if duration is 0
    if (durationMinutes === 0) return;

    addEntry({
      dateKey: todayKey,
      bedtime,
      wakeTime,
      durationMinutes,
      quality,
      notes: notes.trim(),
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowForm(false);
    setBedtime("");
    setWakeTime("");
    setQuality(3);
    setNotes("");
  }, [bedtime, wakeTime, quality, notes, todayKey, addEntry]);

  // Bug 7: delete handler for history entries
  const handleDelete = useCallback(
    (dateKey: string) => {
      Alert.alert("Delete Entry", "Remove this sleep entry?", [
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

  const previewDuration = useMemo(() => {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(bedtime) || !timeRegex.test(wakeTime)) return null;
    return computeDurationMinutes(bedtime, wakeTime);
  }, [bedtime, wakeTime]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Sleep Tracker</Text>
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
          {/* ── Today's Sleep Card ── */}
          <SectionHeader title="Last Night" />
          {todayEntry ? (
            <Panel>
              <View style={styles.todayGrid}>
                <View style={styles.todayStat}>
                  <Ionicons name="moon-outline" size={20} color={colors.mind} />
                  <Text style={styles.todayValue}>{todayEntry.bedtime}</Text>
                  <Text style={styles.todayLabel}>Bedtime</Text>
                </View>
                <View style={styles.todayStat}>
                  <Ionicons name="sunny-outline" size={20} color={colors.warning} />
                  <Text style={styles.todayValue}>{todayEntry.wakeTime}</Text>
                  <Text style={styles.todayLabel}>Wake</Text>
                </View>
                <View style={styles.todayStat}>
                  <Ionicons name="time-outline" size={20} color={colors.body} />
                  <Text style={styles.todayValue}>
                    {formatDuration(todayEntry.durationMinutes)}
                  </Text>
                  <Text style={styles.todayLabel}>Duration</Text>
                </View>
              </View>
              <View style={styles.qualityRow}>
                <Text style={styles.qualityLabel}>Quality</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Ionicons
                      key={i}
                      name={i <= todayEntry.quality ? "star" : "star-outline"}
                      size={18}
                      color={i <= todayEntry.quality ? colors.warning : colors.textMuted}
                    />
                  ))}
                </View>
                <Text style={styles.qualityText}>
                  {qualityLabel(todayEntry.quality)}
                </Text>
              </View>
              {todayEntry.notes.length > 0 && (
                <Text style={styles.notesText}>{todayEntry.notes}</Text>
              )}
            </Panel>
          ) : (
            <Panel
              onPress={() => {
                setShowForm(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <View style={styles.promptRow}>
                <Ionicons name="moon-outline" size={28} color={colors.mind} />
                <View style={{ marginLeft: spacing.md, flex: 1 }}>
                  <Text style={styles.promptTitle}>Log tonight's sleep</Text>
                  <Text style={styles.promptSub}>
                    Tap to record bedtime, wake time, and quality
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </View>
            </Panel>
          )}

          {/* ── Log Form ── */}
          {(showForm || (!todayEntry && showForm)) && (
            <>
              <SectionHeader title="Log Sleep" />
              <Panel>
                {/* Bedtime */}
                <Text style={styles.fieldLabel}>Bedtime</Text>
                <TextInput
                  style={styles.input}
                  placeholder="22:30"
                  placeholderTextColor={colors.textMuted}
                  value={bedtime}
                  onChangeText={setBedtime}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />

                {/* Wake Time */}
                <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
                  Wake Time
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="06:30"
                  placeholderTextColor={colors.textMuted}
                  value={wakeTime}
                  onChangeText={setWakeTime}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />

                {/* Duration preview */}
                {previewDuration !== null && (
                  <Text style={styles.durationPreview}>
                    {previewDuration === 0
                      ? "Bedtime and wake time cannot be the same"
                      : formatDuration(previewDuration)}
                  </Text>
                )}

                {/* Quality */}
                <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
                  Quality
                </Text>
                <View style={styles.qualitySelector}>
                  {([1, 2, 3, 4, 5] as const).map((q) => (
                    <Pressable
                      key={q}
                      onPress={() => {
                        setQuality(q);
                        Haptics.selectionAsync();
                      }}
                      style={[
                        styles.qualityDot,
                        q === quality && styles.qualityDotActive,
                      ]}
                    >
                      <Ionicons
                        name={q <= quality ? "star" : "star-outline"}
                        size={22}
                        color={q <= quality ? colors.warning : colors.textMuted}
                      />
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.qualityHint}>{qualityLabel(quality)}</Text>

                {/* Notes */}
                <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
                  Notes
                </Text>
                <TextInput
                  style={[styles.input, styles.notesInput]}
                  placeholder="How did you sleep?"
                  placeholderTextColor={colors.textMuted}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />

                {/* Save */}
                <Pressable
                  style={[
                    styles.saveBtn,
                    (!bedtime || !wakeTime) && styles.saveBtnDisabled,
                  ]}
                  onPress={handleSave}
                  disabled={!bedtime || !wakeTime}
                >
                  <Text style={styles.saveBtnText}>Save</Text>
                </Pressable>
              </Panel>
            </>
          )}

          {/* Toggle form button if today already logged */}
          {todayEntry && !showForm && (
            <Pressable
              style={styles.editBtn}
              onPress={() => {
                setBedtime(todayEntry.bedtime);
                setWakeTime(todayEntry.wakeTime);
                setQuality(todayEntry.quality);
                setNotes(todayEntry.notes);
                setShowForm(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Ionicons name="create-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.editBtnText}>Edit Entry</Text>
            </Pressable>
          )}

          {/* ── 7-Day History ── */}
          <SectionHeader title="7-Day History" right={`${history.length} entries`} />
          {history.length === 0 ? (
            <Panel>
              <Text style={styles.emptyText}>No sleep data yet</Text>
              <Text style={styles.emptySub}>
                Start logging to see your history
              </Text>
            </Panel>
          ) : (
            history.map((entry) => {
              const barWidth = Math.min((entry.durationMinutes / 600) * 100, 100); // 10h max
              return (
                <Panel key={entry.dateKey} style={styles.historyCard}>
                  <View style={styles.historyTop}>
                    <View>
                      <Text style={styles.historyDate}>
                        {getDayOfWeek(entry.dateKey)}{" "}
                        {formatDateShort(entry.dateKey)}
                      </Text>
                      <Text style={styles.historyTimes}>
                        {entry.bedtime} - {entry.wakeTime}
                      </Text>
                    </View>
                    <View style={styles.historyRight}>
                      <Text style={styles.historyDuration}>
                        {formatDuration(entry.durationMinutes)}
                      </Text>
                      <View style={styles.miniStars}>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Ionicons
                            key={i}
                            name={i <= entry.quality ? "star" : "star-outline"}
                            size={10}
                            color={
                              i <= entry.quality ? colors.warning : colors.textMuted
                            }
                          />
                        ))}
                      </View>
                    </View>
                  </View>
                  {/* Duration bar */}
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${barWidth}%`,
                          backgroundColor:
                            entry.durationMinutes >= 420
                              ? colors.body
                              : entry.durationMinutes >= 360
                                ? colors.warning
                                : colors.danger,
                        },
                      ]}
                    />
                  </View>
                  {/* Bug 7: Delete button */}
                  <Pressable
                    onPress={() => handleDelete(entry.dateKey)}
                    style={styles.historyDeleteBtn}
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={14} color={colors.danger} />
                    <Text style={styles.historyDeleteText}>Delete</Text>
                  </Pressable>
                </Panel>
              );
            })
          )}

          {/* ── Weekly Stats ── */}
          <SectionHeader title="This Week" />
          <View style={styles.statsRow}>
            <Panel style={styles.statCard}>
              <Ionicons name="time-outline" size={20} color={colors.body} />
              <Text style={styles.statValue}>
                {weekStats.avgDuration > 0
                  ? formatDuration(weekStats.avgDuration)
                  : "--"}
              </Text>
              <Text style={styles.statLabel}>Avg Duration</Text>
            </Panel>
            <Panel style={styles.statCard}>
              <Ionicons name="star-outline" size={20} color={colors.warning} />
              <Text style={styles.statValue}>
                {weekStats.avgQuality > 0 ? weekStats.avgQuality : "--"}
              </Text>
              <Text style={styles.statLabel}>Avg Quality</Text>
            </Panel>
          </View>
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

  // Today card
  todayGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: spacing.lg,
  },
  todayStat: { alignItems: "center", gap: spacing.xs },
  todayValue: { ...fonts.monoValue, fontSize: 18 },
  todayLabel: { fontSize: 11, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1 },
  qualityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.panelBorder,
  },
  qualityLabel: {
    ...fonts.kicker,
    color: colors.textMuted,
  },
  starsRow: { flexDirection: "row", gap: 2 },
  qualityText: { fontSize: 13, color: colors.textSecondary },
  notesText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.md,
    fontStyle: "italic",
  },

  // Prompt (no entry)
  promptRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  promptTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  promptSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

  // Form
  fieldLabel: {
    ...fonts.kicker,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
  },
  notesInput: {
    minHeight: 80,
    fontFamily: undefined,
    fontSize: 14,
  },
  durationPreview: {
    ...fonts.mono,
    color: colors.body,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  qualitySelector: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.lg,
  },
  qualityDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  qualityDotActive: {
    borderColor: colors.warning,
    backgroundColor: "rgba(251, 191, 36, 0.10)",
  },
  qualityHint: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  saveBtn: {
    backgroundColor: colors.mind,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.xl,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 16, fontWeight: "700", color: "#000" },

  // Edit
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  editBtnText: { fontSize: 14, color: colors.textSecondary },

  // History
  historyCard: { marginBottom: spacing.sm },
  historyTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  historyDate: { fontSize: 14, fontWeight: "600", color: colors.text },
  historyTimes: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  historyRight: { alignItems: "flex-end" },
  historyDuration: { ...fonts.mono, fontSize: 14 },
  miniStars: { flexDirection: "row", gap: 1, marginTop: 2 },
  barTrack: {
    height: 6,
    backgroundColor: colors.surfaceBorder,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  barFill: {
    height: 6,
    borderRadius: radius.full,
  },
  historyDeleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
  },
  historyDeleteText: {
    fontSize: 12,
    color: colors.danger,
  },

  // Stats
  statsRow: { flexDirection: "row", gap: spacing.md },
  statCard: { flex: 1, alignItems: "center", gap: spacing.xs },
  statValue: { ...fonts.monoValue },
  statLabel: { fontSize: 11, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1 },

  // Empty
  emptyText: { fontSize: 15, fontWeight: "600", color: colors.textSecondary, textAlign: "center" },
  emptySub: { fontSize: 13, color: colors.textMuted, textAlign: "center", marginTop: spacing.xs },
});
