import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius, fonts } from "../../src/theme";
import { Panel } from "../../src/components/ui/Panel";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import {
  useGymStore,
  Exercise,
  Template,
  GymSession,
  GymSet,
} from "../../src/stores/useGymStore";

// ─── Helpers ────────────────────────────────────────────────────────────────

const getTodayKey = () => new Date().toISOString().slice(0, 10);

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(dateKey: string): string {
  const d = new Date(dateKey + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const MUSCLE_GROUPS = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core"];
const EQUIPMENT = ["Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight"];

// ─── Sub-components ─────────────────────────────────────────────────────────

type TemplateCardProps = {
  template: Template;
  exerciseCount: number;
  onStart: () => void;
  onDelete: () => void;
};

const TemplateCard = React.memo(function TemplateCard({
  template,
  exerciseCount,
  onStart,
  onDelete,
}: TemplateCardProps) {
  return (
    <Panel style={styles.templateCard}>
      <View style={styles.templateRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.templateName}>{template.name}</Text>
          <Text style={styles.templateMeta}>
            {exerciseCount} exercise{exerciseCount !== 1 ? "s" : ""}
          </Text>
        </View>
        <View style={styles.templateActions}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onDelete();
            }}
            style={styles.deleteBtn}
            hitSlop={8}
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onStart();
            }}
            style={styles.startSessionBtn}
          >
            <Text style={styles.startSessionBtnText}>START</Text>
          </Pressable>
        </View>
      </View>
    </Panel>
  );
});

type SetRowProps = {
  gymSet: GymSet;
  onUpdate: (weight: number, reps: number) => void;
};

