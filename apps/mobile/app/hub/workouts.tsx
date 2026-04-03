import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  FlatList,
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
import Animated, {
  FadeInDown,
  ZoomIn,
} from "react-native-reanimated";
import { colors, spacing, radius, fonts } from "../../src/theme";
import { Panel } from "../../src/components/ui/Panel";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { PageHeader } from "../../src/components/ui/PageHeader";
import { MetricValue } from "../../src/components/ui/MetricValue";
import {
  useGymStore,
  Exercise,
  Template,
  GymSession,
  GymSet,
  SetType,
  MUSCLE_GROUPS,
  EQUIPMENT_LIST,
  MuscleGroup,
  PersonalRecord,
} from "../../src/stores/useGymStore";
import { getTodayKey } from "../../src/lib/date";
import { useProfileStore } from "../../src/stores/useProfileStore";

// ─── Constants ──────────────────────────────────────────────────────────────

const MONO_FONT = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

const DEFAULT_REST_SECONDS = 90;

const SET_TYPE_LABELS: Record<SetType, string> = {
  normal: "N",
  warmup: "W",
  dropset: "D",
  failure: "F",
};

const SET_TYPE_COLORS: Record<SetType, string> = {
  normal: colors.text,
  warmup: colors.warning,
  dropset: colors.mind,
  failure: colors.danger,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatDate(dateKey: string): string {
  const d = new Date(dateKey + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDateLong(dateKey: string): string {
  const d = new Date(dateKey + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatVolume(vol: number): string {
  if (vol >= 1000000) return `${(vol / 1000000).toFixed(1)}M`;
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}k`;
  return vol.toLocaleString();
}

function parseNumeric(value: string, fallback: number = 0): number {
  const parsed = parseFloat(value);
  if (isNaN(parsed) || parsed < 0) return fallback;
  return parsed;
}

// ─── PR Badge ───────────────────────────────────────────────────────────────

const PRBadge = React.memo(function PRBadge() {
  return (
    <Animated.View entering={ZoomIn.duration(400)} style={s.prBadge}>
      <Text style={s.prBadgeText}>NEW PR!</Text>
    </Animated.View>
  );
});

// ─── Rest Timer Overlay ─────────────────────────────────────────────────────

type RestTimerProps = {
  remaining: number;
  duration: number;
  onSkip: () => void;
};

const RestTimerOverlay = React.memo(function RestTimerOverlay({
  remaining,
  duration,
  onSkip,
}: RestTimerProps) {
  const progress = duration > 0 ? (duration - remaining) / duration : 0;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <Animated.View entering={FadeInDown.duration(300)} style={s.restTimerContainer}>
      <Panel style={s.restTimerPanel} glowColor={colors.body}>
        <Text style={s.restTimerLabel}>REST TIMER</Text>
        <Text style={s.restTimerValue}>
          {mins}:{secs.toString().padStart(2, "0")}
        </Text>

        {/* Progress bar */}
        <View style={s.restTimerTrack}>
          <View
            style={[
              s.restTimerFill,
              { width: `${Math.min(progress * 100, 100)}%` },
            ]}
          />
        </View>

        <Pressable
          style={s.restTimerSkipBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSkip();
          }}
        >
          <Ionicons name="play-skip-forward" size={16} color={colors.text} />
          <Text style={s.restTimerSkipText}>SKIP</Text>
        </Pressable>
      </Panel>
    </Animated.View>
  );
});

// ─── Set Type Picker ────────────────────────────────────────────────────────

type SetTypePickerProps = {
  value: SetType;
  onChange: (type: SetType) => void;
};

const SetTypePicker = React.memo(function SetTypePicker({
  value,
  onChange,
}: SetTypePickerProps) {
  const types: SetType[] = ["normal", "warmup", "dropset", "failure"];
  const nextType = () => {
    const idx = types.indexOf(value);
    const next = types[(idx + 1) % types.length];
    Haptics.selectionAsync();
    onChange(next);
  };

  return (
    <Pressable onPress={nextType} style={s.setTypePicker} hitSlop={6}>
      <Text
        style={[
          s.setTypeText,
          { color: SET_TYPE_COLORS[value] },
        ]}
      >
        {SET_TYPE_LABELS[value]}
      </Text>
    </Pressable>
  );
});

// ─── Active Set Row ─────────────────────────────────────────────────────────

type ActiveSetRowProps = {
  gymSet: GymSet;
  previousWeight?: number;
  previousReps?: number;
  isPR: boolean;
  onUpdate: (fields: Partial<Pick<GymSet, "weight" | "reps" | "setType" | "notes">>) => void;
  onComplete: () => void;
  onRemove: () => void;
};

const ActiveSetRow = React.memo(function ActiveSetRow({
  gymSet,
  previousWeight,
  previousReps,
  isPR,
  onUpdate,
  onComplete,
  onRemove,
}: ActiveSetRowProps) {
  const [weight, setWeight] = useState(
    gymSet.weight > 0 ? gymSet.weight.toString() : "",
  );
  const [reps, setReps] = useState(
    gymSet.reps > 0 ? gymSet.reps.toString() : "",
  );
  const weightFocusedRef = useRef(false);
  const repsFocusedRef = useRef(false);

  // Sync from store on external changes when not actively editing
  useEffect(() => {
    if (!weightFocusedRef.current) {
      setWeight(gymSet.weight > 0 ? gymSet.weight.toString() : "");
    }
  }, [gymSet.weight]);

  useEffect(() => {
    if (!repsFocusedRef.current) {
      setReps(gymSet.reps > 0 ? gymSet.reps.toString() : "");
    }
  }, [gymSet.reps]);

  const handleWeightFocus = useCallback(() => {
    weightFocusedRef.current = true;
  }, []);

  const handleWeightBlur = useCallback(() => {
    weightFocusedRef.current = false;
    const w = parseNumeric(weight);
    onUpdate({ weight: w });
  }, [weight, onUpdate]);

  const handleRepsFocus = useCallback(() => {
    repsFocusedRef.current = true;
  }, []);

  const handleRepsBlur = useCallback(() => {
    repsFocusedRef.current = false;
    const r = Math.floor(parseNumeric(reps));
    onUpdate({ reps: r });
  }, [reps, onUpdate]);

  const handleComplete = useCallback(() => {
    // Ensure values are saved before completing
    const w = parseNumeric(weight);
    const r = Math.floor(parseNumeric(reps));
    if (w <= 0 && r <= 0) {
      Alert.alert("Empty Set", "Enter weight or reps before completing.");
      return;
    }
    onUpdate({ weight: w, reps: r });
    onComplete();
  }, [weight, reps, onUpdate, onComplete]);

  const prevText =
    previousWeight !== undefined && previousReps !== undefined
      ? `${previousWeight} x ${previousReps}`
      : "-";

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      style={[s.activeSetRow, gymSet.completed && s.activeSetRowCompleted]}
    >
      {/* Set number */}
      <Text style={[s.activeSetNum, gymSet.completed && s.activeSetNumDone]}>
        {gymSet.setIndex}
      </Text>

      {/* Type */}
      <SetTypePicker
        value={gymSet.setType}
        onChange={(type) => onUpdate({ setType: type })}
      />

      {/* Previous */}
      <Text style={s.activeSetPrev}>{prevText}</Text>

      {/* Weight input */}
      <TextInput
        style={[s.activeSetInput, gymSet.completed && s.activeSetInputDone]}
        value={weight}
        onChangeText={setWeight}
        onFocus={handleWeightFocus}
        onBlur={handleWeightBlur}
        keyboardType="decimal-pad"
        placeholder={previousWeight !== undefined ? String(previousWeight) : "0"}
        placeholderTextColor="rgba(255,255,255,0.15)"
        selectTextOnFocus
      />

      {/* Reps input */}
      <TextInput
        style={[s.activeSetInput, gymSet.completed && s.activeSetInputDone]}
        value={reps}
        onChangeText={setReps}
        onFocus={handleRepsFocus}
        onBlur={handleRepsBlur}
        keyboardType="number-pad"
        placeholder={previousReps !== undefined ? String(previousReps) : "0"}
        placeholderTextColor="rgba(255,255,255,0.15)"
        selectTextOnFocus
      />

      {/* Complete/PR indicator — tap to toggle */}
      <View style={s.activeSetCheckCol}>
        {gymSet.completed ? (
          <Pressable onPress={onComplete} hitSlop={8}>
            {isPR ? (
              <PRBadge />
            ) : (
              <Ionicons name="checkmark-circle" size={24} color={colors.body} />
            )}
          </Pressable>
        ) : (
          <Pressable onPress={handleComplete} hitSlop={8}>
            <View style={s.checkCircle} />
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
});

// ─── Exercise Card (Active Workout) ─────────────────────────────────────────

type ExerciseCardProps = {
  exercise: Exercise;
  sets: GymSet[];
  previousSets: GymSet[];
  prRecord: PersonalRecord | undefined;
  sessionPRSetIds: Set<number>;
  onUpdateSet: (
    setId: number,
    fields: Partial<Pick<GymSet, "weight" | "reps" | "setType" | "notes">>,
  ) => void;
  onCompleteSet: (setId: number) => void;
  onRemoveSet: (setId: number) => void;
  onAddSet: () => void;
};

const ExerciseCard = React.memo(function ExerciseCard({
  exercise,
  sets,
  previousSets,
  prRecord,
  sessionPRSetIds,
  onUpdateSet,
  onCompleteSet,
  onRemoveSet,
  onAddSet,
}: ExerciseCardProps) {
  return (
    <Panel style={s.exerciseCard} glowColor={colors.body}>
      {/* Header */}
      <View style={s.exerciseCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.exerciseCardName}>{exercise.name}</Text>
        </View>
        <View style={s.muscleBadge}>
          <Text style={s.muscleBadgeText}>{exercise.muscleGroup}</Text>
        </View>
      </View>

      {/* Column headers */}
      <View style={s.setTableHeader}>
        <Text style={[s.setTableHeaderText, { width: 28 }]}>SET</Text>
        <Text style={[s.setTableHeaderText, { width: 32 }]}>TYPE</Text>
        <Text style={[s.setTableHeaderText, { flex: 1, textAlign: "center" }]}>
          PREV
        </Text>
        <Text style={[s.setTableHeaderText, { width: 64, textAlign: "center" }]}>
          KG
        </Text>
        <Text style={[s.setTableHeaderText, { width: 52, textAlign: "center" }]}>
          REPS
        </Text>
        <Text style={[s.setTableHeaderText, { width: 36, textAlign: "center" }]}>
          {" "}
        </Text>
      </View>

      {/* Set rows */}
      {sets.map((gs) => {
        const prevSet = previousSets.find((p) => p.setIndex === gs.setIndex);
        return (
          <ActiveSetRow
            key={gs.id}
            gymSet={gs}
            previousWeight={prevSet?.weight}
            previousReps={prevSet?.reps}
            isPR={sessionPRSetIds.has(gs.id)}
            onUpdate={(fields) => onUpdateSet(gs.id, fields)}
            onComplete={() => onCompleteSet(gs.id)}
            onRemove={() => onRemoveSet(gs.id)}
          />
        );
      })}

      {/* Add Set */}
      <Pressable style={s.addSetBtn} onPress={onAddSet}>
        <Ionicons name="add" size={16} color={colors.body} />
        <Text style={s.addSetText}>Add Set</Text>
      </Pressable>
    </Panel>
  );
});

// ─── Template Card ──────────────────────────────────────────────────────────

type TemplateCardProps = {
  template: Template;
  exerciseCount: number;
  exerciseNames: string;
  lastPerformed: string | null;
  onStart: () => void;
  onDelete: () => void;
};

const TemplateCard = React.memo(function TemplateCard({
  template,
  exerciseCount,
  exerciseNames,
  lastPerformed,
  onStart,
  onDelete,
}: TemplateCardProps) {
  return (
    <Animated.View entering={FadeInDown.duration(300)}>
      <Panel style={s.templateCard}>
        <View style={s.templateCardInner}>
          {/* Left green border accent */}
          <View style={s.templateAccent} />

          <View style={s.templateContent}>
            <View style={s.templateTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.templateName}>{template.name}</Text>
                <Text style={s.templateExercises} numberOfLines={1}>
                  {exerciseNames}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onDelete();
                }}
                style={s.templateDeleteBtn}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
              </Pressable>
            </View>

            <View style={s.templateBottomRow}>
              <View style={s.templateMeta}>
                <Text style={s.templateMetaText}>
                  {exerciseCount} exercise{exerciseCount !== 1 ? "s" : ""}
                </Text>
                {lastPerformed && (
                  <Text style={s.templateMetaText}>
                    {"  "}Last: {lastPerformed}
                  </Text>
                )}
              </View>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  onStart();
                }}
                style={s.templateStartBtn}
              >
                <Ionicons name="play" size={14} color="#000" />
                <Text style={s.templateStartBtnText}>START</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Panel>
    </Animated.View>
  );
});

// ─── Recent Workout Card ────────────────────────────────────────────────────

type RecentCardProps = {
  session: GymSession;
  setCount: number;
  volume: number;
  duration: number;
  prCount: number;
};

const RecentCard = React.memo(function RecentCard({
  session,
  setCount,
  volume,
  duration,
  prCount,
}: RecentCardProps) {
  return (
    <Panel style={s.recentCard}>
      <View style={s.recentRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.recentName}>{session.templateName}</Text>
          <Text style={s.recentDate}>
            {formatDateLong(session.dateKey)}
          </Text>
        </View>
        <Ionicons name="checkmark-circle" size={20} color={colors.body} />
      </View>
      <View style={s.recentStats}>
        <View style={s.recentStatItem}>
          <Text style={s.recentStatValue}>{formatDuration(duration)}</Text>
          <Text style={s.recentStatLabel}>Duration</Text>
        </View>
        <View style={s.recentStatDivider} />
        <View style={s.recentStatItem}>
          <Text style={s.recentStatValue}>{formatVolume(volume)}</Text>
          <Text style={s.recentStatLabel}>Volume</Text>
        </View>
        <View style={s.recentStatDivider} />
        <View style={s.recentStatItem}>
          <Text style={s.recentStatValue}>{setCount}</Text>
          <Text style={s.recentStatLabel}>Sets</Text>
        </View>
        {prCount > 0 && (
          <>
            <View style={s.recentStatDivider} />
            <View style={s.recentStatItem}>
              <Text style={[s.recentStatValue, { color: colors.warning }]}>
                {prCount}
              </Text>
              <Text style={s.recentStatLabel}>PRs</Text>
            </View>
          </>
        )}
      </View>
    </Panel>
  );
});

// ─── Quick Stats Panel ──────────────────────────────────────────────────────

type QuickStatsProps = {
  totalWorkouts: number;
  weekWorkouts: number;
  totalVolume: number;
  streak: number;
};

const QuickStatsPanel = React.memo(function QuickStatsPanel({
  totalWorkouts,
  weekWorkouts,
  totalVolume,
  streak,
}: QuickStatsProps) {
  return (
    <Panel style={s.quickStatsPanel} glowColor={colors.body}>
      <View style={s.quickStatsGrid}>
        <View style={s.quickStatItem}>
          <MetricValue label="Total" value={totalWorkouts} size="sm" color={colors.body} />
        </View>
        <View style={s.quickStatItem}>
          <MetricValue label="This Week" value={weekWorkouts} size="sm" color={colors.body} />
        </View>
        <View style={s.quickStatItem}>
          <MetricValue label="Volume (kg)" value={formatVolume(totalVolume)} size="sm" />
        </View>
        <View style={s.quickStatItem}>
          <MetricValue
            label="Streak"
            value={streak}
            size="sm"
            suffix="d"
            color={streak > 0 ? colors.body : colors.textMuted}
          />
        </View>
      </View>
    </Panel>
  );
});

// ─── Exercise Picker (for Create Template) ──────────────────────────────────

type ExercisePickerProps = {
  exercises: Exercise[];
  selectedIds: Set<number>;
  onToggle: (id: number) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
};

const ExercisePicker = React.memo(function ExercisePicker({
  exercises,
  selectedIds,
  onToggle,
  searchQuery,
  onSearchChange,
}: ExercisePickerProps) {
  const [activeGroup, setActiveGroup] = useState<MuscleGroup | "All">("All");

  const filtered = useMemo(() => {
    let list = exercises;
    if (activeGroup !== "All") {
      list = list.filter((e) => e.muscleGroup === activeGroup);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((e) => e.name.toLowerCase().includes(q));
    }
    return list;
  }, [exercises, activeGroup, searchQuery]);

  const groups: (MuscleGroup | "All")[] = ["All", ...MUSCLE_GROUPS];

  return (
    <View>
      {/* Search */}
      <TextInput
        style={s.searchInput}
        placeholder="Search exercises..."
        placeholderTextColor={colors.textMuted}
        value={searchQuery}
        onChangeText={onSearchChange}
      />

      {/* Muscle group tabs */}
      <FlatList
        data={groups}
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        keyExtractor={(item) => item}
        style={s.groupTabs}
        renderItem={({ item }) => (
          <Pressable
            style={[s.groupTab, activeGroup === item && s.groupTabActive]}
            onPress={() => {
              setActiveGroup(item);
              Haptics.selectionAsync();
            }}
          >
            <Text
              style={[
                s.groupTabText,
                activeGroup === item && s.groupTabTextActive,
              ]}
            >
              {item}
            </Text>
          </Pressable>
        )}
      />

      {/* Exercise list */}
      <View style={s.exerciseList}>
        {filtered.map((ex) => {
          const selected = selectedIds.has(ex.id);
          return (
            <Pressable
              key={ex.id}
              style={[s.exercisePickerRow, selected && s.exercisePickerRowActive]}
              onPress={() => onToggle(ex.id)}
            >
              <Ionicons
                name={selected ? "checkbox" : "square-outline"}
                size={20}
                color={selected ? colors.body : colors.textMuted}
              />
              <View style={s.exercisePickerInfo}>
                <Text style={s.exercisePickerName}>{ex.name}</Text>
                <Text style={s.exercisePickerMeta}>
                  {ex.muscleGroup} / {ex.equipment}
                </Text>
              </View>
              {selected && (
                <View style={s.selectedBadge}>
                  <Text style={s.selectedBadgeText}>
                    {Array.from(selectedIds).indexOf(ex.id) + 1}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
        {filtered.length === 0 && (
          <Text style={s.emptyText}>No exercises found</Text>
        )}
      </View>
    </View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// ─── MAIN SCREEN ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

export default function WorkoutsScreen() {
  const router = useRouter();

  // Store selectors
  const exercises = useGymStore((s) => s.exercises);
  const templates = useGymStore((s) => s.templates);
  const sessions = useGymStore((s) => s.sessions);
  const sets = useGymStore((s) => s.sets);
  const activeSessionId = useGymStore((s) => s.activeSessionId);
  const templateExercises = useGymStore((s) => s.templateExercises);
  const personalRecords = useGymStore((s) => s.personalRecords);
  const restTimer = useGymStore((s) => s.restTimer);

  const awardXP = useProfileStore((s) => s.awardXP);

  const load = useGymStore((s) => s.load);
  const addExercise = useGymStore((s) => s.addExercise);
  const createTemplate = useGymStore((s) => s.createTemplate);
  const startSession = useGymStore((s) => s.startSession);
  const addSet = useGymStore((s) => s.addSet);
  const updateSet = useGymStore((s) => s.updateSet);
  const completeSet = useGymStore((s) => s.completeSet);
  const removeSet = useGymStore((s) => s.removeSet);
  const endSession = useGymStore((s) => s.endSession);
  const cancelSession = useGymStore((s) => s.cancelSession);
  const getSessionSets = useGymStore((s) => s.getSessionSets);
  const getTemplateExercises = useGymStore((s) => s.getTemplateExercises);
  const getPreviousSets = useGymStore((s) => s.getPreviousSets);
  const deleteTemplate = useGymStore((s) => s.deleteTemplate);
  const startRestTimer = useGymStore((s) => s.startRestTimer);
  const tickRestTimer = useGymStore((s) => s.tickRestTimer);
  const cancelRestTimer = useGymStore((s) => s.cancelRestTimer);
  const getTotalWorkouts = useGymStore((s) => s.getTotalWorkouts);
  const getWeekWorkouts = useGymStore((s) => s.getWeekWorkouts);
  const getTotalVolume = useGymStore((s) => s.getTotalVolume);
  const getCurrentStreak = useGymStore((s) => s.getCurrentStreak);

  // ─── Local UI State ─────────────────────────────────────────────────────

  const [screenState, setScreenState] = useState<
    "default" | "active" | "summary"
  >("default");
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<number>>(
    new Set(),
  );
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickMuscle, setQuickMuscle] = useState<MuscleGroup>("Chest");
  const [quickEquipment, setQuickEquipment] = useState("Barbell");
  const [summarySessionId, setSummarySessionId] = useState<number | null>(null);
  const [sessionPRSetIds, setSessionPRSetIds] = useState<Set<number>>(
    new Set(),
  );

  // Timer state
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Load data ──────────────────────────────────────────────────────────

  useEffect(() => {
    load();
  }, [load]);

  // Determine screen state from store
  useEffect(() => {
    if (activeSessionId !== null && screenState === "default") {
      setScreenState("active");
    } else if (activeSessionId === null && screenState === "active") {
      // Session was ended/cancelled externally
      setScreenState("default");
    }
  }, [activeSessionId]);

  // ─── Active session derived data ────────────────────────────────────────

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  const activeExercises = useMemo(() => {
    if (!activeSession) return [];
    return getTemplateExercises(activeSession.templateId);
  }, [activeSession, templateExercises, exercises, getTemplateExercises]);

  const activeSets = useMemo(() => {
    if (!activeSession) return [];
    return getSessionSets(activeSession.id);
  }, [activeSession, sets, getSessionSets]);

  // Previous sets for each exercise (for progressive overload display)
  const previousSetsMap = useMemo(() => {
    if (!activeSession) return new Map<number, GymSet[]>();
    const map = new Map<number, GymSet[]>();
    for (const ex of activeExercises) {
      map.set(ex.id, getPreviousSets(activeSession.templateId, ex.id));
    }
    return map;
  }, [activeSession, activeExercises, getPreviousSets, sessions, sets]);

  // ─── Elapsed timer ──────────────────────────────────────────────────────

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

  // ─── Rest timer interval ───────────────────────────────────────────────

  useEffect(() => {
    if (restTimer.active) {
      restTimerRef.current = setInterval(() => {
        tickRestTimer();
      }, 1000);
      return () => {
        if (restTimerRef.current) clearInterval(restTimerRef.current);
      };
    } else {
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
        restTimerRef.current = null;
      }
    }
  }, [restTimer.active, tickRestTimer]);

  // Haptic when rest timer ends
  useEffect(() => {
    if (!restTimer.active && restTimer.duration > 0 && restTimer.remaining === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [restTimer.active, restTimer.remaining, restTimer.duration]);

  // ─── Computed values ────────────────────────────────────────────────────

  const recentSessions = useMemo(
    () =>
      sessions
        .filter((s_) => s_.endedAt !== null)
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, 10),
    [sessions],
  );

  const templateExCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const t of templates) {
      counts[t.id] = getTemplateExercises(t.id).length;
    }
    return counts;
  }, [templates, templateExercises, exercises, getTemplateExercises]);

  const templateExNames = useMemo(() => {
    const names: Record<number, string> = {};
    for (const t of templates) {
      const exs = getTemplateExercises(t.id);
      names[t.id] = exs.map((e) => e.name).join(", ");
    }
    return names;
  }, [templates, templateExercises, exercises, getTemplateExercises]);

  const templateLastPerformed = useMemo(() => {
    const result: Record<number, string | null> = {};
    for (const t of templates) {
      const lastSession = sessions
        .filter((s_) => s_.templateId === t.id && s_.endedAt !== null)
        .sort((a, b) => b.startedAt - a.startedAt)[0];
      result[t.id] = lastSession ? formatDate(lastSession.dateKey) : null;
    }
    return result;
  }, [templates, sessions]);

  const recentSessionStats = useMemo(() => {
    const stats: Record<
      number,
      { setCount: number; volume: number; duration: number; prCount: number }
    > = {};
    for (const session of recentSessions) {
      const sessionSets = getSessionSets(session.id);
      const completedSets = sessionSets.filter((s_) => s_.completed);
      const volume = completedSets.reduce(
        (sum, s_) => sum + s_.weight * s_.reps,
        0,
      );
      const duration =
        session.endedAt && session.startedAt
          ? session.endedAt - session.startedAt
          : 0;
      stats[session.id] = {
        setCount: completedSets.length,
        volume,
        duration,
        prCount: session.prCount ?? 0,
      };
    }
    return stats;
  }, [recentSessions, sets, getSessionSets]);

  const totalWorkouts = useMemo(() => getTotalWorkouts(), [sessions]);
  const weekWorkouts = useMemo(() => getWeekWorkouts(), [sessions]);
  const totalVolume = useMemo(() => getTotalVolume(), [sessions, sets]);
  const streak = useMemo(() => getCurrentStreak(), [sessions]);

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
    if (templates.some(t => t.name.trim().toLowerCase() === name.toLowerCase())) {
      Alert.alert("Duplicate", "A template with this name already exists.");
      return;
    }
    createTemplate(name, Array.from(selectedExerciseIds));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTemplateName("");
    setSelectedExerciseIds(new Set());
    setExerciseSearch("");
    setShowCreateTemplate(false);
  }, [templateName, selectedExerciseIds, createTemplate, templates]);

  const handleStartSession = useCallback(
    (templateId: number) => {
      const sessionId = startSession(templateId, getTodayKey());
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setSessionPRSetIds(new Set());

      // Pre-populate sets from template exercises
      const exs = getTemplateExercises(templateId);
      for (const ex of exs) {
        const prev = getPreviousSets(templateId, ex.id);
        const numSets = Math.max(prev.length, 3); // At least 3 sets
        for (let i = 0; i < numSets; i++) {
          addSet(sessionId, ex.id, 0, 0, "normal");
        }
      }

      setScreenState("active");
    },
    [startSession, getTemplateExercises, getPreviousSets, addSet],
  );

  const handleDeleteTemplate = useCallback(
    (id: number) => {
      Alert.alert("Delete Template", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteTemplate(id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]);
    },
    [deleteTemplate],
  );

  const handleAddSet = useCallback(
    (exerciseId: number) => {
      if (!activeSession) return;
      addSet(activeSession.id, exerciseId, 0, 0, "normal");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [activeSession, addSet],
  );

  const handleCompleteSet = useCallback(
    (setId: number) => {
      const isPR = completeSet(setId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (isPR) {
        setSessionPRSetIds((prev) => new Set([...prev, setId]));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Auto-start rest timer
      startRestTimer(DEFAULT_REST_SECONDS);
    },
    [completeSet, startRestTimer],
  );

  const handleFinishWorkout = useCallback(() => {
    if (!activeSession) return;

    // Check if any sets were completed
    const sessionSets = getSessionSets(activeSession.id);
    const completedSets = sessionSets.filter((s_) => s_.completed);
    if (completedSets.length === 0) {
      Alert.alert(
        "No Sets Completed",
        "Complete at least one set before finishing.",
      );
      return;
    }

    // Calculate and persist XP: 50 base + 20 per set + 100 per PR
    const totalSets = completedSets.length;
    const prCount = sessionPRSetIds.size;
    const totalXP = 50 + totalSets * 20 + prCount * 100;
    awardXP(getTodayKey(), "workout_complete", totalXP);

    endSession(activeSession.id);
    setSummarySessionId(activeSession.id);
    setScreenState("summary");
    cancelRestTimer();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [activeSession, endSession, getSessionSets, cancelRestTimer, sessionPRSetIds, awardXP]);

  const handleCancelWorkout = useCallback(() => {
    Alert.alert(
      "Cancel Workout",
      "Are you sure? All progress will be lost.",
      [
        { text: "Keep Going", style: "cancel" },
        {
          text: "Cancel Workout",
          style: "destructive",
          onPress: () => {
            cancelSession();
            cancelRestTimer();
            setScreenState("default");
            setSessionPRSetIds(new Set());
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Warning,
            );
          },
        },
      ],
    );
  }, [cancelSession, cancelRestTimer]);

  const handleQuickAdd = useCallback(() => {
    const name = quickName.trim();
    if (!name) {
      Alert.alert("Error", "Enter an exercise name.");
      return;
    }
    const id = addExercise(name, quickMuscle, quickEquipment);
    setSelectedExerciseIds((prev) => new Set([...prev, id]));
    setQuickName("");
    setShowQuickAdd(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [quickName, quickMuscle, quickEquipment, addExercise]);

  const toggleExercise = useCallback((id: number) => {
    setSelectedExerciseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    Haptics.selectionAsync();
  }, []);

  const handleDismissSummary = useCallback(() => {
    setScreenState("default");
    setSummarySessionId(null);
    setSessionPRSetIds(new Set());
  }, []);

  // ═════════════════════════════════════════════════════════════════════════
  // ─── STATE 3: WORKOUT SUMMARY ─────────────────────────────────────────
  // Note: Summary view is ephemeral by design. If the app is backgrounded
  // and the component unmounts, the summary screen state is lost. Workout
  // data is already persisted — only the transient summary UI is affected.
  // ═════════════════════════════════════════════════════════════════════════

  if (screenState === "summary" && summarySessionId) {
    const session = sessions.find((s_) => s_.id === summarySessionId);
    const sessionSets = getSessionSets(summarySessionId);
    const completedSets = sessionSets.filter((s_) => s_.completed);
    const totalSets = completedSets.length;
    const summaryVolume = completedSets.reduce(
      (sum, s_) => sum + s_.weight * s_.reps,
      0,
    );
    const duration =
      session && session.endedAt ? session.endedAt - session.startedAt : 0;
    const prCount = sessionPRSetIds.size;

    // XP calculation: 50 base + 20 per set + 100 per PR
    const baseXP = 50;
    const setXP = totalSets * 20;
    const prXP = prCount * 100;
    const totalXP = baseXP + setXP + prXP;

    // Exercise breakdown
    const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
    const exerciseIds = [...new Set(completedSets.map((s_) => s_.exerciseId))];

    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <FlatList
          data={exerciseIds}
          keyExtractor={(id) => id.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.summaryContent}
          ListHeaderComponent={
            <>
              <Animated.View entering={FadeInDown.duration(400)} style={s.summaryHeader}>
                <Animated.View entering={ZoomIn.delay(200).duration(500)}>
                  <Ionicons
                    name="trophy"
                    size={64}
                    color={colors.body}
                  />
                </Animated.View>
                <Text style={s.summaryTitle}>WORKOUT COMPLETE</Text>
                {session && (
                  <Text style={s.summarySubtitle}>{session.templateName}</Text>
                )}
              </Animated.View>

              {/* Stats Grid */}
              <Animated.View entering={FadeInDown.delay(100).duration(400)}>
                <Panel style={s.summaryStatsPanel} glowColor={colors.body}>
                  <View style={s.summaryStatsGrid}>
                    <View style={s.summaryStatItem}>
                      <Text style={s.summaryStatValue}>
                        {formatDuration(duration)}
                      </Text>
                      <Text style={s.summaryStatLabel}>DURATION</Text>
                    </View>
                    <View style={s.summaryStatItem}>
                      <Text style={s.summaryStatValue}>
                        {summaryVolume.toLocaleString()}
                      </Text>
                      <Text style={s.summaryStatLabel}>VOLUME (KG)</Text>
                    </View>
                    <View style={s.summaryStatItem}>
                      <Text style={s.summaryStatValue}>{totalSets}</Text>
                      <Text style={s.summaryStatLabel}>SETS</Text>
                    </View>
                    <View style={s.summaryStatItem}>
                      <Text
                        style={[
                          s.summaryStatValue,
                          prCount > 0 && { color: colors.warning },
                        ]}
                      >
                        {prCount}
                      </Text>
                      <Text style={s.summaryStatLabel}>PRs</Text>
                    </View>
                  </View>
                </Panel>
              </Animated.View>

              {/* XP Earned */}
              <Animated.View entering={FadeInDown.delay(200).duration(400)}>
                <Panel style={s.xpPanel} glowColor={colors.body}>
                  <Text style={s.xpTitle}>XP EARNED</Text>
                  <Text style={s.xpTotal}>+{totalXP} XP</Text>
                  <View style={s.xpBreakdown}>
                    <View style={s.xpRow}>
                      <Text style={s.xpLabel}>Workout Complete</Text>
                      <Text style={s.xpValue}>+{baseXP}</Text>
                    </View>
                    <View style={s.xpRow}>
                      <Text style={s.xpLabel}>
                        {totalSets} Sets Completed
                      </Text>
                      <Text style={s.xpValue}>+{setXP}</Text>
                    </View>
                    {prCount > 0 && (
                      <View style={s.xpRow}>
                        <Text style={[s.xpLabel, { color: colors.warning }]}>
                          {prCount} Personal Record{prCount !== 1 ? "s" : ""}
                        </Text>
                        <Text style={[s.xpValue, { color: colors.warning }]}>
                          +{prXP}
                        </Text>
                      </View>
                    )}
                  </View>
                </Panel>
              </Animated.View>

              <SectionHeader
                title="Exercise Breakdown"
                accentColor={colors.body}
              />
            </>
          }
          renderItem={({ item: exId, index }) => {
            const exercise = exerciseMap.get(exId);
            if (!exercise) return null;
            const exSets = completedSets
              .filter((s_) => s_.exerciseId === exId)
              .sort((a, b) => a.setIndex - b.setIndex);
            const bestSet = exSets.reduce(
              (best, s_) =>
                s_.weight * s_.reps > (best?.weight ?? 0) * (best?.reps ?? 0)
                  ? s_
                  : best,
              exSets[0],
            );

            return (
              <Animated.View
                entering={FadeInDown.delay(300 + index * 50).duration(300)}
              >
                <Panel style={s.summaryExerciseCard}>
                  <Text style={s.summaryExName}>{exercise.name}</Text>
                  {exSets.map((gs) => (
                    <View key={gs.id} style={s.summarySetRow}>
                      <Text style={s.summarySetNum}>Set {gs.setIndex}</Text>
                      <Text
                        style={[
                          s.summarySetDetail,
                          gs.id === bestSet?.id && {
                            color: colors.body,
                            fontWeight: "700",
                          },
                        ]}
                      >
                        {gs.weight} kg x {gs.reps}
                      </Text>
                      {gs.id === bestSet?.id && (
                        <Text style={s.bestSetBadge}>BEST</Text>
                      )}
                    </View>
                  ))}
                </Panel>
              </Animated.View>
            );
          }}
          ListFooterComponent={
            <Pressable
              style={s.doneBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                handleDismissSummary();
              }}
            >
              <Text style={s.doneBtnText}>Done</Text>
            </Pressable>
          }
        />
      </SafeAreaView>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ─── STATE 2: ACTIVE WORKOUT ──────────────────────────────────────────
  // ═════════════════════════════════════════════════════════════════════════

  if (screenState === "active" && activeSession) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        {/* Sticky header */}
        <View style={s.activeHeader}>
          <Pressable onPress={handleCancelWorkout} style={s.activeHeaderBtn}>
            <Ionicons name="close" size={22} color={colors.danger} />
          </Pressable>
          <View style={s.activeHeaderCenter}>
            <Text style={s.activeHeaderTitle} numberOfLines={1}>
              {activeSession.templateName}
            </Text>
            <Text style={s.activeHeaderTimer}>
              {formatElapsed(elapsed)}
            </Text>
          </View>
          <Pressable onPress={handleFinishWorkout} style={s.finishHeaderBtn}>
            <Text style={s.finishHeaderBtnText}>FINISH</Text>
          </Pressable>
        </View>

        {/* Rest timer overlay */}
        {restTimer.active && (
          <RestTimerOverlay
            remaining={restTimer.remaining}
            duration={restTimer.duration}
            onSkip={cancelRestTimer}
          />
        )}

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <FlatList
            data={activeExercises}
            keyExtractor={(ex) => ex.id.toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.activeContent}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: exercise }) => {
              const exerciseSets = activeSets
                .filter((s_) => s_.exerciseId === exercise.id)
                .sort((a, b) => a.setIndex - b.setIndex);
              const prevSets = previousSetsMap.get(exercise.id) ?? [];

              return (
                <ExerciseCard
                  exercise={exercise}
                  sets={exerciseSets}
                  previousSets={prevSets}
                  prRecord={personalRecords[exercise.id]}
                  sessionPRSetIds={sessionPRSetIds}
                  onUpdateSet={(setId, fields) => updateSet(setId, fields)}
                  onCompleteSet={handleCompleteSet}
                  onRemoveSet={(setId) => removeSet(setId)}
                  onAddSet={() => handleAddSet(exercise.id)}
                />
              );
            }}
            ListFooterComponent={
              <Pressable style={s.finishBtn} onPress={handleFinishWorkout}>
                <Ionicons name="checkmark-circle" size={22} color="#000" />
                <Text style={s.finishBtnText}>Finish Workout</Text>
              </Pressable>
            }
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ─── STATE 1: DEFAULT VIEW ────────────────────────────────────────────
  // ═════════════════════════════════════════════════════════════════════════

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          data={recentSessions}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.defaultContent}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <>
              {/* Header */}
              <View style={s.defaultHeader}>
                <Pressable onPress={() => router.back()} style={s.backBtn}>
                  <Ionicons
                    name="chevron-back"
                    size={24}
                    color={colors.text}
                  />
                </Pressable>
                <Text style={s.defaultHeaderTitle}>WORKOUTS</Text>
                <View style={{ width: 48 }} />
              </View>

              {/* Quick Stats */}
              <QuickStatsPanel
                totalWorkouts={totalWorkouts}
                weekWorkouts={weekWorkouts}
                totalVolume={totalVolume}
                streak={streak}
              />

              {/* Templates Section */}
              <SectionHeader
                title="Templates"
                accentColor={colors.body}
                right={`${templates.length}`}
              />

              {templates.length === 0 && !showCreateTemplate && (
                <Panel style={s.emptyPanel}>
                  <Ionicons
                    name="barbell-outline"
                    size={32}
                    color={colors.textMuted}
                  />
                  <Text style={s.emptyText}>No templates yet</Text>
                  <Text style={s.emptySubtext}>
                    Create a workout template to get started
                  </Text>
                </Panel>
              )}

              {templates.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  exerciseCount={templateExCounts[t.id] ?? 0}
                  exerciseNames={templateExNames[t.id] ?? ""}
                  lastPerformed={templateLastPerformed[t.id]}
                  onStart={() => handleStartSession(t.id)}
                  onDelete={() => handleDeleteTemplate(t.id)}
                />
              ))}

              {/* Create Template toggle */}
              {!showCreateTemplate && (
                <Pressable
                  style={s.createTemplateBtn}
                  onPress={() => {
                    setShowCreateTemplate(true);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={20}
                    color={colors.body}
                  />
                  <Text style={s.createTemplateBtnText}>Create Template</Text>
                </Pressable>
              )}

              {/* Create Template Form */}
              {showCreateTemplate && (
                <Panel style={s.formPanel}>
                  <Text style={s.formTitle}>New Template</Text>

                  <TextInput
                    style={s.formInput}
                    placeholder="Template name"
                    placeholderTextColor={colors.textMuted}
                    value={templateName}
                    onChangeText={setTemplateName}
                    autoFocus
                  />

                  <Text style={s.formSubtitle}>
                    Select Exercises ({selectedExerciseIds.size} selected)
                  </Text>

                  <ExercisePicker
                    exercises={exercises}
                    selectedIds={selectedExerciseIds}
                    onToggle={toggleExercise}
                    searchQuery={exerciseSearch}
                    onSearchChange={setExerciseSearch}
                  />

                  {/* Quick Add Exercise */}
                  {!showQuickAdd && (
                    <Pressable
                      style={s.quickAddToggle}
                      onPress={() => setShowQuickAdd(true)}
                    >
                      <Ionicons
                        name="add"
                        size={16}
                        color={colors.textSecondary}
                      />
                      <Text style={s.quickAddToggleText}>
                        Quick Add Exercise
                      </Text>
                    </Pressable>
                  )}

                  {showQuickAdd && (
                    <View style={s.quickAddForm}>
                      <TextInput
                        style={s.formInput}
                        placeholder="Exercise name"
                        placeholderTextColor={colors.textMuted}
                        value={quickName}
                        onChangeText={setQuickName}
                      />

                      <Text style={s.chipLabel}>Muscle Group</Text>
                      <FlatList
                        data={MUSCLE_GROUPS}
                        horizontal
                        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
                        keyExtractor={(item) => item}
                        style={s.chipScroll}
                        renderItem={({ item: mg }) => (
                          <Pressable
                            style={[
                              s.chip,
                              quickMuscle === mg && s.chipActive,
                            ]}
                            onPress={() => setQuickMuscle(mg)}
                          >
                            <Text
                              style={[
                                s.chipText,
                                quickMuscle === mg && s.chipTextActive,
                              ]}
                            >
                              {mg}
                            </Text>
                          </Pressable>
                        )}
                      />

                      <Text style={s.chipLabel}>Equipment</Text>
                      <FlatList
                        data={EQUIPMENT_LIST}
                        horizontal
                        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
                        keyExtractor={(item) => item}
                        style={s.chipScroll}
                        renderItem={({ item: eq }) => (
                          <Pressable
                            style={[
                              s.chip,
                              quickEquipment === eq && s.chipActive,
                            ]}
                            onPress={() => setQuickEquipment(eq)}
                          >
                            <Text
                              style={[
                                s.chipText,
                                quickEquipment === eq && s.chipTextActive,
                              ]}
                            >
                              {eq}
                            </Text>
                          </Pressable>
                        )}
                      />

                      <Pressable
                        style={s.quickAddSaveBtn}
                        onPress={handleQuickAdd}
                      >
                        <Text style={s.quickAddSaveBtnText}>Add Exercise</Text>
                      </Pressable>
                    </View>
                  )}

                  {/* Form actions */}
                  <View style={s.formActions}>
                    <Pressable
                      style={s.formCancelBtn}
                      onPress={() => {
                        setShowCreateTemplate(false);
                        setTemplateName("");
                        setSelectedExerciseIds(new Set());
                        setExerciseSearch("");
                        setShowQuickAdd(false);
                      }}
                    >
                      <Text style={s.formCancelBtnText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={s.formSaveBtn}
                      onPress={handleCreateTemplate}
                    >
                      <Text style={s.formSaveBtnText}>Save Template</Text>
                    </Pressable>
                  </View>
                </Panel>
              )}

              {/* Recent Workouts Section */}
              <SectionHeader
                title="Recent Workouts"
                accentColor={colors.body}
                right={`${recentSessions.length}`}
              />

              {recentSessions.length === 0 && (
                <Panel style={s.emptyPanel}>
                  <Text style={s.emptyText}>No workouts logged</Text>
                  <Text style={s.emptySubtext}>
                    Complete a workout to see it here
                  </Text>
                </Panel>
              )}
            </>
          }
          renderItem={({ item: session }) => {
            const stats = recentSessionStats[session.id] ?? {
              setCount: 0,
              volume: 0,
              duration: 0,
              prCount: 0,
            };
            return (
              <RecentCard
                session={session}
                setCount={stats.setCount}
                volume={stats.volume}
                duration={stats.duration}
                prCount={stats.prCount}
              />
            );
          }}
          ListFooterComponent={<View style={{ height: spacing["5xl"] }} />}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── STYLES ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  // ── Default View ──────────────────────────────────────────────────────
  defaultContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing["5xl"] },
  defaultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  backBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  defaultHeaderTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.body,
    letterSpacing: 3,
    textTransform: "uppercase",
  },

  // ── Quick Stats ───────────────────────────────────────────────────────
  quickStatsPanel: { marginBottom: spacing.md },
  quickStatsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  quickStatItem: { flex: 1, alignItems: "center" },

  // ── Template Cards ────────────────────────────────────────────────────
  templateCard: { marginBottom: spacing.sm, padding: 0 },
  templateCardInner: { flexDirection: "row" },
  templateAccent: {
    width: 3,
    backgroundColor: colors.body,
    borderTopLeftRadius: radius.xl,
    borderBottomLeftRadius: radius.xl,
  },
  templateContent: { flex: 1, padding: spacing.lg },
  templateTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  templateName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 2,
  },
  templateExercises: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  templateDeleteBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  templateBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  templateMeta: { flexDirection: "row", alignItems: "center" },
  templateMetaText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: MONO_FONT,
  },
  templateStartBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.body,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.sm,
    gap: 4,
  },
  templateStartBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#000",
    letterSpacing: 1,
  },

  // ── Create Template ───────────────────────────────────────────────────
  createTemplateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.bodyDim,
    borderRadius: radius.lg,
    borderStyle: "dashed",
  },
  createTemplateBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.body,
  },

  // ── Form ──────────────────────────────────────────────────────────────
  formPanel: { marginBottom: spacing.md },
  formTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.md,
  },
  formSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  formInput: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.sm,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  formActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  formCancelBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  formCancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  formSaveBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.body,
  },
  formSaveBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
  },

  // ── Exercise Picker ───────────────────────────────────────────────────
  searchInput: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.sm,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  groupTabs: { marginBottom: spacing.sm },
  groupTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    marginRight: spacing.sm,
  },
  groupTabActive: {
    backgroundColor: colors.bodyDim,
    borderColor: colors.body,
  },
  groupTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  groupTabTextActive: {
    color: colors.body,
  },
  exerciseList: { maxHeight: 300 },
  exercisePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
    borderRadius: radius.sm,
  },
  exercisePickerRowActive: {
    backgroundColor: colors.bodyDim,
  },
  exercisePickerInfo: { flex: 1 },
  exercisePickerName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  exercisePickerMeta: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  selectedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.body,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#000",
  },

  // ── Quick Add ─────────────────────────────────────────────────────────
  quickAddToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    gap: 4,
    marginTop: spacing.sm,
  },
  quickAddToggleText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  quickAddForm: { marginTop: spacing.sm },
  chipLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  chipScroll: { marginBottom: spacing.xs },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    marginRight: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.bodyDim,
    borderColor: colors.body,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  chipTextActive: {
    color: colors.body,
  },
  quickAddSaveBtn: {
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.bodyDim,
    borderWidth: 1,
    borderColor: colors.body,
    marginTop: spacing.sm,
  },
  quickAddSaveBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.body,
  },

  // ── Recent Cards ──────────────────────────────────────────────────────
  recentCard: { marginBottom: spacing.sm },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  recentName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  recentDate: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  recentStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  recentStatItem: { flex: 1, alignItems: "center" },
  recentStatValue: {
    fontFamily: MONO_FONT,
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  recentStatLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 2,
  },
  recentStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.surfaceBorder,
  },

  // ── Empty States ──────────────────────────────────────────────────────
  emptyPanel: {
    alignItems: "center",
    paddingVertical: spacing["2xl"],
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  emptySubtext: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: "center",
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ── Active Workout View ───────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════

  activeHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  activeHeaderBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  activeHeaderCenter: {
    flex: 1,
    alignItems: "center",
  },
  activeHeaderTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  activeHeaderTimer: {
    fontFamily: MONO_FONT,
    fontSize: 20,
    fontWeight: "700",
    color: colors.body,
    fontVariant: ["tabular-nums"],
    marginTop: 1,
  },
  finishHeaderBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.sm,
    backgroundColor: colors.body,
  },
  finishHeaderBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#000",
    letterSpacing: 1,
  },

  activeContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing["5xl"],
  },

  // ── Rest Timer ────────────────────────────────────────────────────────
  restTimerContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  restTimerPanel: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  restTimerLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  restTimerValue: {
    fontFamily: MONO_FONT,
    fontSize: 42,
    fontWeight: "300",
    color: colors.body,
    fontVariant: ["tabular-nums"],
    marginBottom: spacing.md,
  },
  restTimerTrack: {
    width: "80%",
    height: 4,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  restTimerFill: {
    height: "100%",
    backgroundColor: colors.body,
    borderRadius: radius.full,
  },
  restTimerSkipBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  restTimerSkipText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: 1,
  },

  // ── Exercise Card ─────────────────────────────────────────────────────
  exerciseCard: { marginBottom: spacing.md },
  exerciseCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  exerciseCardName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  muscleBadge: {
    backgroundColor: colors.bodyDim,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: "rgba(0,255,136,0.20)",
  },
  muscleBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.body,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // ── Set Table ─────────────────────────────────────────────────────────
  setTableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  setTableHeaderText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },

  // ── Active Set Row ────────────────────────────────────────────────────
  activeSetRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.03)",
  },
  activeSetRowCompleted: {
    opacity: 0.5,
  },
  activeSetNum: {
    width: 28,
    fontSize: 14,
    fontWeight: "700",
    fontFamily: MONO_FONT,
    color: colors.text,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  activeSetNumDone: {
    color: colors.body,
  },
  setTypePicker: {
    width: 32,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  setTypeText: {
    fontSize: 12,
    fontWeight: "800",
    fontFamily: MONO_FONT,
  },
  activeSetPrev: {
    flex: 1,
    fontSize: 12,
    fontFamily: MONO_FONT,
    color: "rgba(255,255,255,0.20)",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  activeSetInput: {
    width: 64,
    height: 32,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 6,
    color: colors.text,
    fontSize: 14,
    fontFamily: MONO_FONT,
    fontWeight: "600",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    marginHorizontal: 3,
    padding: 0,
  },
  activeSetInputDone: {
    backgroundColor: "rgba(0,255,136,0.06)",
    borderColor: "rgba(0,255,136,0.15)",
  },
  activeSetCheckCol: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.20)",
  },

  // ── Add Set / Finish ──────────────────────────────────────────────────
  addSetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    gap: 4,
    marginTop: spacing.sm,
  },
  addSetText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.body,
  },
  finishBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.body,
    paddingVertical: 14,
    borderRadius: radius.lg,
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  finishBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#000",
    letterSpacing: 0.5,
  },

  // ── PR Badge ──────────────────────────────────────────────────────────
  prBadge: {
    backgroundColor: "rgba(251,191,36,0.20)",
    borderWidth: 1,
    borderColor: colors.warning,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  prBadgeText: {
    fontSize: 7,
    fontWeight: "800",
    color: colors.warning,
    letterSpacing: 0.5,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ── Summary View ──────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════

  summaryContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing["5xl"],
  },
  summaryHeader: {
    alignItems: "center",
    paddingVertical: spacing["3xl"],
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.body,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginTop: spacing.lg,
  },
  summarySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  summaryStatsPanel: { marginBottom: spacing.md },
  summaryStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  summaryStatItem: {
    width: "50%",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  summaryStatValue: {
    fontFamily: MONO_FONT,
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  summaryStatLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: 4,
  },

  // ── XP Panel ──────────────────────────────────────────────────────────
  xpPanel: { marginBottom: spacing.md },
  xpTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  xpTotal: {
    fontFamily: MONO_FONT,
    fontSize: 32,
    fontWeight: "800",
    color: colors.body,
    fontVariant: ["tabular-nums"],
    marginBottom: spacing.md,
  },
  xpBreakdown: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingTop: spacing.sm,
  },
  xpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  xpLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  xpValue: {
    fontFamily: MONO_FONT,
    fontSize: 13,
    fontWeight: "700",
    color: colors.body,
    fontVariant: ["tabular-nums"],
  },

  // ── Exercise Breakdown ────────────────────────────────────────────────
  summaryExerciseCard: { marginBottom: spacing.sm },
  summaryExName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  summarySetRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
  },
  summarySetNum: {
    width: 60,
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: MONO_FONT,
  },
  summarySetDetail: {
    flex: 1,
    fontSize: 14,
    fontFamily: MONO_FONT,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  bestSetBadge: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.body,
    letterSpacing: 1,
  },

  // ── Done Button ───────────────────────────────────────────────────────
  doneBtn: {
    backgroundColor: colors.body,
    paddingVertical: 14,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xl,
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#000",
    letterSpacing: 0.5,
  },
});
