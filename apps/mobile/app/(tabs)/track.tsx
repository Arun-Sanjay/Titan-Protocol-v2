import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius, TOUCH_MIN } from "../../src/theme";
import { Card } from "../../src/components/ui/Card";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { getTodayKey } from "../../src/lib/date";
import { useHabitStore } from "../../src/stores/useHabitStore";
import { useJournalStore } from "../../src/stores/useJournalStore";
import { useGoalStore } from "../../src/stores/useGoalStore";
import { useProfileStore, XP_REWARDS } from "../../src/stores/useProfileStore";

type Tab = "habits" | "journal" | "goals";

export default function TrackScreen() {
  const [tab, setTab] = useState<Tab>("habits");
  const dateKey = getTodayKey();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Track</Text>
        <View style={styles.tabs}>
          {(["habits", "journal", "goals"] as Tab[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => { Haptics.selectionAsync(); setTab(t); }}
              style={[styles.tab, tab === t && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {tab === "habits" && <HabitsTab dateKey={dateKey} />}
      {tab === "journal" && <JournalTab dateKey={dateKey} />}
      {tab === "goals" && <GoalsTab />}
    </SafeAreaView>
  );
}

// ─── Habits Tab ────────────────────────────────────────────────────────────

function HabitsTab({ dateKey }: { dateKey: string }) {
  const habits = useHabitStore((s) => s.habits);
  const completedIds = useHabitStore((s) => s.completedIds[dateKey] ?? []);
  const load = useHabitStore((s) => s.load);
  const toggle = useHabitStore((s) => s.toggleHabit);
  const add = useHabitStore((s) => s.addHabit);
  const remove = useHabitStore((s) => s.deleteHabit);
  const awardXP = useProfileStore((s) => s.awardXP);

  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => { load(dateKey); }, [dateKey]);

  const completedSet = React.useMemo(() => new Set(completedIds), [completedIds]);

  const handleToggle = (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const completed = toggle(id, dateKey);
    if (completed) awardXP(dateKey, "habit_complete", XP_REWARDS.HABIT_COMPLETE);
  };

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    add(newTitle.trim(), "✓");
    setNewTitle("");
    setShowAdd(false);
  };

  const handleDelete = (id: number) => {
    Alert.alert("Delete Habit", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => remove(id) },
    ]);
  };

  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <SectionHeader title="Daily Habits" right={`${completedSet.size}/${habits.length}`} />

      {habits.map((h) => {
        const done = completedSet.has(h.id!);
        return (
          <Pressable
            key={h.id}
            onPress={() => handleToggle(h.id!)}
            onLongPress={() => handleDelete(h.id!)}
            style={[styles.habitRow, done && styles.habitRowDone]}
          >
            <View style={[styles.habitCheck, done && styles.habitCheckDone]}>
              {done && <Text style={styles.habitCheckmark}>✓</Text>}
            </View>
            <Text style={[styles.habitTitle, done && styles.habitTitleDone]}>{h.title}</Text>
            <Text style={styles.habitIcon}>{h.icon}</Text>
          </Pressable>
        );
      })}

      {showAdd ? (
        <View style={styles.addRow}>
          <TextInput
            value={newTitle} onChangeText={setNewTitle} placeholder="Habit name..."
            placeholderTextColor={colors.textSecondary} style={styles.addInput}
            autoFocus onSubmitEditing={handleAdd}
          />
          <Pressable onPress={handleAdd} style={styles.addBtn}>
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => setShowAdd(true)} style={styles.newBtn}>
          <Text style={styles.newBtnText}>+ New Habit</Text>
        </Pressable>
      )}

      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

// ─── Journal Tab ───────────────────────────────────────────────────────────

