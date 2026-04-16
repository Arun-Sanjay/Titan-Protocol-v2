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
import Animated, {
  FadeInDown,
  ZoomIn,
} from "react-native-reanimated";
import { colors, spacing, radius, fonts } from "../../src/theme";
import { Panel } from "../../src/components/ui/Panel";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { PageHeader } from "../../src/components/ui/PageHeader";
import { MetricValue } from "../../src/components/ui/MetricValue";
// Phase 5: cloud-backed hooks replace local Zustand store.
import {
  useGymSessions,
  useActiveGymSession,
  useStartGymSession,
  useEndGymSession,
  useDeleteGymSession,
  useGymSets,
  useAddGymSet,
  useUpdateGymSet,
  useDeleteGymSet,
  useGymExercises,
  useCreateGymExercise,
  useGymTemplates,
  useCreateGymTemplate,
  useDeleteGymTemplate,
  useGymPersonalRecords,
  useUpsertGymPR,
} from "../../src/hooks/queries/useGym";
import type {
  GymSession,
  GymSet,
  GymExercise,
  GymTemplate,
  GymPersonalRecord,
} from "../../src/services/gym";
// Constants/UI-only types still from the barrel (pure data, no store).
import {
  type SetType,
  type MuscleGroup,
  MUSCLE_GROUPS,
  EQUIPMENT_LIST,
} from "../../src/lib/gym-helpers";
import { getTodayKey } from "../../src/lib/date";
// Phase 3.5d: XP writes go through the cloud mutation.
import { useAwardXP } from "../../src/hooks/queries/useProfile";
import { useEnqueueRankUp } from "../../src/hooks/queries/useRankUps";

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
  setType: SetType;
  completed: boolean;
  previousWeight?: number;
  previousReps?: number;
  isPR: boolean;
  onUpdate: (fields: { weight?: number; reps?: number; setType?: SetType; notes?: string }) => void;
  onComplete: () => void;
  onRemove: () => void;
};

