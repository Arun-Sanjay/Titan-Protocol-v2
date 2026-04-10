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
import { getTodayKey, formatDateShort, getDayOfWeek } from "../../src/lib/date";
// Phase 3.5d: Habits (reads + writes) go through cloud hooks. The
// journal tab keeps its local store (no cloud service yet) but its
// XP award path moves to the cloud awardXP mutation.
import {
  useHabits,
  useHabitLogsForDate,
  useHabitLogsForRange,
  useToggleHabit,
  useCreateHabit,
  useDeleteHabit,
} from "../../src/hooks/queries/useHabits";
import type { Habit as CloudHabit } from "../../src/services/habits";
import { useAwardXP } from "../../src/hooks/queries/useProfile";
import { useEnqueueRankUp } from "../../src/hooks/queries/useRankUps";
// Phase 3.5e: Journal and Goals tabs now use cloud hooks.
import {
  useJournalEntries,
  useJournalEntry,
  useUpsertJournalEntry,
  useDeleteJournalEntry,
} from "../../src/hooks/queries/useJournal";
import type { JournalEntry } from "../../src/services/journal";
import {
  useGoals,
  useCreateGoal,
  useDeleteGoal as useDeleteGoalMutation,
} from "../../src/hooks/queries/useGoals";
import type { Goal as CloudGoal } from "../../src/services/goals";
// XP_REWARDS is a pure const export.
import { XP_REWARDS } from "../../src/stores/useProfileStore";
import { useIdentityStore, selectIdentityMeta } from "../../src/stores/useIdentityStore";
import { getSuggestedHabits, type SuggestedHabit } from "../../src/lib/mission-suggester";
import { addDays } from "../../src/lib/date";
import { getJSON, setJSON } from "../../src/db/storage";

const MONO_FONT = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

// Grid window: 84 days (12 weeks) back through today.
const GRID_DAYS = 84;

type Tab = "habits" | "journal" | "goals";

// Phase 2.3B (partial): persist the active sub-tab to MMKV so navigating
// away from Track and back restores the user's last selection. The full
// expo-router route split (track/habits.tsx, track/journal.tsx,
// track/goals.tsx) is deferred to Phase 2.4 because the existing 1000-line
// file shares state across tabs and would need a meaningful refactor.
const TRACK_TAB_KEY = "track_active_tab";

const VALID_TABS: Tab[] = ["habits", "journal", "goals"];
function loadInitialTab(): Tab {
  const stored = getJSON<string>(TRACK_TAB_KEY, "habits");
  return (VALID_TABS as string[]).includes(stored) ? (stored as Tab) : "habits";
}

