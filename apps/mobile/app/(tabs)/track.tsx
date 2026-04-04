import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, Alert, Platform, KeyboardAvoidingView, AppState,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius, TOUCH_MIN, fonts, shadows } from "../../src/theme";
import { Panel } from "../../src/components/ui/Panel";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { PageHeader } from "../../src/components/ui/PageHeader";
import { HUDBackground } from "../../src/components/ui/AnimatedBackground";
import { HabitGrid } from "../../src/components/ui/HabitGrid";
import { ProgressRing } from "../../src/components/ui/ProgressRing";
import { getTodayKey, formatDateShort, getDayOfWeek } from "../../src/lib/date";
import { useHabitStore } from "../../src/stores/useHabitStore";
import { useJournalStore } from "../../src/stores/useJournalStore";
import { useGoalStore } from "../../src/stores/useGoalStore";
import { useProfileStore, XP_REWARDS } from "../../src/stores/useProfileStore";
import { useIdentityStore, selectIdentityMeta } from "../../src/stores/useIdentityStore";
import { getSuggestedHabits, type SuggestedHabit } from "../../src/lib/mission-suggester";
import { HabitChain } from "../../src/components/v2/habits/HabitChain";
import type { Habit, Goal } from "../../src/db/schema";
import { getJSON } from "../../src/db/storage";

const MONO_FONT = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

// Stable empty array — prevents Zustand getSnapshot infinite loop when key is missing
const EMPTY_IDS: number[] = [];

type Tab = "habits" | "journal" | "goals";

export default function TrackScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("habits");
  const [appActive, setAppActive] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") setAppActive((c) => c + 1);
    });
    return () => sub.remove();
  }, []);
  const dateKey = useMemo(() => getTodayKey(), [appActive]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <HUDBackground />
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.screenTitle}>TRACK</Text>
          <View style={{ width: 34 }} />
        </View>
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
      {tab === "goals" && <GoalsTab dateKey={dateKey} />}
    </SafeAreaView>
  );
}

// ─── Habits Tab ────────────────────────────────────────────────────────────