const SetRow = React.memo(function SetRow({ gymSet, onUpdate }: SetRowProps) {
  const [weight, setWeight] = useState(gymSet.weight.toString());
  const [reps, setReps] = useState(gymSet.reps.toString());

  const handleWeightBlur = useCallback(() => {
    const w = parseFloat(weight) || 0;
    onUpdate(w, parseFloat(reps) || 0);
  }, [weight, reps, onUpdate]);

  const handleRepsBlur = useCallback(() => {
    const r = parseInt(reps, 10) || 0;
    onUpdate(parseFloat(weight) || 0, r);
  }, [weight, reps, onUpdate]);

  return (
    <View style={styles.setRow}>
      <Text style={styles.setNum}>{gymSet.setIndex}</Text>
      <TextInput
        style={styles.setInput}
        value={weight}
        onChangeText={setWeight}
        onBlur={handleWeightBlur}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={colors.textMuted}
        selectTextOnFocus
      />
      <TextInput
        style={styles.setInput}
        value={reps}
        onChangeText={setReps}
        onBlur={handleRepsBlur}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={colors.textMuted}
        selectTextOnFocus
      />
    </View>
  );
});

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function WorkoutsScreen() {
  const router = useRouter();
  const store = useGymStore();

  // Local UI state
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<number>>(new Set());
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickMuscle, setQuickMuscle] = useState("Chest");
  const [quickEquipment, setQuickEquipment] = useState("Barbell");
  const [showSummary, setShowSummary] = useState(false);
  const [summarySessionId, setSummarySessionId] = useState<number | null>(null);

  // Timer for active session
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    store.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Active session
  const activeSession = useMemo(
    () => store.sessions.find((s) => s.id === store.activeSessionId) ?? null,
    [store.sessions, store.activeSessionId]
  );

  // Timer effect
  useEffect(() => {
    if (activeSession) {
      const tick = () => setElapsed(Date.now() - activeSession.startedAt);
      tick();
      timerRef.current = setInterval(tick, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    } else {
      setElapsed(0);
    }
  }, [activeSession]);

  // Active session exercises
  const activeExercises = useMemo(() => {
    if (!activeSession) return [];
    return store.getTemplateExercises(activeSession.templateId);
  }, [activeSession, store.templateExercises, store.exercises]);

  // Active session sets
  const activeSets = useMemo(() => {
    if (!activeSession) return [];
    return store.getSessionSets(activeSession.id);
  }, [activeSession, store.sets]);

  // Recent completed sessions (last 5)
  const recentSessions = useMemo(
    () =>
      store.sessions
        .filter((s) => s.endedAt !== null)
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, 5),
    [store.sessions]
  );

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleCreateTemplate = useCallback(() => {
    const name = templateName.trim();
    if (!name) {
      Alert.alert("Error", "Enter a template name.");
      return;
    }
    if (selectedExerciseIds.size === 0) {
      Alert.alert("Error", "Select at least one exercise.");
      return;
    }
    store.createTemplate(name, Array.from(selectedExerciseIds));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTemplateName("");
    setSelectedExerciseIds(new Set());
    setShowCreateTemplate(false);
  }, [templateName, selectedExerciseIds, store]);

  const handleStartSession = useCallback(
    (templateId: number) => {
      store.startSession(templateId, getTodayKey());
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    },
    [store]
  );

  const handleDeleteTemplate = useCallback(
    (id: number) => {
      Alert.alert("Delete Template", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            store.deleteTemplate(id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]);
    },
    [store]
  );

  const handleAddSet = useCallback(
    (exerciseId: number) => {
      if (!activeSession) return;
      store.addSet(activeSession.id, exerciseId, 0, 0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [activeSession, store]
  );

  const handleFinishWorkout = useCallback(() => {
    if (!activeSession) return;
    store.endSession(activeSession.id);
    setSummarySessionId(activeSession.id);
    setShowSummary(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [activeSession, store]);

  const handleQuickAdd = useCallback(() => {
    const name = quickName.trim();
    if (!name) {
      Alert.alert("Error", "Enter an exercise name.");
      return;
    }
    const id = store.addExercise(name, quickMuscle, quickEquipment);
    setSelectedExerciseIds((prev) => new Set([...prev, id]));
    setQuickName("");
    setShowQuickAdd(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [quickName, quickMuscle, quickEquipment, store]);

  const toggleExercise = useCallback((id: number) => {
    setSelectedExerciseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    Haptics.selectionAsync();
  }, []);

  // ─── Summary View ───────────────────────────────────────────────────────

  if (showSummary && summarySessionId) {
    const session = store.sessions.find((s) => s.id === summarySessionId);
    const sessionSets = store.getSessionSets(summarySessionId);
    const totalSets = sessionSets.length;
    const totalVolume = sessionSets.reduce((sum, s) => sum + s.weight * s.reps, 0);
    const duration =
      session && session.endedAt ? session.endedAt - session.startedAt : 0;

    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.summaryContainer}>
          <Ionicons
            name="checkmark-circle"
            size={64}
            color={colors.body}
            style={{ marginBottom: spacing.xl }}
          />
          <Text style={styles.summaryTitle}>Workout Complete</Text>

          <Panel style={styles.summaryPanel}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryValue}>{totalSets}</Text>
                <Text style={styles.summaryLabel}>SETS</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryStat}>
                <Text style={styles.summaryValue}>
                  {totalVolume.toLocaleString()}
                </Text>
                <Text style={styles.summaryLabel}>VOLUME (kg)</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryStat}>
                <Text style={styles.summaryValue}>
                  {formatDuration(duration)}
                </Text>
                <Text style={styles.summaryLabel}>DURATION</Text>
              </View>
            </View>
          </Panel>

          <Pressable
            style={styles.doneBtn}
            onPress={() => {
              setShowSummary(false);
              setSummarySessionId(null);
            }}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Active Session View ────────────────────────────────────────────────

  if (activeSession) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <View style={{ width: 48 }} />
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Active Workout</Text>
            <Text style={styles.timerText}>{formatDuration(elapsed)}</Text>
          </View>
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
            {activeExercises.map((exercise) => {
              const exerciseSets = activeSets
                .filter((s) => s.exerciseId === exercise.id)
                .sort((a, b) => a.setIndex - b.setIndex);

              return (
                <Panel key={exercise.id} style={styles.exercisePanel}>
                  <View style={styles.exerciseHeader}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <View
                      style={[
                        styles.muscleBadge,
                        { backgroundColor: colors.bodyDim },
                      ]}
                    >
                      <Text style={styles.muscleBadgeText}>
                        {exercise.muscleGroup}
                      </Text>
                    </View>
                  </View>

                  {/* Sets table header */}
                  <View style={styles.setHeaderRow}>
                    <Text style={styles.setHeaderText}>SET</Text>
                    <Text style={styles.setHeaderText}>KG</Text>
                    <Text style={styles.setHeaderText}>REPS</Text>
                  </View>

                  {exerciseSets.map((gs) => (
                    <SetRow
                      key={gs.id}
                      gymSet={gs}
                      onUpdate={() => {
                        /* Sets are committed on blur via store.addSet pattern;
                           for edits, we update in-place — for MVP,
                           sets are add-only and weight/reps display only */
                      }}
                    />
                  ))}

                  <Pressable
                    style={styles.addSetBtn}
                    onPress={() => handleAddSet(exercise.id)}
                  >
                    <Ionicons name="add" size={16} color={colors.body} />
                    <Text style={styles.addSetText}>Add Set</Text>
                  </Pressable>
                </Panel>
              );
            })}

            <Pressable style={styles.finishBtn} onPress={handleFinishWorkout}>
              <Ionicons name="checkmark-circle" size={20} color="#000" />
              <Text style={styles.finishBtnText}>Finish Workout</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ─── Default View (Templates / History) ─────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Workouts</Text>
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
          {/* ── Templates ──────────────────────────────────────────── */}
          <SectionHeader title="Start Workout" />

          {store.templates.length === 0 && !showCreateTemplate && (
            <Panel style={styles.emptyPanel}>
              <Ionicons
                name="barbell-outline"
                size={32}
                color={colors.textMuted}
              />
              <Text style={styles.emptyText}>No templates yet</Text>
              <Text style={styles.emptySubtext}>
                Create a workout template to get started
              </Text>
            </Panel>
          )}

          {store.templates.map((t) => {
            const exCount = store.getTemplateExercises(t.id).length;
            return (
              <TemplateCard
                key={t.id}
                template={t}
                exerciseCount={exCount}
                onStart={() => handleStartSession(t.id)}
                onDelete={() => handleDeleteTemplate(t.id)}
              />
            );
          })}

          {/* Create template toggle */}
          {!showCreateTemplate && (
            <Pressable
              style={styles.createTemplateBtn}
              onPress={() => {
                setShowCreateTemplate(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.body} />
              <Text style={styles.createTemplateBtnText}>Create Template</Text>
            </Pressable>
          )}

          {/* ── Create Template Form ───────────────────────────────── */}
          {showCreateTemplate && (
            <Panel style={styles.formPanel}>
              <Text style={styles.formTitle}>New Template</Text>

              <TextInput
                style={styles.input}
                placeholder="Template name"
                placeholderTextColor={colors.textMuted}
                value={templateName}
                onChangeText={setTemplateName}
                autoFocus
              />

              <Text style={styles.formSubtitle}>Select Exercises</Text>

              {store.exercises.map((ex) => {
                const selected = selectedExerciseIds.has(ex.id);
                return (
                  <Pressable
                    key={ex.id}
                    style={[
                      styles.exerciseSelectRow,
                      selected && styles.exerciseSelectRowActive,
                    ]}
                    onPress={() => toggleExercise(ex.id)}
                  >
                    <Ionicons
                      name={selected ? "checkbox" : "square-outline"}
                      size={20}
                      color={selected ? colors.body : colors.textMuted}
                    />
                    <View style={styles.exerciseSelectInfo}>
                      <Text style={styles.exerciseSelectName}>{ex.name}</Text>
                      <Text style={styles.exerciseSelectMeta}>
                        {ex.muscleGroup} / {ex.equipment}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}

              {/* Quick Add Exercise */}
              {!showQuickAdd && (
                <Pressable
                  style={styles.quickAddToggle}
                  onPress={() => setShowQuickAdd(true)}
                >
                  <Ionicons name="add" size={16} color={colors.textSecondary} />
                  <Text style={styles.quickAddToggleText}>Quick Add Exercise</Text>
                </Pressable>
              )}

              {showQuickAdd && (
                <View style={styles.quickAddForm}>
                  <TextInput
                    style={styles.input}
                    placeholder="Exercise name"
                    placeholderTextColor={colors.textMuted}
                    value={quickName}
                    onChangeText={setQuickName}
                  />

                  <Text style={styles.chipLabel}>Muscle Group</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipScroll}
                  >
                    {MUSCLE_GROUPS.map((mg) => (
                      <Pressable
                        key={mg}
                        style={[
                          styles.chip,
                          quickMuscle === mg && styles.chipActive,
                        ]}
                        onPress={() => setQuickMuscle(mg)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            quickMuscle === mg && styles.chipTextActive,
                          ]}
                        >
                          {mg}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <Text style={styles.chipLabel}>Equipment</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipScroll}
                  >
                    {EQUIPMENT.map((eq) => (
                      <Pressable
                        key={eq}
                        style={[
                          styles.chip,
                          quickEquipment === eq && styles.chipActive,
                        ]}
                        onPress={() => setQuickEquipment(eq)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            quickEquipment === eq && styles.chipTextActive,
                          ]}
                        >
                          {eq}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <Pressable style={styles.quickAddSaveBtn} onPress={handleQuickAdd}>
                    <Text style={styles.quickAddSaveBtnText}>Add Exercise</Text>
                  </Pressable>
                </View>
              )}

              {/* Form actions */}
              <View style={styles.formActions}>
                <Pressable
                  style={styles.formCancelBtn}
                  onPress={() => {
                    setShowCreateTemplate(false);
                    setTemplateName("");
                    setSelectedExerciseIds(new Set());
                    setShowQuickAdd(false);
                  }}
                >
                  <Text style={styles.formCancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.formSaveBtn}
                  onPress={handleCreateTemplate}
                >
                  <Text style={styles.formSaveBtnText}>Save Template</Text>
                </Pressable>
              </View>
            </Panel>
          )}

          {/* ── Recent Sessions ─────────────────────────────────────── */}
          <SectionHeader title="Recent Workouts" />

          {recentSessions.length === 0 ? (
            <Panel style={styles.emptyPanel}>
              <Text style={styles.emptyText}>No workouts logged</Text>
              <Text style={styles.emptySubtext}>
                Complete a workout to see it here
              </Text>
            </Panel>
          ) : (
            recentSessions.map((session) => {
              const tmpl = store.templates.find(
                (t) => t.id === session.templateId
              );
              const duration =
                session.endedAt && session.startedAt
                  ? session.endedAt - session.startedAt
                  : 0;
              const sessionSets = store.getSessionSets(session.id);
              const volume = sessionSets.reduce(
                (sum, s) => sum + s.weight * s.reps,
                0
              );

              return (
                <Panel key={session.id} style={styles.recentCard}>
                  <View style={styles.recentRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recentName}>
                        {tmpl?.name ?? "Workout"}
                      </Text>
                      <Text style={styles.recentMeta}>
                        {formatDate(session.dateKey)} &middot;{" "}
                        {formatDuration(duration)} &middot;{" "}
                        {sessionSets.length} sets &middot;{" "}
                        {volume.toLocaleString()} kg
                      </Text>
                    </View>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={colors.body}
                    />
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

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerCenter: { alignItems: "center" },
  backBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  timerText: {
    ...fonts.mono,
    fontSize: 13,
    color: colors.body,
    marginTop: 2,
  },

  // Body
  body: { flex: 1, paddingHorizontal: spacing.lg },
  bodyContent: { paddingBottom: spacing["5xl"] },

  // Template cards
  templateCard: { marginBottom: spacing.sm },
  templateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  templateName: { fontSize: 16, fontWeight: "700", color: colors.text },
  templateMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  templateActions: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  deleteBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  startSessionBtn: {
    backgroundColor: colors.body,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  startSessionBtnText: {
    ...fonts.kicker,
    color: "#000",
    letterSpacing: 2,
  },

  // Create template
  createTemplateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderStyle: "dashed",
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    marginTop: spacing.sm,
  },
  createTemplateBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.body,
  },

  // Form
  formPanel: { marginTop: spacing.sm },
  formTitle: { ...fonts.heading, marginBottom: spacing.lg },
  formSubtitle: {
    ...fonts.kicker,
    color: colors.textMuted,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
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
  },

  // Exercise select
  exerciseSelectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  exerciseSelectRowActive: {
    backgroundColor: colors.bodyDim,
  },
  exerciseSelectInfo: { flex: 1 },
  exerciseSelectName: { fontSize: 15, fontWeight: "600", color: colors.text },
  exerciseSelectMeta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },

  // Quick add
  quickAddToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  quickAddToggleText: { fontSize: 13, color: colors.textSecondary },
  quickAddForm: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.panelBorder,
  },
  chipLabel: {
    ...fonts.kicker,
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  chipScroll: { marginBottom: spacing.xs },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    marginRight: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.bodyDim,
    borderColor: colors.body,
  },
  chipText: { fontSize: 13, color: colors.textSecondary },
  chipTextActive: { color: colors.body, fontWeight: "600" },
  quickAddSaveBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  quickAddSaveBtnText: { fontSize: 14, fontWeight: "600", color: colors.text },

  // Form actions
  formActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing["2xl"],
  },
  formCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  formCancelBtnText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  formSaveBtn: {
    flex: 1,
    backgroundColor: colors.body,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  formSaveBtnText: { fontSize: 14, fontWeight: "700", color: "#000" },

  // Active session — exercise panels
  exercisePanel: { marginBottom: spacing.lg },
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  exerciseName: { fontSize: 16, fontWeight: "700", color: colors.text },
  muscleBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  muscleBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.body,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // Set rows
  setHeaderRow: {
    flexDirection: "row",
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.panelBorder,
    marginBottom: spacing.xs,
  },
  setHeaderText: {
    ...fonts.kicker,
    flex: 1,
    textAlign: "center",
    color: colors.textMuted,
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  setNum: {
    ...fonts.mono,
    flex: 1,
    textAlign: "center",
    color: colors.textSecondary,
    fontSize: 13,
  },
  setInput: {
    flex: 1,
    textAlign: "center",
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.sm,
    marginHorizontal: 4,
    paddingVertical: 6,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "monospace",
    color: colors.text,
  },
  addSetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.panelBorder,
  },
  addSetText: { fontSize: 13, fontWeight: "600", color: colors.body },

  // Finish button
  finishBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.body,
    borderRadius: radius.full,
    paddingVertical: spacing.lg,
    marginTop: spacing.xl,
  },
  finishBtnText: { fontSize: 18, fontWeight: "800", color: "#000" },

  // Summary
  summaryContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing["2xl"],
  },
  summaryTitle: {
    ...fonts.title,
    textTransform: "uppercase",
    marginBottom: spacing["2xl"],
  },
  summaryPanel: { width: "100%", marginBottom: spacing["3xl"] },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  summaryStat: { alignItems: "center" },
  summaryValue: { ...fonts.monoValue, color: colors.body },
  summaryLabel: { ...fonts.kicker, color: colors.textMuted, marginTop: spacing.xs },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.panelBorder,
  },
  doneBtn: {
    backgroundColor: colors.body,
    borderRadius: radius.full,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["5xl"],
    alignItems: "center",
  },
  doneBtnText: { fontSize: 18, fontWeight: "800", color: "#000" },

  // Empty / placeholder panels
  emptyPanel: {
    alignItems: "center",
    paddingVertical: spacing["3xl"],
    gap: spacing.sm,
  },
  emptyText: { fontSize: 15, fontWeight: "600", color: colors.textSecondary },
  emptySubtext: { fontSize: 13, color: colors.textMuted },

  // Recent sessions
  recentCard: { marginBottom: spacing.sm },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  recentName: { fontSize: 15, fontWeight: "700", color: colors.text },
  recentMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