export default function TrackScreen() {
  const router = useRouter();
  const [tab, setTabState] = useState<Tab>(() => loadInitialTab());
  const setTab = useCallback((next: Tab) => {
    setTabState(next);
    setJSON(TRACK_TAB_KEY, next);
  }, []);
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
  // Phase 3.5d: cloud-backed habits. Reads (habits list + today's logs
  // + 84-day log range) and writes (toggle / create / delete) all go
  // through React Query. current_chain on the habit row is the
  // denormalized streak length — no more O(n²) MMKV scans (Phase 2.3F).
  const { data: habits = [] } = useHabits();
  const { data: todayLogs = [] } = useHabitLogsForDate(dateKey);
  const gridStart = useMemo(() => addDays(dateKey, -(GRID_DAYS - 1)), [dateKey]);
  const { data: rangeLogs = [] } = useHabitLogsForRange(gridStart, dateKey);

  const toggleHabitMutation = useToggleHabit();
  const createHabitMutation = useCreateHabit();
  const deleteHabitMutation = useDeleteHabit();
  const awardXPMutation = useAwardXP();
  const enqueueRankUpMutation = useEnqueueRankUp();

  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const completedSet = useMemo(
    () => new Set(todayLogs.map((l) => l.habit_id)),
    [todayLogs],
  );

  // Streaks come directly from the denormalized habit.current_chain.
  const habitStreaks = useMemo(() => {
    const streaks: Record<string, number> = {};
    for (const h of habits) {
      streaks[h.id] = h.current_chain;
    }
    return streaks;
  }, [habits]);

  // Build 12-week grid for each habit from the range-log query.
  const habitGrids = useMemo(() => {
    // Build the list of dateKeys for the window (oldest → newest).
    const dateKeys: string[] = [];
    for (let i = GRID_DAYS - 1; i >= 0; i--) {
      dateKeys.push(addDays(dateKey, -i));
    }
    // Group logs by (habit_id, date_key) for O(1) lookups.
    const logSet = new Set(rangeLogs.map((l) => `${l.habit_id}|${l.date_key}`));
    const grids: Record<string, { dateKey: string; completed: boolean }[]> = {};
    for (const h of habits) {
      grids[h.id] = dateKeys.map((dk) => ({
        dateKey: dk,
        completed: logSet.has(`${h.id}|${dk}`),
      }));
    }
    return grids;
  }, [habits, rangeLogs, dateKey]);

  // Quick stats
  const todayCount = completedSet.size;
  const totalHabits = habits.length;
  const bestStreak = useMemo(
    () => habits.reduce((acc, h) => Math.max(acc, h.best_chain), 0),
    [habits],
  );

  const handleToggle = useCallback(
    async (habit: CloudHabit) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        const result = await toggleHabitMutation.mutateAsync({
          habit,
          dateKey,
        });
        const xp = result.completed
          ? XP_REWARDS.HABIT_COMPLETE
          : -XP_REWARDS.HABIT_COMPLETE;
        const xpResult = await awardXPMutation.mutateAsync(xp);
        if (xpResult.leveledUp) {
          await enqueueRankUpMutation.mutateAsync({
            fromLevel: xpResult.fromLevel,
            toLevel: xpResult.toLevel,
          });
        }
      } catch (_e) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [dateKey, toggleHabitMutation, awardXPMutation, enqueueRankUpMutation],
  );

  // Identity for suggested habits
  const archetype = useIdentityStore((s) => s.archetype);
  const identityMeta = selectIdentityMeta(archetype);
  const suggestions = useMemo(
    () => (archetype ? getSuggestedHabits(archetype) : []),
    [archetype],
  );
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(
    new Set(),
  );

  const handleAddSuggested = useCallback(
    async (s: SuggestedHabit) => {
      try {
        await createHabitMutation.mutateAsync({
          title: s.title,
          icon: s.icon,
          engine: s.engine,
          triggerText: s.trigger,
          durationText: s.duration,
          frequency: s.frequency,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (_e) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [createHabitMutation],
  );

  const handleDismissSuggested = (title: string) => {
    setDismissedSuggestions((prev) => new Set([...prev, title]));
  };

  const handleAdd = useCallback(async () => {
    if (!newTitle.trim()) return;
    try {
      await createHabitMutation.mutateAsync({
        title: newTitle.trim(),
        icon: "✓",
        engine: "body",
      });
      setNewTitle("");
      setShowAdd(false);
    } catch (_e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [newTitle, createHabitMutation]);

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert("Delete Habit", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteHabitMutation.mutate(id),
        },
      ]);
    },
    [deleteHabitMutation],
  );

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
        const done = completedSet.has(h.id);
        const streak = habitStreaks[h.id] ?? 0;
        return (
          <Panel key={h.id} style={styles.habitCard}>
            <Pressable
              onPress={() => handleToggle(h)}
              onLongPress={() => handleDelete(h.id)}
              style={styles.habitHeader}
            >
              <View style={[styles.habitCheck, done && styles.habitCheckDone]}>
                {done && <Text style={styles.habitCheckmark}>✓</Text>}
              </View>
              <View style={styles.habitInfo}>
                <Text style={[styles.habitTitle, done && styles.habitTitleDone]}>
                  {h.icon} {h.title}
                </Text>
                {h.trigger_text ? (
                  <Text style={styles.habitTrigger}>{h.trigger_text} → {h.title}</Text>
                ) : (
                  <View style={styles.habitMeta}>
                    <Text style={styles.habitEngine}>{h.engine.toUpperCase()}</Text>
                    {streak > 0 && <Text style={styles.habitStreak}>🔥 {streak}</Text>}
                  </View>
                )}
              </View>
            </Pressable>
            {/* 14-day HabitChain is temporarily hidden after the cloud
                migration — HabitChain reads MMKV via useHabitStore and
                expects numeric habit IDs. Its 14-day view is a subset
                of the 12-week grid below (which reads cloud), so
                hiding it doesn't lose information. Re-enable once
                HabitChain is refactored to take logs as a prop. */}
            {/* 12-week grid */}
            <View style={styles.habitGridWrap}>
              <HabitGrid logs={habitGrids[h.id] ?? []} weeks={12} />
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
  entry: { content: string; updated_at: string };
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
  // Phase 3.5e: cloud-backed journal. All reads/writes go through
  // React Query hooks — useJournalStore is no longer imported.
  const { data: recentEntries = [] } = useJournalEntries(90);
  const { data: todayEntryCloud } = useJournalEntry(dateKey);
  const upsertMutation = useUpsertJournalEntry();
  const deleteMutation = useDeleteJournalEntry();
  const awardXPMutation = useAwardXP();
  const enqueueRankUpMutation = useEnqueueRankUp();

  // Build entries map and recentKeys from cloud data
  const entries = useMemo(() => {
    const map: Record<string, JournalEntry> = {};
    for (const e of recentEntries) {
      map[e.date_key] = e;
    }
    // Ensure todayEntry is present even if the list query hasn't refreshed
    if (todayEntryCloud) {
      map[todayEntryCloud.date_key] = todayEntryCloud;
    }
    return map;
  }, [recentEntries, todayEntryCloud]);

  const recentKeys = useMemo(
    () => Object.keys(entries).sort((a, b) => b.localeCompare(a)),
    [entries],
  );

  const [view, setView] = useState<JournalView>("list");
  const [editingKey, setEditingKey] = useState(dateKey); // which date we're editing
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(false);

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

  const handleSave = useCallback(async () => {
    if (!content.trim()) return;
    // Only award XP for new entries (not edits of existing ones)
    const wasNew = !entries[editingKey] || !entries[editingKey]?.content?.trim();
    try {
      await upsertMutation.mutateAsync({ dateKey: editingKey, content });
      if (wasNew) {
        const xpResult = await awardXPMutation.mutateAsync(XP_REWARDS.JOURNAL_ENTRY);
        if (xpResult.leveledUp) {
          await enqueueRankUpMutation.mutateAsync({
            fromLevel: xpResult.fromLevel,
            toLevel: xpResult.toLevel,
          });
        }
      }
    } catch (_e) {
      // Non-fatal; mutation hook logs the error.
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [content, editingKey, entries, upsertMutation, awardXPMutation, enqueueRankUpMutation]);

  const handleDelete = useCallback((dk: string) => {
    Alert.alert("Delete Entry", "Remove this journal entry?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteMutation.mutate(dk);
          if (view === "write" && editingKey === dk) {
            setView("list");
          }
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },
      },
    ]);
  }, [deleteMutation, view, editingKey]);

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
  // Phase 3.5e: cloud-backed goals. Sub-tasks are not in the cloud
  // schema — the simplified model stores title + optional target_date.
  const { data: goals = [] } = useGoals();
  const createGoalMutation = useCreateGoal();
  const deleteGoalMutation = useDeleteGoalMutation();

  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDeadline, setNewDeadline] = useState("");

  const handleAddGoal = useCallback(async () => {
    if (!newTitle.trim()) return;
    try {
      await createGoalMutation.mutateAsync({
        title: newTitle.trim(),
        targetDate: newDeadline || undefined,
      });
      setNewTitle("");
      setNewDeadline("");
      setShowAdd(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (_e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [newTitle, newDeadline, createGoalMutation]);

  const handleDeleteGoal = useCallback((id: string) => {
    Alert.alert("Delete Goal", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteGoalMutation.mutate(id) },
    ]);
  }, [deleteGoalMutation]);

  const getDaysRemaining = (targetDate: string | null) => {
    if (!targetDate) return null;
    const diff = new Date(targetDate).getTime() - Date.now();
    const days = Math.ceil(diff / 86400000);
    if (days < 0) return "Expired";
    if (days === 0) return "Today";
    return `${days}d left`;
  };

  const activeGoals = useMemo(
    () => goals.filter((g) => g.status === "active"),
    [goals],
  );

  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <SectionHeader title="ACTIVE GOALS" right={`${activeGoals.length}`} />

      {activeGoals.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎯</Text>
          <Text style={styles.emptyText}>No goals yet</Text>
          <Text style={styles.emptyHint}>Set your first goal to start tracking</Text>
        </View>
      ) : (
        activeGoals.map((g) => {
          const daysLeft = getDaysRemaining(g.target_date);

          return (
            <Panel key={g.id} style={styles.goalCard}>
              <View style={styles.goalHeader}>
                <View style={styles.goalInfo}>
                  <Text style={styles.goalTitle}>{g.title}</Text>
                  <View style={styles.goalMeta}>
                    <Text style={styles.goalEngine}>{g.status.toUpperCase()}</Text>
                    {daysLeft && (
                      <Text style={[
                        styles.goalDeadline,
                        daysLeft === "Expired" && { color: colors.danger },
                      ]}>
                        {daysLeft}
                      </Text>
                    )}
                  </View>
                </View>
                <Pressable onPress={() => handleDeleteGoal(g.id)} hitSlop={12}>
                  <Text style={styles.deleteBtn}>×</Text>
                </Pressable>
              </View>
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