function HabitsTab({ dateKey }: { dateKey: string }) {
  const habits = useHabitStore((s) => s.habits);
  const completedIds = useHabitStore((s) => s.completedIds[dateKey] ?? EMPTY_IDS);
  const load = useHabitStore((s) => s.load);
  const toggle = useHabitStore((s) => s.toggleHabit);
  const add = useHabitStore((s) => s.addHabit);
  const remove = useHabitStore((s) => s.deleteHabit);
  const awardXP = useProfileStore((s) => s.awardXP);

  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => { load(dateKey); }, [dateKey]);

  const completedSet = useMemo(() => new Set(completedIds), [completedIds]);

  // Compute streaks per habit
  const habitStreaks = useMemo(() => {
    const streaks: Record<number, number> = {};
    for (const h of habits) {
      let streak = 0;
      for (let i = 0; i < 90; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const logs = getJSON<number[]>(`habit_logs:${dk}`, []);
        if (logs.includes(h.id!)) {
          streak++;
        } else if (i > 0) {
          break;
        }
      }
      streaks[h.id!] = streak;
    }
    return streaks;
  }, [habits, completedIds]);

  // Build 12-week grid for each habit
  const habitGrids = useMemo(() => {
    const grids: Record<number, { dateKey: string; completed: boolean }[]> = {};
    for (const h of habits) {
      const cells: { dateKey: string; completed: boolean }[] = [];
      for (let i = 83; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const logs = getJSON<number[]>(`habit_logs:${dk}`, []);
        cells.push({ dateKey: dk, completed: logs.includes(h.id!) });
      }
      grids[h.id!] = cells;
    }
    return grids;
  }, [habits, completedIds]);

  // Quick stats
  const todayCount = completedSet.size;
  const totalHabits = habits.length;
  const bestStreak = useMemo(() => Math.max(0, ...Object.values(habitStreaks)), [habitStreaks]);

  const handleToggle = (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const completed = toggle(id, dateKey);
    if (completed) {
      awardXP(dateKey, "habit_complete", XP_REWARDS.HABIT_COMPLETE);
    } else {
      awardXP(dateKey, "habit_uncomplete", -XP_REWARDS.HABIT_COMPLETE);
    }
  };

  // Identity for suggested habits
  const archetype = useIdentityStore((s) => s.archetype);
  const identityMeta = selectIdentityMeta(archetype);
  const suggestions = useMemo(
    () => archetype ? getSuggestedHabits(archetype) : [],
    [archetype],
  );
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());

  const handleAddSuggested = (s: SuggestedHabit) => {
    add(s.title, s.icon, s.engine, s.trigger, s.duration, s.frequency);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDismissSuggested = (title: string) => {
    setDismissedSuggestions((prev) => new Set([...prev, title]));
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
      {/* Quick stats */}
      <View style={styles.statsRow}>
        <Panel style={styles.statCard}>
          <Text style={styles.statValue}>{todayCount}/{totalHabits}</Text>
          <Text style={styles.statLabel}>TODAY</Text>
        </Panel>
        <Panel style={styles.statCard}>
          <Text style={styles.statValue}>{totalHabits > 0 ? Math.round((todayCount / totalHabits) * 100) : 0}%</Text>
          <Text style={styles.statLabel}>RATE</Text>
        </Panel>
        <Panel style={styles.statCard}>
          <Text style={styles.statValue}>{bestStreak}</Text>
          <Text style={styles.statLabel}>BEST STREAK</Text>
        </Panel>
      </View>

      {/* Habit cards */}
      {habits.map((h) => {
        const done = completedSet.has(h.id!);
        const streak = habitStreaks[h.id!] ?? 0;
        return (
          <Panel key={h.id} style={styles.habitCard}>
            <Pressable
              onPress={() => handleToggle(h.id!)}
              onLongPress={() => handleDelete(h.id!)}
              style={styles.habitHeader}
            >
              <View style={[styles.habitCheck, done && styles.habitCheckDone]}>
                {done && <Text style={styles.habitCheckmark}>✓</Text>}
              </View>
              <View style={styles.habitInfo}>
                <Text style={[styles.habitTitle, done && styles.habitTitleDone]}>
                  {h.icon} {h.title}
                </Text>
                {h.trigger ? (
                  <Text style={styles.habitTrigger}>{h.trigger} → {h.title}</Text>
                ) : (
                  <View style={styles.habitMeta}>
                    <Text style={styles.habitEngine}>{h.engine.toUpperCase()}</Text>
                    {streak > 0 && <Text style={styles.habitStreak}>🔥 {streak}</Text>}
                  </View>
                )}
              </View>
            </Pressable>
            {/* 14-day chain */}
            <View style={styles.habitChainWrap}>
              <HabitChain
                habitId={h.id!}
                engineColor={
                  h.engine === "body" ? colors.body :
                  h.engine === "mind" ? colors.mind :
                  h.engine === "money" ? colors.money :
                  h.engine === "charisma" ? colors.charisma :
                  colors.success
                }
              />
            </View>
            {/* 12-week grid */}
            <View style={styles.habitGridWrap}>
              <HabitGrid logs={habitGrids[h.id!] ?? []} weeks={12} />
            </View>
          </Panel>
        );
      })}

      {/* Suggested habits (show if any suggestions remain unadded/undismissed) */}
      {suggestions.length > 0 && identityMeta && suggestions.some(
        (s) => !dismissedSuggestions.has(s.title) && !habits.some((h) => h.title === s.title)
      ) && (
        <Panel style={styles.suggestedCard}>
          <Text style={styles.suggestedTitle}>
            Suggested habits for {identityMeta.name}
          </Text>
          {suggestions
            .filter((s) => !dismissedSuggestions.has(s.title) && !habits.some((h) => h.title === s.title))
            .map((s) => (
              <View key={s.title} style={styles.suggestedRow}>
                <Text style={styles.suggestedIcon}>{s.icon}</Text>
                <View style={styles.suggestedInfo}>
                  <Text style={styles.suggestedName}>{s.title}</Text>
                  <Text style={styles.suggestedTrigger}>{s.trigger} · {s.duration}</Text>
                </View>
                <Pressable onPress={() => handleAddSuggested(s)} hitSlop={8} style={styles.suggestedBtn}>
                  <Text style={styles.suggestedBtnText}>Add</Text>
                </Pressable>
                <Pressable onPress={() => handleDismissSuggested(s.title)} hitSlop={8}>
                  <Ionicons name="close" size={16} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
        </Panel>
      )}

      {/* Add habit */}
      {showAdd ? (
        <View style={styles.addRow}>
          <TextInput
            value={newTitle} onChangeText={setNewTitle} placeholder="Habit name..."
            placeholderTextColor={colors.textMuted} style={styles.addInput}
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

function JournalEntryCard({
  dateKey,
  entry,
  isToday,
  onPress,
}: {
  dateKey: string;
  entry: { content: string; updated_at: number };
  isToday: boolean;
  onPress: () => void;
}) {
  const preview = entry.content.length > 120
    ? entry.content.slice(0, 120).trimEnd() + "..."
    : entry.content;
  const wordCount = entry.content.trim().split(/\s+/).filter(Boolean).length;
  const dayLabel = getDayOfWeek(dateKey);
  const dateLabel = formatDateShort(dateKey);

  return (
    <Panel
      onPress={onPress}
      style={jStyles.entryCard}
    >
      <View style={jStyles.entryHeader}>
        <View style={jStyles.entryDateCol}>
          <Text style={[jStyles.entryDay, isToday && { color: colors.body }]}>
            {isToday ? "Today" : dayLabel}
          </Text>
          <Text style={jStyles.entryDate}>{dateLabel}</Text>
        </View>
        <View style={jStyles.entryMeta}>
          <Text style={jStyles.entryWordCount}>{wordCount} words</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
        </View>
      </View>
      <Text style={jStyles.entryPreview} numberOfLines={3}>
        {preview}
      </Text>
    </Panel>
  );
}

type JournalView = "list" | "write";

function JournalTab({ dateKey }: { dateKey: string }) {
  const entries = useJournalStore((s) => s.entries);
  const recentKeys = useJournalStore((s) => s.recentKeys);
  const loadEntry = useJournalStore((s) => s.loadEntry);
  const loadRecentEntries = useJournalStore((s) => s.loadRecentEntries);
  const saveEntry = useJournalStore((s) => s.saveEntry);
  const deleteEntry = useJournalStore((s) => s.deleteEntry);
  const awardXP = useProfileStore((s) => s.awardXP);

  const [view, setView] = useState<JournalView>("list");
  const [editingKey, setEditingKey] = useState(dateKey); // which date we're editing
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(false);

  // Load all recent entries on mount
  useEffect(() => {
    loadRecentEntries(90);
    loadEntry(dateKey);
  }, [dateKey, loadRecentEntries, loadEntry]);

  // When switching to write view, populate content
  useEffect(() => {
    if (view === "write") {
      const existing = entries[editingKey];
      setContent(existing?.content ?? "");
      setSaved(false);
    }
  }, [view, editingKey, entries]);

  const todayEntry = entries[dateKey] ?? null;
  const hasEntryToday = todayEntry && todayEntry.content && todayEntry.content.trim().length > 0;

  const handleSave = useCallback(() => {
    if (!content.trim()) return;
    saveEntry(editingKey, content);
    // Only award XP for new entries (not edits of existing ones)
    const wasNew = !entries[editingKey] || !entries[editingKey]?.content?.trim();
    if (wasNew) {
      awardXP(editingKey, "journal_entry", XP_REWARDS.JOURNAL_ENTRY);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [content, editingKey, entries, saveEntry, awardXP]);

  const handleDelete = useCallback((dk: string) => {
    Alert.alert("Delete Entry", "Remove this journal entry?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteEntry(dk);
          if (view === "write" && editingKey === dk) {
            setView("list");
          }
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },
      },
    ]);
  }, [deleteEntry, view, editingKey]);

  const openEntry = useCallback((dk: string) => {
    setEditingKey(dk);
    setView("write");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const openNewToday = useCallback(() => {
    setEditingKey(dateKey);
    setView("write");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [dateKey]);

  // ─── Write View ──────────────────────────────────────────────────────
  if (view === "write") {
    const isToday = editingKey === dateKey;
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
          {/* Back button + date */}
          <View style={jStyles.writeHeader}>
            <Pressable
              onPress={() => setView("list")}
              style={jStyles.writeBackBtn}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
              <Text style={jStyles.writeBackText}>Entries</Text>
            </Pressable>
            <Text style={jStyles.writeDateLabel}>
              {isToday ? "Today" : `${getDayOfWeek(editingKey)} ${formatDateShort(editingKey)}`}
            </Text>
            {!isToday && (
              <Pressable
                onPress={() => handleDelete(editingKey)}
                style={jStyles.writeDeleteBtn}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            )}
          </View>

          <Panel>
            <TextInput
              value={content}
              onChangeText={(text) => { setContent(text); setSaved(false); }}
              placeholder={isToday ? "How was your day? What's on your mind..." : "Edit this entry..."}
              placeholderTextColor={colors.textMuted}
              style={jStyles.writeInput}
              multiline
              textAlignVertical="top"
              autoFocus={!hasEntryToday && isToday}
            />
          </Panel>

          {/* Word count + save */}
          <View style={jStyles.writeFooter}>
            <Text style={jStyles.wordCount}>
              {content.trim().split(/\s+/).filter(Boolean).length} words
            </Text>
            <Pressable
              onPress={handleSave}
              style={[jStyles.writeSaveBtn, !content.trim() && { opacity: 0.4 }]}
              disabled={!content.trim()}
            >
              <Ionicons
                name={saved ? "checkmark-circle" : "save-outline"}
                size={16}
                color={saved ? colors.body : "#000"}
              />
              <Text style={jStyles.writeSaveBtnText}>
                {saved ? "Saved" : "Save"}
              </Text>
            </Pressable>
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─── List View ────────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Write today prompt */}
      {!hasEntryToday ? (
        <Panel onPress={openNewToday} style={jStyles.todayPrompt}>
          <View style={jStyles.todayPromptRow}>
            <View style={jStyles.todayPromptIconWrap}>
              <Ionicons name="create-outline" size={24} color={colors.mind} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={jStyles.todayPromptTitle}>Write today's entry</Text>
              <Text style={jStyles.todayPromptSub}>
                Capture your thoughts, wins, and reflections
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        </Panel>
      ) : (
        <>
          <SectionHeader title="Today" />
          <JournalEntryCard
            dateKey={dateKey}
            entry={todayEntry!}
            isToday
            onPress={() => openEntry(dateKey)}
          />
        </>
      )}

      {/* Past entries */}
      <SectionHeader
        title="Past Entries"
        right={`${recentKeys.filter((k) => k !== dateKey).length} entries`}
      />

      {recentKeys.filter((k) => k !== dateKey).length === 0 ? (
        <View style={jStyles.emptyState}>
          <Ionicons name="book-outline" size={32} color={colors.textMuted} />
          <Text style={jStyles.emptyText}>No past entries yet</Text>
          <Text style={jStyles.emptySub}>
            Your journal history will appear here
          </Text>
        </View>
      ) : (
        recentKeys
          .filter((k) => k !== dateKey)
          .map((dk, i) => {
            const entry = entries[dk];
            if (!entry) return null;
            return (
              <JournalEntryCard
                key={dk}
                dateKey={dk}
                entry={entry}
                isToday={false}
                onPress={() => openEntry(dk)}
              />
            );
          })
      )}

      {/* New entry button (for past dates — future feature, currently always writes to today) */}
      <Pressable onPress={openNewToday} style={jStyles.newEntryBtn}>
        <Ionicons name="add" size={18} color={colors.mind} />
        <Text style={jStyles.newEntryBtnText}>New Entry</Text>
      </Pressable>

      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

// ─── Goals Tab ─────────────────────────────────────────────────────────────

function GoalsTab({ dateKey }: { dateKey: string }) {
  const goals = useGoalStore((s) => s.goals);
  const goalTasks = useGoalStore((s) => s.goalTasks);
  const load = useGoalStore((s) => s.load);
  const loadGoalTasks = useGoalStore((s) => s.loadGoalTasks);
  const addGoal = useGoalStore((s) => s.addGoal);
  const deleteGoal = useGoalStore((s) => s.deleteGoal);
  const addGoalTask = useGoalStore((s) => s.addGoalTask);
  const toggleGoalTask = useGoalStore((s) => s.toggleGoalTask);

  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [addingTaskFor, setAddingTaskFor] = useState<number | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    for (const g of goals) {
      loadGoalTasks(g.id!);
    }
  }, [goals]);

  const handleAddGoal = () => {
    if (!newTitle.trim()) return;
    addGoal({
      title: newTitle.trim(),
      engine: "charisma",
      type: "count",
      target: 1,
      unit: "tasks",
      deadline: newDeadline || (() => { const dd = new Date(Date.now() + 30 * 86400000); return `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}-${String(dd.getDate()).padStart(2, "0")}`; })(),
    });
    setNewTitle("");
    setNewDeadline("");
    setShowAdd(false);
  };

  const handleAddTask = (goalId: number) => {
    if (!newTaskTitle.trim()) return;
    addGoalTask(goalId, newTaskTitle.trim());
    setNewTaskTitle("");
    setAddingTaskFor(null);
  };

  const handleDeleteGoal = (id: number) => {
    Alert.alert("Delete Goal", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteGoal(id) },
    ]);
  };

  const getDaysRemaining = (deadline: string) => {
    const diff = new Date(deadline).getTime() - Date.now();
    const days = Math.ceil(diff / 86400000);
    if (days < 0) return "Expired";
    if (days === 0) return "Today";
    return `${days}d left`;
  };

  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <SectionHeader title="ACTIVE GOALS" right={`${goals.length}`} />

      {goals.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎯</Text>
          <Text style={styles.emptyText}>No goals yet</Text>
          <Text style={styles.emptyHint}>Set your first goal to start tracking</Text>
        </View>
      ) : (
        goals.map((g) => {
          const tasks = goalTasks[g.id!] ?? [];
          const completedCount = tasks.filter((t) => t.completed === 1).length;
          const progress = tasks.length > 0 ? completedCount / tasks.length : 0;
          const daysLeft = getDaysRemaining(g.deadline);

          return (
            <Panel key={g.id} style={styles.goalCard}>
              <View style={styles.goalHeader}>
                <ProgressRing
                  progress={progress}
                  label={tasks.length > 0 ? `${completedCount}/${tasks.length}` : "0"}
                  size={56}
                  strokeWidth={4}
                />
                <View style={styles.goalInfo}>
                  <Text style={styles.goalTitle}>{g.title}</Text>
                  <View style={styles.goalMeta}>
                    <Text style={styles.goalEngine}>{g.engine.toUpperCase()}</Text>
                    <Text style={[
                      styles.goalDeadline,
                      daysLeft === "Expired" && { color: colors.danger },
                    ]}>
                      {daysLeft}
                    </Text>
                  </View>
                </View>
                <Pressable onPress={() => handleDeleteGoal(g.id!)} hitSlop={12}>
                  <Text style={styles.deleteBtn}>×</Text>
                </Pressable>
              </View>

              {/* Sub-tasks */}
              {tasks.length > 0 && (
                <View style={styles.goalTasks}>
                  {tasks.map((t) => (
                    <Pressable
                      key={t.id}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        toggleGoalTask(t.id!, g.id!);
                      }}
                      style={styles.goalTaskRow}
                    >
                      <View style={[styles.goalTaskCheck, t.completed === 1 && styles.goalTaskCheckDone]}>
                        {t.completed === 1 && <Text style={styles.goalTaskCheckmark}>✓</Text>}
                      </View>
                      <Text style={[styles.goalTaskTitle, t.completed === 1 && styles.goalTaskTitleDone]}>
                        {t.title}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Add task inline */}
              {addingTaskFor === g.id ? (
                <View style={styles.addRow}>
                  <TextInput
                    value={newTaskTitle} onChangeText={setNewTaskTitle}
                    placeholder="Task name..." placeholderTextColor={colors.textMuted}
                    style={styles.addInput} autoFocus
                    onSubmitEditing={() => handleAddTask(g.id!)}
                  />
                  <Pressable onPress={() => handleAddTask(g.id!)} style={styles.addBtn}>
                    <Text style={styles.addBtnText}>Add</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={() => setAddingTaskFor(g.id!)} style={styles.inlineAdd}>
                  <Text style={styles.inlineAddText}>+ Add Task</Text>
                </Pressable>
              )}
            </Panel>
          );
        })
      )}

      {/* Add goal */}
      {showAdd ? (
        <Panel style={styles.addGoalPanel}>
          <Text style={styles.addGoalTitle}>New Goal</Text>
          <TextInput
            value={newTitle} onChangeText={setNewTitle}
            placeholder="Goal title..." placeholderTextColor={colors.textMuted}
            style={styles.addInput} autoFocus
          />
          <TextInput
            value={newDeadline} onChangeText={setNewDeadline}
            placeholder="Deadline (YYYY-MM-DD)" placeholderTextColor={colors.textMuted}
            style={styles.addInput}
          />
          <View style={styles.addGoalActions}>
            <Pressable onPress={() => setShowAdd(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleAddGoal} style={styles.addBtn}>
              <Text style={styles.addBtnText}>Create</Text>
            </Pressable>
          </View>
        </Panel>
      ) : (
        <Pressable onPress={() => setShowAdd(true)} style={styles.newBtn}>
          <Text style={styles.newBtnText}>+ New Goal</Text>
        </Pressable>
      )}

      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.lg, marginBottom: spacing.md },
  backButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.panelBorder },
  screenTitle: { fontSize: 18, fontWeight: "700", color: colors.text, letterSpacing: 1 },
  tabs: {
    flexDirection: "row",
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: "center" },
  tabActive: { backgroundColor: "rgba(255, 255, 255, 0.08)" },
  tabText: { ...fonts.kicker, fontSize: 11, color: colors.textMuted },
  tabTextActive: { color: colors.text },
  tabContent: { flex: 1, paddingHorizontal: spacing.lg },

  // Stats row
  statsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  statCard: { flex: 1, alignItems: "center", paddingVertical: spacing.md },
  statValue: { ...fonts.monoValue, fontSize: 20 },
  statLabel: { ...fonts.kicker, fontSize: 8, color: colors.textMuted, marginTop: 2 },

  // Habit card
  habitCard: { marginTop: spacing.md },
  habitHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  habitCheck: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: "rgba(255, 255, 255, 0.25)",
    alignItems: "center", justifyContent: "center",
  },
  habitCheckDone: { borderColor: colors.success, backgroundColor: colors.successDim },
  habitCheckmark: { fontSize: 13, fontWeight: "700", color: colors.success },
  habitInfo: { flex: 1 },
  habitTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  habitTitleDone: { color: colors.textMuted, textDecorationLine: "line-through" },
  habitMeta: { flexDirection: "row", gap: spacing.sm, marginTop: 2 },
  habitEngine: { ...fonts.kicker, fontSize: 8, color: colors.textMuted },
  habitStreak: { ...fonts.mono, fontSize: 10, color: colors.warning },
  habitTrigger: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  habitChainWrap: { marginTop: spacing.sm, paddingLeft: spacing["4xl"] },
  habitGridWrap: { marginTop: spacing.md },

  // Suggested habits
  suggestedCard: { marginTop: spacing.lg, gap: spacing.md },
  suggestedTitle: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: spacing.xs },
  suggestedRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  suggestedIcon: { fontSize: 18, width: 28, textAlign: "center" },
  suggestedInfo: { flex: 1, gap: 1 },
  suggestedName: { fontSize: 14, fontWeight: "500", color: colors.text },
  suggestedTrigger: { fontSize: 11, color: colors.textMuted },
  suggestedBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: 8, backgroundColor: colors.primaryDim },
  suggestedBtnText: { fontSize: 12, fontWeight: "600", color: colors.primary },

  // Journal (old styles removed — now using jStyles below)

  // Goals
  goalCard: { marginTop: spacing.md },
  goalHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  goalInfo: { flex: 1 },
  goalTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  goalMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs },
  goalEngine: { ...fonts.kicker, fontSize: 9, color: colors.textMuted },
  goalDeadline: { ...fonts.mono, fontSize: 11, color: colors.textSecondary },
  deleteBtn: { fontSize: 24, color: colors.textMuted, fontWeight: "300" },

  // Goal sub-tasks
  goalTasks: { marginTop: spacing.md, gap: spacing.sm },
  goalTaskRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  goalTaskCheck: {
    width: 18, height: 18, borderRadius: 4,
    borderWidth: 1.5, borderColor: "rgba(255, 255, 255, 0.20)",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center", justifyContent: "center",
  },
  goalTaskCheckDone: { borderColor: colors.success, backgroundColor: colors.success },
  goalTaskCheckmark: { fontSize: 11, fontWeight: "700", color: "#fff" },
  goalTaskTitle: { fontSize: 14, color: colors.text },
  goalTaskTitleDone: { color: colors.textMuted, textDecorationLine: "line-through" },

  // Shared form elements
  addRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  addInput: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.panelBorder,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: colors.text, fontSize: 14,
  },
  addBtn: { backgroundColor: colors.text, borderRadius: radius.md, paddingHorizontal: spacing.lg, justifyContent: "center" },
  addBtnText: { color: "#000", fontWeight: "700", fontSize: 13 },
  newBtn: {
    alignItems: "center", paddingVertical: spacing.md, marginTop: spacing.md,
    backgroundColor: "rgba(255, 255, 255, 0.04)", borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.panelBorder,
  },
  newBtnText: { color: colors.textSecondary, fontWeight: "600", fontSize: 14 },
  inlineAdd: { paddingVertical: spacing.sm, alignItems: "center", marginTop: spacing.sm },
  inlineAddText: { fontSize: 13, color: colors.textSecondary, fontWeight: "600" },

  // Add goal form
  addGoalPanel: { marginTop: spacing.md, gap: spacing.md },
  addGoalTitle: { ...fonts.kicker, color: colors.textSecondary },
  addGoalActions: { flexDirection: "row", gap: spacing.sm },
  cancelBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: "center", borderWidth: 1, borderColor: colors.panelBorder },
  cancelBtnText: { color: colors.textSecondary, fontWeight: "600", fontSize: 13 },

  // Empty state
  emptyState: { alignItems: "center", paddingVertical: spacing["4xl"] },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { fontSize: 18, fontWeight: "600", color: colors.text },
  emptyHint: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs },
});

// ─── Journal Styles ──────────────────────────────────────────────────────────

const jStyles = StyleSheet.create({
  // Entry card (list view)
  entryCard: { marginBottom: spacing.sm },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  entryDateCol: {},
  entryDay: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  entryDate: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  entryMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  entryWordCount: {
    fontFamily: MONO_FONT,
    fontSize: 11,
    color: colors.textMuted,
  },
  entryPreview: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  // Today prompt
  todayPrompt: { marginBottom: spacing.md },
  todayPromptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  todayPromptIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.mindDim,
    alignItems: "center",
    justifyContent: "center",
  },
  todayPromptTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  todayPromptSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Write view
  writeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
  },
  writeBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
  },
  writeBackText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  writeDateLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
  },
  writeDeleteBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  writeInput: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 26,
    minHeight: 280,
  },
  writeFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
  },
  wordCount: {
    fontFamily: MONO_FONT,
    fontSize: 12,
    color: colors.textMuted,
  },
  writeSaveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.text,
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  writeSaveBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
  },

  // New entry button
  newEntryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.mind,
    borderStyle: "dashed",
  },
  newEntryBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.mind,
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing["3xl"],
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