function JournalTab({ dateKey }: { dateKey: string }) {
  const entry = useJournalStore((s) => s.entries[dateKey]);
  const loadEntry = useJournalStore((s) => s.loadEntry);
  const saveEntry = useJournalStore((s) => s.saveEntry);
  const awardXP = useProfileStore((s) => s.awardXP);

  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadEntry(dateKey);
  }, [dateKey]);

  useEffect(() => {
    setContent(entry?.content ?? "");
  }, [entry]);

  const handleSave = () => {
    saveEntry(dateKey, content);
    awardXP(dateKey, "journal_entry", XP_REWARDS.JOURNAL_ENTRY);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <SectionHeader title="Today's Journal" />
      <Card>
        <TextInput
          value={content} onChangeText={setContent} placeholder="Write your thoughts..."
          placeholderTextColor={colors.textSecondary} style={styles.journalInput}
          multiline textAlignVertical="top"
        />
      </Card>
      <Pressable onPress={handleSave} style={styles.saveBtn}>
        <Text style={styles.saveBtnText}>{saved ? "✓ Saved" : "Save Entry"}</Text>
      </Pressable>
      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

// ─── Goals Tab ─────────────────────────────────────────────────────────────

function GoalsTab() {
  const goals = useGoalStore((s) => s.goals);
  const load = useGoalStore((s) => s.load);

  useEffect(() => { load(); }, []);

  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <SectionHeader title="Active Goals" right={`${goals.length}`} />
      {goals.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎯</Text>
          <Text style={styles.emptyText}>No goals yet</Text>
          <Text style={styles.emptyHint}>Set your first goal to start tracking</Text>
        </View>
      ) : (
        goals.map((g) => (
          <Card key={g.id} style={styles.goalCard}>
            <Text style={styles.goalTitle}>{g.title}</Text>
            <View style={styles.goalMeta}>
              <Text style={styles.goalEngine}>{g.engine.toUpperCase()}</Text>
              <Text style={styles.goalDeadline}>{g.deadline}</Text>
            </View>
          </Card>
        ))
      )}
      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg },
  title: { fontSize: 28, fontWeight: "800", color: colors.text, marginTop: spacing.lg },
  tabs: { flexDirection: "row", marginTop: spacing.lg, gap: spacing.xs, backgroundColor: colors.surface, borderRadius: radius.md, padding: 4 },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: "center" },
  tabActive: { backgroundColor: colors.primaryDim },
  tabText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  tabTextActive: { color: colors.primary },
  tabContent: { flex: 1, paddingHorizontal: spacing.lg },
  habitRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.surfaceBorder, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: TOUCH_MIN, marginBottom: spacing.sm, gap: spacing.md },
  habitRowDone: { borderColor: colors.success + "30" },
  habitCheck: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.textSecondary, alignItems: "center", justifyContent: "center" },
  habitCheckDone: { borderColor: colors.success, backgroundColor: colors.successDim },
  habitCheckmark: { fontSize: 14, fontWeight: "700", color: colors.success },
  habitTitle: { flex: 1, fontSize: 16, fontWeight: "500", color: colors.text },
  habitTitleDone: { color: colors.textSecondary, textDecorationLine: "line-through" },
  habitIcon: { fontSize: 18 },
  addRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  addInput: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.surfaceBorder, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.text, fontSize: 16 },
  addBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.lg, justifyContent: "center" },
  addBtnText: { color: "#000", fontWeight: "700", fontSize: 14 },
  newBtn: { alignItems: "center", paddingVertical: spacing.md, marginTop: spacing.sm, backgroundColor: colors.primaryDim, borderRadius: radius.md },
  newBtnText: { color: colors.primary, fontWeight: "600", fontSize: 15 },
  journalInput: { color: colors.text, fontSize: 16, lineHeight: 26, minHeight: 200 },
  saveBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.lg },
  saveBtnText: { color: "#000", fontWeight: "700", fontSize: 16 },
  goalCard: { marginBottom: spacing.sm },
  goalTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  goalMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm },
  goalEngine: { fontSize: 11, fontWeight: "700", color: colors.primary, letterSpacing: 1 },
  goalDeadline: { fontSize: 12, color: colors.textSecondary },
  emptyState: { alignItems: "center", paddingVertical: spacing["4xl"] },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { fontSize: 18, fontWeight: "600", color: colors.text },
  emptyHint: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs },
});