const ActiveSetRow = React.memo(function ActiveSetRow({
  gymSet,
  setType,
  completed,
  previousWeight,
  previousReps,
  isPR,
  onUpdate,
  onComplete,
  onRemove,
}: ActiveSetRowProps) {
  const w = gymSet.weight ?? 0;
  const r = gymSet.reps ?? 0;
  const [weight, setWeight] = useState(
    w > 0 ? w.toString() : "",
  );
  const [reps, setReps] = useState(
    r > 0 ? r.toString() : "",
  );
  const weightFocusedRef = useRef(false);
  const repsFocusedRef = useRef(false);

  // Sync from query data on external changes when not actively editing
  useEffect(() => {
    if (!weightFocusedRef.current) {
      const val = gymSet.weight ?? 0;
      setWeight(val > 0 ? val.toString() : "");
    }
  }, [gymSet.weight]);

  useEffect(() => {
    if (!repsFocusedRef.current) {
      const val = gymSet.reps ?? 0;
      setReps(val > 0 ? val.toString() : "");
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
      style={[s.activeSetRow, completed && s.activeSetRowCompleted]}
    >
      {/* Set number */}
      <Text style={[s.activeSetNum, completed && s.activeSetNumDone]}>
        {gymSet.set_index}
      </Text>

      {/* Type */}
      <SetTypePicker
        value={setType}
        onChange={(type) => onUpdate({ setType: type })}
      />

      {/* Previous */}
      <Text style={s.activeSetPrev}>{prevText}</Text>

      {/* Weight input */}
      <TextInput
        style={[s.activeSetInput, completed && s.activeSetInputDone]}
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
        style={[s.activeSetInput, completed && s.activeSetInputDone]}
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
        {completed ? (
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
  exercise: GymExercise;
  sets: GymSet[];
  previousSets: GymSet[];
  prRecord: GymPersonalRecord | undefined;
  completedSetIds: Set<string>;
  setTypeMap: Record<string, SetType>;
  sessionPRSetIds: Set<string>;
  onUpdateSet: (
    setId: string,
    fields: { weight?: number; reps?: number; setType?: SetType; notes?: string },
  ) => void;
  onCompleteSet: (setId: string) => void;
  onRemoveSet: (setId: string) => void;
  onAddSet: () => void;
};

const ExerciseCard = React.memo(function ExerciseCard({
  exercise,
  sets,
  previousSets,
  prRecord,
  completedSetIds,
  setTypeMap,
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
          <Text style={s.muscleBadgeText}>{exercise.muscle_group ?? ""}</Text>
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
        const prevSet = previousSets.find((p) => p.set_index === gs.set_index);
        return (
          <ActiveSetRow
            key={gs.id}
            gymSet={gs}
            setType={setTypeMap[gs.id] ?? "normal"}
            completed={completedSetIds.has(gs.id)}
            previousWeight={prevSet?.weight ?? undefined}
            previousReps={prevSet?.reps ?? undefined}
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
  template: GymTemplate;
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
          <Text style={s.recentName}>{session.name ?? "Workout"}</Text>
          <Text style={s.recentDate}>
            {formatDateLong(session.date_key)}
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
  exercises: GymExercise[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
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
      list = list.filter((e) => e.muscle_group === activeGroup);
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

      {/* Exercise list — scrollable independently */}
      <ScrollView
        style={s.exerciseList}
        nestedScrollEnabled
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
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
                  {ex.muscle_group ?? ""} / {ex.equipment ?? ""}
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
      </ScrollView>
    </View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// ─── MAIN SCREEN ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

export default function WorkoutsScreen() {
  const router = useRouter();

  // ─── Cloud data via React Query hooks ────────────────────────────────────
  const { data: exercises = [] } = useGymExercises();
  const { data: templates = [] } = useGymTemplates();
  const { data: sessions = [] } = useGymSessions();
  const { data: activeSessionData } = useActiveGymSession();
  const { data: personalRecordsList = [] } = useGymPersonalRecords();

  // Active session sets (only fetch when there's an active session)
  const activeSessionId = activeSessionData?.id ?? null;
  const { data: activeSetsRaw = [] } = useGymSets(activeSessionId ?? "");

  // Build a lookup of PRs by exercise_name for quick access
  const personalRecords = useMemo(() => {
    const map: Record<string, GymPersonalRecord> = {};
    for (const pr of personalRecordsList) {
      const existing = map[pr.exercise_name];
      if (!existing || pr.weight > existing.weight) {
        map[pr.exercise_name] = pr;
      }
    }
    return map;
  }, [personalRecordsList]);

  // ─── Mutations ──────────────────────────────────────────────────────────
  const startSessionMut = useStartGymSession();
  const endSessionMut = useEndGymSession();
  const deleteSessionMut = useDeleteGymSession();
  const addSetMut = useAddGymSet();
  const updateSetMut = useUpdateGymSet();
  const deleteSetMut = useDeleteGymSet();
  const createTemplateMut = useCreateGymTemplate();
  const deleteTemplateMut = useDeleteGymTemplate();
  const createExerciseMut = useCreateGymExercise();
  const upsertPRMut = useUpsertGymPR();
  const awardXPMutation = useAwardXP();
  const enqueueRankUpMutation = useEnqueueRankUp();

  // ─── Rest timer (local state — real-time UI) ───────────────────────────
  const [restTimer, setRestTimer] = useState({ active: false, remaining: 0, duration: 0 });

  const startRestTimer = useCallback((seconds: number) => {
    setRestTimer({ active: true, remaining: seconds, duration: seconds });
  }, []);
  const cancelRestTimer = useCallback(() => {
    setRestTimer({ active: false, remaining: 0, duration: 0 });
  }, []);

  // ─── Completed/setType local state (UI only, not in Supabase) ──────────
  const [completedSetIds, setCompletedSetIds] = useState<Set<string>>(new Set());
  const [setTypeMap, setSetTypeMap] = useState<Record<string, SetType>>({});

  // ─── Local UI State ─────────────────────────────────────────────────────

  const [screenState, setScreenState] = useState<
    "default" | "active" | "summary"
  >("default");
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(
    new Set(),
  );
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickMuscle, setQuickMuscle] = useState<MuscleGroup>("chest");
  const [quickEquipment, setQuickEquipment] = useState("Barbell");
  const [summarySessionId, setSummarySessionId] = useState<string | null>(null);
  const [sessionPRSetIds, setSessionPRSetIds] = useState<Set<string>>(
    new Set(),
  );

  // Timer state
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Determine screen state from active session query
  useEffect(() => {
    if (activeSessionId !== null && screenState === "default") {
      setScreenState("active");
    } else if (activeSessionId === null && screenState === "active") {
      // Session was ended/cancelled externally
      setScreenState("default");
    }
  }, [activeSessionId]);

  // ─── Active session derived data ────────────────────────────────────────

  const activeSession = activeSessionData ?? null;

  // Resolve exercises for the active session's template
  const activeExercises = useMemo(() => {
    if (!activeSession?.template_id) return [];
    const tpl = templates.find((t) => t.id === activeSession.template_id);
    if (!tpl) return [];
    const ids = (tpl.exercise_ids ?? []) as string[];
    return ids
      .map((eid) => exercises.find((e) => e.id === eid))
      .filter(Boolean) as GymExercise[];
  }, [activeSession, templates, exercises]);

  // Active sets come from the query directly
  const activeSets = activeSetsRaw;

  // Previous sets for each exercise (for progressive overload display).
  // Look at the most recent completed session with the same template.
  const previousSetsMap = useMemo(() => {
    if (!activeSession?.template_id) return new Map<string, GymSet[]>();
    // We only have the sessions list; sets for previous sessions aren't
    // loaded via the hook (which is per-session). For now return empty —
    // progressive overload display will be wired later when we add a
    // dedicated query. This keeps the migration focused.
    return new Map<string, GymSet[]>();
  }, [activeSession]);

  // ─── Elapsed timer ──────────────────────────────────────────────────────

  useEffect(() => {
    if (activeSession) {
      const startMs = new Date(activeSession.started_at).getTime();
      const tick = () => setElapsed(Date.now() - startMs);
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
        setRestTimer((prev) => {
          if (prev.remaining <= 1) return { active: false, remaining: 0, duration: prev.duration };
          return { ...prev, remaining: prev.remaining - 1 };
        });
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
  }, [restTimer.active]);

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
        .filter((s_) => s_.ended_at !== null)
        .sort((a, b) =>
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
        )
        .slice(0, 10),
    [sessions],
  );

  // Exercise lookup map for templates
  const exerciseMap = useMemo(
    () => new Map(exercises.map((e) => [e.id, e])),
    [exercises],
  );

  const templateExCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of templates) {
      const ids = (t.exercise_ids ?? []) as string[];
      counts[t.id] = ids.filter((eid) => exerciseMap.has(eid)).length;
    }
    return counts;
  }, [templates, exerciseMap]);

  const templateExNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const t of templates) {
      const ids = (t.exercise_ids ?? []) as string[];
      names[t.id] = ids
        .map((eid) => exerciseMap.get(eid)?.name)
        .filter(Boolean)
        .join(", ");
    }
    return names;
  }, [templates, exerciseMap]);

  const templateLastPerformed = useMemo(() => {
    const result: Record<string, string | null> = {};
    for (const t of templates) {
      const lastSession = sessions
        .filter((s_) => s_.template_id === t.id && s_.ended_at !== null)
        .sort(
          (a, b) =>
            new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
        )[0];
      result[t.id] = lastSession ? formatDate(lastSession.date_key) : null;
    }
    return result;
  }, [templates, sessions]);

  // Stats for recent sessions. Since we don't load sets for past sessions
  // in bulk, we derive what we can from session-level data.
  const recentSessionStats = useMemo(() => {
    const stats: Record<
      string,
      { setCount: number; volume: number; duration: number; prCount: number }
    > = {};
    for (const session of recentSessions) {
      const startMs = new Date(session.started_at).getTime();
      const endMs = session.ended_at
        ? new Date(session.ended_at).getTime()
        : 0;
      const duration = endMs > startMs ? endMs - startMs : 0;
      // Without per-session sets loaded, show duration only.
      // Volume/set counts require a dedicated bulk query (future).
      stats[session.id] = {
        setCount: 0,
        volume: 0,
        duration,
        prCount: 0,
      };
    }
    return stats;
  }, [recentSessions]);

  const totalWorkouts = useMemo(
    () => sessions.filter((s_) => s_.ended_at !== null).length,
    [sessions],
  );
  const weekWorkouts = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return sessions.filter(
      (s_) =>
        s_.ended_at !== null &&
        new Date(s_.started_at).getTime() >= weekAgo.getTime(),
    ).length;
  }, [sessions]);
  // Total volume requires loading all sets — approximated as 0 until bulk query added.
  const totalVolume = 0;
  const streak = useMemo(() => {
    const completedDates = sessions
      .filter((s_) => s_.ended_at !== null)
      .map((s_) => s_.date_key)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort()
      .reverse();
    let count = 0;
    const today = getTodayKey();
    let expected = today;
    for (const dk of completedDates) {
      if (dk === expected) {
        count++;
        const d = new Date(expected + "T12:00:00");
        d.setDate(d.getDate() - 1);
        expected = d.toISOString().slice(0, 10);
      } else if (dk < expected) {
        break;
      }
    }
    return count;
  }, [sessions]);

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
    createTemplateMut.mutate(
      { name, exercise_ids: Array.from(selectedExerciseIds) },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTemplateName("");
          setSelectedExerciseIds(new Set());
          setExerciseSearch("");
          setShowCreateTemplate(false);
        },
      },
    );
  }, [templateName, selectedExerciseIds, createTemplateMut, templates]);

  const handleStartSession = useCallback(
    (templateId: string) => {
      const tpl = templates.find((t) => t.id === templateId);
      const tplName = tpl?.name ?? "Workout";
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setSessionPRSetIds(new Set());
      setCompletedSetIds(new Set());
      setSetTypeMap({});

      startSessionMut.mutate(
        { date_key: getTodayKey(), name: tplName, template_id: templateId },
        {
          onSuccess: (newSession) => {
            // Pre-populate 3 sets per exercise in the template
            const ids = (tpl?.exercise_ids ?? []) as string[];
            const exs = ids
              .map((eid) => exerciseMap.get(eid))
              .filter(Boolean) as GymExercise[];
            for (const ex of exs) {
              for (let i = 1; i <= 3; i++) {
                addSetMut.mutate({
                  session_id: newSession.id,
                  exercise_name: ex.name,
                  exercise_id: ex.id,
                  set_index: i,
                  weight: 0,
                  reps: 0,
                });
              }
            }
            setScreenState("active");
          },
        },
      );
    },
    [startSessionMut, addSetMut, templates, exerciseMap],
  );

  const handleDeleteTemplate = useCallback(
    (id: string) => {
      Alert.alert("Delete Template", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteTemplateMut.mutate(id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]);
    },
    [deleteTemplateMut],
  );

  const handleAddSet = useCallback(
    (exercise: GymExercise) => {
      if (!activeSession) return;
      // Determine next set_index for this exercise
      const exerciseSets = activeSets.filter((s_) => s_.exercise_id === exercise.id);
      const nextIndex = exerciseSets.length > 0
        ? Math.max(...exerciseSets.map((s_) => s_.set_index)) + 1
        : 1;
      addSetMut.mutate({
        session_id: activeSession.id,
        exercise_name: exercise.name,
        exercise_id: exercise.id,
        set_index: nextIndex,
        weight: 0,
        reps: 0,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [activeSession, activeSets, addSetMut],
  );

  const handleCompleteSet = useCallback(
    (setId: string) => {
      // Toggle completed state locally
      setCompletedSetIds((prev) => {
        const next = new Set(prev);
        if (next.has(setId)) {
          next.delete(setId);
          return next;
        }
        next.add(setId);
        return next;
      });

      // Check for PR: find the set, compare against known PRs
      const theSet = activeSets.find((s_) => s_.id === setId);
      if (theSet) {
        const w = theSet.weight ?? 0;
        const r = theSet.reps ?? 0;
        const existingPR = personalRecords[theSet.exercise_name];
        const isPR =
          w > 0 &&
          r > 0 &&
          (!existingPR || w * r > existingPR.weight * existingPR.reps);

        if (isPR) {
          setSessionPRSetIds((prev) => new Set([...prev, setId]));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          upsertPRMut.mutate({
            exercise_name: theSet.exercise_name,
            weight: w,
            reps: r,
          });
        }
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // Auto-start rest timer
      startRestTimer(DEFAULT_REST_SECONDS);
    },
    [activeSets, personalRecords, startRestTimer, upsertPRMut],
  );

  const handleFinishWorkout = useCallback(() => {
    if (!activeSession) return;

    // Check if any sets were completed
    const completedSets = activeSets.filter((s_) => completedSetIds.has(s_.id));
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
    awardXPMutation
      .mutateAsync(totalXP)
      .then((result) => {
        if (result.leveledUp) {
          return enqueueRankUpMutation.mutateAsync({
            fromLevel: result.fromLevel,
            toLevel: result.toLevel,
          });
        }
      })
      .catch(() => {
        // Non-fatal; workout is still recorded in Supabase.
      });

    endSessionMut.mutate(activeSession.id);
    setSummarySessionId(activeSession.id);
    setScreenState("summary");
    cancelRestTimer();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [activeSession, activeSets, completedSetIds, endSessionMut, cancelRestTimer, sessionPRSetIds, awardXPMutation, enqueueRankUpMutation]);

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
            if (activeSession) {
              deleteSessionMut.mutate(activeSession.id);
            }
            cancelRestTimer();
            setScreenState("default");
            setSessionPRSetIds(new Set());
            setCompletedSetIds(new Set());
            setSetTypeMap({});
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Warning,
            );
          },
        },
      ],
    );
  }, [activeSession, deleteSessionMut, cancelRestTimer]);

  const handleQuickAdd = useCallback(() => {
    const name = quickName.trim();
    if (!name) {
      Alert.alert("Error", "Enter an exercise name.");
      return;
    }
    createExerciseMut.mutate(
      { name, muscle_group: quickMuscle, equipment: quickEquipment },
      {
        onSuccess: (newExercise) => {
          setSelectedExerciseIds((prev) => new Set([...prev, newExercise.id]));
          setQuickName("");
          setShowQuickAdd(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    );
  }, [quickName, quickMuscle, quickEquipment, createExerciseMut]);

  const toggleExercise = useCallback((id: string) => {
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
    setCompletedSetIds(new Set());
    setSetTypeMap({});
  }, []);

  // ═════════════════════════════════════════════════════════════════════════
  // ─── STATE 3: WORKOUT SUMMARY ─────────────────────────────────────────
  // Note: Summary view is ephemeral by design. If the app is backgrounded
  // and the component unmounts, the summary screen state is lost. Workout
  // data is already persisted — only the transient summary UI is affected.
  // ═════════════════════════════════════════════════════════════════════════

  if (screenState === "summary" && summarySessionId) {
    const session = sessions.find((s_) => s_.id === summarySessionId);
    // Use activeSets for the just-finished session (still in cache)
    const sessionSets = activeSets;
    const completedSets = sessionSets.filter((s_) => completedSetIds.has(s_.id));
    const totalSets = completedSets.length;
    const summaryVolume = completedSets.reduce(
      (sum, s_) => sum + (s_.weight ?? 0) * (s_.reps ?? 0),
      0,
    );
    const startMs = session ? new Date(session.started_at).getTime() : 0;
    const endMs = session?.ended_at
      ? new Date(session.ended_at).getTime()
      : Date.now();
    const duration = endMs > startMs ? endMs - startMs : 0;
    const prCount = sessionPRSetIds.size;

    // XP calculation: 50 base + 20 per set + 100 per PR
    const baseXP = 50;
    const setXP = totalSets * 20;
    const prXP = prCount * 100;
    const totalXP = baseXP + setXP + prXP;

    // Exercise breakdown
    const summaryExerciseMap = new Map(exercises.map((e) => [e.id, e]));
    const exerciseIds = [...new Set(completedSets.map((s_) => s_.exercise_id).filter(Boolean))] as string[];

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
                  <Text style={s.summarySubtitle}>{session.name ?? "Workout"}</Text>
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
            const exercise = summaryExerciseMap.get(exId);
            if (!exercise) return null;
            const exSets = completedSets
              .filter((s_) => s_.exercise_id === exId)
              .sort((a, b) => a.set_index - b.set_index);
            const bestSet = exSets.reduce(
              (best, s_) =>
                (s_.weight ?? 0) * (s_.reps ?? 0) > (best?.weight ?? 0) * (best?.reps ?? 0)
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
                      <Text style={s.summarySetNum}>Set {gs.set_index}</Text>
                      <Text
                        style={[
                          s.summarySetDetail,
                          gs.id === bestSet?.id && {
                            color: colors.body,
                            fontWeight: "700",
                          },
                        ]}
                      >
                        {gs.weight ?? 0} kg x {gs.reps ?? 0}
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
              {activeSession.name ?? "Workout"}
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
                .filter((s_) => s_.exercise_id === exercise.id)
                .sort((a, b) => a.set_index - b.set_index);
              const prevSets = previousSetsMap.get(exercise.id) ?? [];

              return (
                <ExerciseCard
                  exercise={exercise}
                  sets={exerciseSets}
                  previousSets={prevSets}
                  prRecord={personalRecords[exercise.name]}
                  completedSetIds={completedSetIds}
                  setTypeMap={setTypeMap}
                  sessionPRSetIds={sessionPRSetIds}
                  onUpdateSet={(setId, fields) => {
                    // Update setType in local map if provided
                    if (fields.setType !== undefined) {
                      setSetTypeMap((prev) => ({ ...prev, [setId]: fields.setType! }));
                    }
                    // Persist weight/reps to Supabase
                    const updates: { weight?: number; reps?: number; notes?: string } = {};
                    if (fields.weight !== undefined) updates.weight = fields.weight;
                    if (fields.reps !== undefined) updates.reps = fields.reps;
                    if (fields.notes !== undefined) updates.notes = fields.notes;
                    if (Object.keys(updates).length > 0 && activeSession) {
                      updateSetMut.mutate({
                        setId,
                        sessionId: activeSession.id,
                        updates,
                      });
                    }
                  }}
                  onCompleteSet={handleCompleteSet}
                  onRemoveSet={(setId) => {
                    if (activeSession) {
                      deleteSetMut.mutate({ setId, sessionId: activeSession.id });
                    }
                  }}
                  onAddSet={() => handleAddSet(exercise)}
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
                        setSelectedExerciseIds(new Set<string>());
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
  exerciseList: { maxHeight: 400, borderRadius: radius.md, overflow: "hidden" },
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
