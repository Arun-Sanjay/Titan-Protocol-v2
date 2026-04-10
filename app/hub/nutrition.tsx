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
import Svg, { Circle } from "react-native-svg";
import Animated, { FadeInDown, FadeInRight, ZoomIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, fonts } from "../../src/theme";
import { Panel } from "../../src/components/ui/Panel";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { MetricValue } from "../../src/components/ui/MetricValue";
import { getTodayKey } from "../../src/lib/date";
import {
  useNutritionStore,
  computeTDEE,
  computeDayMacros,
  type NutritionProfile as LegacyNutritionProfile,
  type Meal,
  type QuickMeal,
} from "../../src/stores/useNutritionStore";
import { useWeightLogs } from "../../src/hooks/queries/useWeight";
import {
  useNutritionProfile,
  useUpsertNutritionProfile,
  useMealLogs,
  useCreateMealLog,
  useDeleteMealLog,
} from "../../src/hooks/queries/useNutrition";
import type { NutritionProfile as CloudNutritionProfile, MealLog } from "../../src/services/nutrition";

// ─── Constants ──────────────────────────────────────────────────────────────

const MONO_FONT = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

const ACTIVITY_LEVELS = [
  { label: "Sedentary", value: 1.2 },
  { label: "Light", value: 1.375 },
  { label: "Moderate", value: 1.55 },
  { label: "Active", value: 1.725 },
  { label: "Very Active", value: 1.9 },
] as const;

const GOALS = [
  { label: "Cut", value: "cut" as const },
  { label: "Maintain", value: "maintain" as const },
  { label: "Bulk", value: "bulk" as const },
] as const;

const RING_SIZE = 150;
const STROKE_WIDTH = 12;
const RING_RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// Water ring
const WATER_RING_SIZE = 80;
const WATER_STROKE = 6;
const WATER_RADIUS = (WATER_RING_SIZE - WATER_STROKE) / 2;
const WATER_CIRCUMFERENCE = 2 * Math.PI * WATER_RADIUS;

// ─── Profile Setup Component ────────────────────────────────────────────────

function ProfileSetup({
  onSave,
  initialProfile,
}: {
  onSave: (profile: LegacyNutritionProfile) => void;
  initialProfile?: LegacyNutritionProfile | null;
}) {
  const [height, setHeight] = useState(initialProfile ? String(initialProfile.height_cm) : "");
  const [weight, setWeight] = useState(initialProfile ? String(initialProfile.weight_kg) : "");
  const [age, setAge] = useState(initialProfile ? String(initialProfile.age) : "");
  const [sex, setSex] = useState<"male" | "female">(initialProfile?.sex ?? "male");
  const [activity, setActivity] = useState(initialProfile?.activity_multiplier ?? 1.55);
  const [goal, setGoal] = useState<"cut" | "bulk" | "maintain">(initialProfile?.goal ?? "maintain");

  const previewProfile = useMemo((): LegacyNutritionProfile | null => {
    const h = parseFloat(height);
    const w = parseFloat(weight);
    const a = parseInt(age, 10);
    if (isNaN(h) || isNaN(w) || isNaN(a)) return null;
    if (h < 50 || h > 300 || w < 20 || w > 500 || a < 10 || a > 120)
      return null;

    const tdee = computeTDEE({
      height_cm: h,
      weight_kg: w,
      age: a,
      sex,
      activity_multiplier: activity,
      goal,
      calorie_target: 0,
      protein_g: 0,
    });

    const goalOffset = goal === "cut" ? -500 : goal === "bulk" ? 300 : 0;
    let calorie_target = tdee + goalOffset;
    calorie_target = Math.max(calorie_target, sex === "female" ? 1200 : 1500);
    const protein_g = Math.round(w * 2.0);

    return {
      height_cm: h,
      weight_kg: w,
      age: a,
      sex,
      activity_multiplier: activity,
      goal,
      calorie_target,
      protein_g,
    };
  }, [height, weight, age, sex, activity, goal]);

  const handleSave = () => {
    if (!previewProfile) return;
    onSave(previewProfile);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <>
      <SectionHeader title="Profile Setup" />
      <Panel>
        <Text style={styles.fieldLabel}>Height (cm)</Text>
        <TextInput
          style={styles.input}
          placeholder="175"
          placeholderTextColor={colors.textMuted}
          value={height}
          onChangeText={setHeight}
          keyboardType="decimal-pad"
          maxLength={5}
        />

        <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>Weight (kg)</Text>
        <TextInput
          style={styles.input}
          placeholder="75"
          placeholderTextColor={colors.textMuted}
          value={weight}
          onChangeText={setWeight}
          keyboardType="decimal-pad"
          maxLength={6}
        />

        <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>Age</Text>
        <TextInput
          style={styles.input}
          placeholder="25"
          placeholderTextColor={colors.textMuted}
          value={age}
          onChangeText={setAge}
          keyboardType="number-pad"
          maxLength={3}
        />

        <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>Sex</Text>
        <View style={styles.segmentRow}>
          {(["male", "female"] as const).map((s) => (
            <Pressable
              key={s}
              style={[styles.segmentBtn, sex === s && styles.segmentBtnActive]}
              onPress={() => { setSex(s); Haptics.selectionAsync(); }}
            >
              <Text style={[styles.segmentText, sex === s && styles.segmentTextActive]}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>Activity Level</Text>
        <View style={styles.activityList}>
          {ACTIVITY_LEVELS.map((level) => (
            <Pressable
              key={level.value}
              style={[styles.activityItem, activity === level.value && styles.activityItemActive]}
              onPress={() => { setActivity(level.value); Haptics.selectionAsync(); }}
            >
              <Text style={[styles.activityText, activity === level.value && styles.activityTextActive]}>
                {level.label}
              </Text>
              <Text style={styles.activityMult}>{level.value}x</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>Goal</Text>
        <View style={styles.segmentRow}>
          {GOALS.map((g) => (
            <Pressable
              key={g.value}
              style={[styles.segmentBtn, goal === g.value && styles.segmentBtnActive]}
              onPress={() => { setGoal(g.value); Haptics.selectionAsync(); }}
            >
              <Text style={[styles.segmentText, goal === g.value && styles.segmentTextActive]}>
                {g.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {previewProfile && (
          <View style={styles.previewBox}>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>TDEE</Text>
              <Text style={styles.previewValue}>{computeTDEE(previewProfile)} cal</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Daily Target</Text>
              <Text style={[styles.previewValue, { color: colors.body }]}>
                {previewProfile.calorie_target} cal
              </Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Protein Target</Text>
              <Text style={[styles.previewValue, { color: colors.mind }]}>
                {previewProfile.protein_g}g
              </Text>
            </View>
          </View>
        )}

        <Pressable
          style={[styles.primaryBtn, !previewProfile && styles.btnDisabled]}
          onPress={handleSave}
          disabled={!previewProfile}
        >
          <Text style={styles.primaryBtnText}>Save Profile</Text>
        </Pressable>
      </Panel>
    </>
  );
}

// ─── Macro Bar ───────────────────────────────────────────────────────────────

function MacroBar({
  label,
  current,
  target,
  unit,
  color,
}: {
  label: string;
  current: number;
  target: number;
  unit: string;
  color: string;
}) {
  if (target <= 0) return null; // Hide bar when target is 0 (e.g. protein cals exceed total)
  const pct = Math.min(current / target, 1);

  return (
    <View style={styles.macroBarWrap}>
      <View style={styles.macroBarHeader}>
        <Text style={styles.macroBarLabel}>{label}</Text>
        <Text style={styles.macroBarValue}>
          {current}
          <Text style={styles.macroBarTarget}> / {target}{unit}</Text>
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: color }]}
        />
      </View>
    </View>
  );
}

// ─── Water Ring ──────────────────────────────────────────────────────────────

const WaterRing = React.memo(function WaterRing({
  glasses,
  target,
  onAdd,
  onRemove,
}: {
  glasses: number;
  target: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const pct = target > 0 ? Math.min(glasses / target, 1) : 0;
  const offset = WATER_CIRCUMFERENCE * (1 - pct);
  const ml = glasses * 250;

  return (
    <View style={styles.waterContainer}>
      <View style={styles.waterRingWrap}>
        <Svg width={WATER_RING_SIZE} height={WATER_RING_SIZE}>
          <Circle
            cx={WATER_RING_SIZE / 2}
            cy={WATER_RING_SIZE / 2}
            r={WATER_RADIUS}
            stroke={colors.surfaceBorder}
            strokeWidth={WATER_STROKE}
            fill="none"
          />
          <Circle
            cx={WATER_RING_SIZE / 2}
            cy={WATER_RING_SIZE / 2}
            r={WATER_RADIUS}
            stroke={colors.charisma}
            strokeWidth={WATER_STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={WATER_CIRCUMFERENCE}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${WATER_RING_SIZE / 2} ${WATER_RING_SIZE / 2})`}
          />
        </Svg>
        <View style={styles.waterCenter}>
          <Ionicons name="water" size={16} color={colors.charisma} />
          <Text style={styles.waterValue}>{glasses}</Text>
        </View>
      </View>
      <View style={styles.waterInfo}>
        <Text style={styles.waterMl}>{ml}ml</Text>
        <Text style={styles.waterTarget}>/ {target * 250}ml</Text>
        <View style={styles.waterBtns}>
          <Pressable
            onPress={() => { onRemove(); Haptics.selectionAsync(); }}
            style={styles.waterBtn}
          >
            <Ionicons name="remove" size={18} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            onPress={() => { onAdd(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            style={[styles.waterBtn, styles.waterBtnActive]}
          >
            <Ionicons name="add" size={18} color={colors.charisma} />
          </Pressable>
        </View>
      </View>
    </View>
  );
});

// ─── Quick Meal Card ─────────────────────────────────────────────────────────

const QuickMealCard = React.memo(function QuickMealCard({
  meal,
  onUse,
  onDelete,
}: {
  meal: QuickMeal;
  onUse: () => void;
  onDelete: () => void;
}) {
  return (
    <Pressable
      onPress={onUse}
      onLongPress={() => {
        Alert.alert("Delete Quick Meal", `Remove "${meal.name}" from favorites?`, [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: onDelete },
        ]);
      }}
      style={styles.quickMealCard}
    >
      <Text style={styles.quickMealName} numberOfLines={1}>{meal.name}</Text>
      <Text style={styles.quickMealCal}>{meal.calories} cal</Text>
      <View style={styles.quickMealMacros}>
        <Text style={[styles.quickMealMacro, { color: colors.mind }]}>P{meal.protein_g}</Text>
        <Text style={[styles.quickMealMacro, { color: colors.charisma }]}>C{meal.carbs_g}</Text>
        <Text style={[styles.quickMealMacro, { color: colors.warning }]}>F{meal.fat_g}</Text>
      </View>
    </Pressable>
  );
});

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function NutritionScreen() {
  const router = useRouter();

  const [appActive, setAppActive] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setAppActive((c) => c + 1);
    });
    return () => sub.remove();
  }, []);
  const todayKey = useMemo(() => getTodayKey(), [appActive]);

  // Cloud hooks for profile and meals
  const { data: cloudProfile } = useNutritionProfile();
  const upsertProfileMut = useUpsertNutritionProfile();
  const { data: cloudMealLogs = [] } = useMealLogs(todayKey);
  const createMealMut = useCreateMealLog();
  const deleteMealMut = useDeleteMealLog();

  // Adapt cloud profile to legacy shape for computeTDEE and other pure helpers
  const profile: LegacyNutritionProfile | null = useMemo(() => {
    if (!cloudProfile) return null;
    return {
      height_cm: cloudProfile.height_cm ?? 0,
      weight_kg: 0, // will be overridden by weight logs below
      age: cloudProfile.age ?? 25,
      sex: (cloudProfile.sex ?? "male") as "male" | "female",
      activity_multiplier: cloudProfile.tdee && cloudProfile.bmr && cloudProfile.bmr > 0
        ? cloudProfile.tdee / cloudProfile.bmr
        : 1.55,
      goal: (cloudProfile.goal ?? "maintain") as "cut" | "bulk" | "maintain",
      calorie_target: cloudProfile.daily_calorie_target ?? 2000,
      protein_g: cloudProfile.protein_target_g ?? 150,
    };
  }, [cloudProfile]);

  // Weight sync: check weight from cloud weight logs
  const { data: weightLogs = [] } = useWeightLogs();
  const latestWeight = useMemo(() => {
    if (weightLogs.length === 0) return null;
    return weightLogs[weightLogs.length - 1];
  }, [weightLogs]);

  // Quick meals and water remain on MMKV
  const quickMeals = useNutritionStore((s) => s.quickMeals);
  const waterLog = useNutritionStore((s) => s.waterLog);
  const waterTarget = useNutritionStore((s) => s.waterTarget);
  const loadQuickMeals = useNutritionStore((s) => s.loadQuickMeals);
  const addQuickMeal = useNutritionStore((s) => s.addQuickMeal);
  const deleteQuickMeal = useNutritionStore((s) => s.deleteQuickMeal);
  const loadWater = useNutritionStore((s) => s.loadWater);
  const addWaterFn = useNutritionStore((s) => s.addWater);
  const removeWaterFn = useNutritionStore((s) => s.removeWater);

  const [showMealForm, setShowMealForm] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showWeightSync, setShowWeightSync] = useState(false);
  const [saveAsQuick, setSaveAsQuick] = useState(false);
  const [mealName, setMealName] = useState("");
  const [mealCalories, setMealCalories] = useState("");
  const [mealProtein, setMealProtein] = useState("");
  const [mealCarbs, setMealCarbs] = useState("");
  const [mealFat, setMealFat] = useState("");

  // Load MMKV-backed data (quick meals, water)
  useEffect(() => {
    loadQuickMeals();
    loadWater(todayKey);
  }, [todayKey, loadQuickMeals, loadWater]);

  // Check if weight tracker has a newer weight than the profile
  useEffect(() => {
    if (!profile || !latestWeight) return;
    if (Math.abs(latestWeight.weight_kg - profile.weight_kg) >= 1) {
      setShowWeightSync(true);
    }
  }, [profile, latestWeight]);

  // Adapt cloud meal logs to legacy Meal shape for computeDayMacros
  const todayMeals: Meal[] = useMemo(
    () => cloudMealLogs.map((log) => ({
      id: log.id as unknown as number, // Meal type expects number id
      name: log.name,
      calories: log.calories,
      protein_g: log.protein_g,
      carbs_g: log.carbs_g,
      fat_g: log.fat_g,
    })),
    [cloudMealLogs],
  );
  const dayMacros = useMemo(() => computeDayMacros(todayMeals), [todayMeals]);
  const todayWater = waterLog[todayKey] ?? 0;

  const calPct = profile && profile.calorie_target > 0 && dayMacros.calories >= 0
    ? Math.min(dayMacros.calories / profile.calorie_target, 1)
    : 0;
  const safeCalPct = Number.isFinite(calPct) ? calPct : 0;
  const caloriesRemaining = profile && profile.calorie_target > 0
    ? profile.calorie_target - dayMacros.calories
    : 0;

  const macroTargets = useMemo(() => {
    if (!profile) return { protein: 150, carbs: 250, fat: 65 };
    // Cap protein calories at 40% of total to prevent carbs/fat from disappearing
    const maxProteinCals = profile.calorie_target * 0.4;
    const proteinCals = Math.min(profile.protein_g * 4, maxProteinCals);
    const effectiveProtein = Math.round(proteinCals / 4);
    const remainingCals = Math.max(0, profile.calorie_target - proteinCals);
    const carbsCals = remainingCals * 0.55;
    const fatCals = remainingCals * 0.45;
    return {
      protein: effectiveProtein,
      carbs: Math.max(20, Math.round(carbsCals / 4)),
      fat: Math.max(10, Math.round(fatCals / 9)),
    };
  }, [profile]);

  const ringOffset = CIRCUMFERENCE * (1 - safeCalPct);

  const handleAddMeal = useCallback(() => {
    const cal = parseInt(mealCalories, 10);
    if (!mealName.trim() || isNaN(cal)) return;
    if (cal < 0) return;

    const mealData = {
      name: mealName.trim(),
      calories: cal,
      protein_g: Math.max(0, parseInt(mealProtein, 10) || 0),
      carbs_g: Math.max(0, parseInt(mealCarbs, 10) || 0),
      fat_g: Math.max(0, parseInt(mealFat, 10) || 0),
    };

    createMealMut.mutate({
      dateKey: todayKey,
      name: mealData.name,
      calories: mealData.calories,
      proteinG: mealData.protein_g,
      carbsG: mealData.carbs_g,
      fatG: mealData.fat_g,
    });

    // Save as quick meal if toggled
    if (saveAsQuick) {
      addQuickMeal(mealData);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMealName("");
    setMealCalories("");
    setMealProtein("");
    setMealCarbs("");
    setMealFat("");
    setSaveAsQuick(false);
    setShowMealForm(false);
  }, [mealName, mealCalories, mealProtein, mealCarbs, mealFat, todayKey, createMealMut, saveAsQuick, addQuickMeal]);

  const handleUseQuickMeal = useCallback(
    (qm: QuickMeal) => {
      createMealMut.mutate({
        dateKey: todayKey,
        name: qm.name,
        calories: qm.calories,
        proteinG: qm.protein_g,
        carbsG: qm.carbs_g,
        fatG: qm.fat_g,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [todayKey, createMealMut],
  );

  const handleDeleteMeal = useCallback(
    (mealId: string) => {
      Alert.alert("Delete Meal", "Remove this meal?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteMealMut.mutate(mealId);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ]);
    },
    [deleteMealMut],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Nutrition</Text>
        {profile && (
          <Pressable
            onPress={() => setShowEditProfile(!showEditProfile)}
            style={styles.backBtn}
          >
            <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
          </Pressable>
        )}
        {!profile && <View style={{ width: 48 }} />}
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
          {/* ── No Profile: Setup ── */}
          {(!profile || showEditProfile) && (
            <ProfileSetup
              initialProfile={showEditProfile ? profile : null}
              onSave={(p) => {
                upsertProfileMut.mutate({
                  height_cm: p.height_cm,
                  age: p.age,
                  sex: p.sex,
                  goal: p.goal,
                  daily_calorie_target: p.calorie_target,
                  protein_target_g: p.protein_g,
                  tdee: computeTDEE(p),
                  bmr: Math.round(computeTDEE(p) / p.activity_multiplier),
                });
                setShowEditProfile(false);
              }}
            />
          )}

          {/* ── Dashboard (profile exists) ── */}
          {profile && !showEditProfile && (
            <>
              {/* Weight sync banner */}
              {showWeightSync && latestWeight && (
                <Pressable
                  style={styles.syncBanner}
                  onPress={() => {
                    const updated = { ...profile, weight_kg: latestWeight.weight_kg };
                    const tdee = computeTDEE(updated);
                    const goalOffset = profile.goal === "cut" ? -500 : profile.goal === "bulk" ? 300 : 0;
                    const newCalTarget = Math.max(tdee + goalOffset, profile.sex === "female" ? 1200 : 1500);
                    const newProtein = Math.round(latestWeight.weight_kg * 2.0);
                    upsertProfileMut.mutate({
                      height_cm: profile.height_cm,
                      age: profile.age,
                      sex: profile.sex,
                      goal: profile.goal,
                      daily_calorie_target: newCalTarget,
                      protein_target_g: newProtein,
                      tdee,
                      bmr: Math.round(tdee / profile.activity_multiplier),
                    });
                    setShowWeightSync(false);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }}
                >
                  <Ionicons name="sync-outline" size={16} color={colors.charisma} />
                  <Text style={styles.syncBannerText}>
                    Weight tracker shows {latestWeight.weight_kg}kg (profile: {profile.weight_kg}kg). Tap to sync.
                  </Text>
                </Pressable>
              )}

              {/* Calorie Ring + Water */}
              <SectionHeader title="Daily Dashboard" />
              <Panel tone="hero" delay={0}>
                <View style={styles.dashRow}>
                  {/* Calorie Ring */}
                  <View style={styles.ringWrap}>
                    <Svg width={RING_SIZE} height={RING_SIZE}>
                      <Circle
                        cx={RING_SIZE / 2}
                        cy={RING_SIZE / 2}
                        r={RING_RADIUS}
                        stroke={colors.surfaceBorder}
                        strokeWidth={STROKE_WIDTH}
                        fill="none"
                      />
                      <Circle
                        cx={RING_SIZE / 2}
                        cy={RING_SIZE / 2}
                        r={RING_RADIUS}
                        stroke={
                          dayMacros.calories > profile.calorie_target
                            ? colors.danger
                            : colors.body
                        }
                        strokeWidth={STROKE_WIDTH}
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={CIRCUMFERENCE}
                        strokeDashoffset={ringOffset}
                        transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                      />
                    </Svg>
                    <View style={styles.ringCenter}>
                      <Text style={styles.ringValue}>{dayMacros.calories}</Text>
                      <Text style={styles.ringLabel}>/ {profile.calorie_target}</Text>
                      <Text style={styles.ringUnit}>cal</Text>
                    </View>
                  </View>

                  {/* Right info column */}
                  <View style={styles.dashInfo}>
                    <Text
                      style={[
                        styles.remainingValue,
                        {
                          color: caloriesRemaining < 0 ? colors.danger : colors.body,
                        },
                      ]}
                    >
                      {caloriesRemaining >= 0
                        ? caloriesRemaining
                        : `+${Math.abs(caloriesRemaining)}`}
                    </Text>
                    <Text style={styles.remainingLabel}>
                      {caloriesRemaining >= 0 ? "cal remaining" : "cal over target"}
                    </Text>

                    {/* Goal badge */}
                    <View style={[styles.goalBadge, {
                      backgroundColor:
                        profile.goal === "cut" ? colors.dangerDim
                          : profile.goal === "bulk" ? colors.bodyDim
                            : colors.primaryDim,
                    }]}>
                      <Text style={[styles.goalBadgeText, {
                        color:
                          profile.goal === "cut" ? colors.danger
                            : profile.goal === "bulk" ? colors.body
                              : colors.text,
                      }]}>
                        {profile.goal.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Macro Bars */}
                <View style={styles.macroBars}>
                  <MacroBar
                    label="Protein"
                    current={dayMacros.protein}
                    target={macroTargets.protein}
                    unit="g"
                    color={colors.mind}
                  />
                  <MacroBar
                    label="Carbs"
                    current={dayMacros.carbs}
                    target={macroTargets.carbs}
                    unit="g"
                    color={colors.charisma}
                  />
                  <MacroBar
                    label="Fat"
                    current={dayMacros.fat}
                    target={macroTargets.fat}
                    unit="g"
                    color={colors.warning}
                  />
                </View>
              </Panel>

              {/* ── Water Tracking ── */}
              <SectionHeader title="Water" />
              <Panel delay={100}>
                <WaterRing
                  glasses={todayWater}
                  target={waterTarget}
                  onAdd={() => addWaterFn(todayKey)}
                  onRemove={() => removeWaterFn(todayKey)}
                />
              </Panel>

              {/* ── Quick Meals ── */}
              {quickMeals.length > 0 && (
                <>
                  <SectionHeader title="Quick Add" right={`${quickMeals.length} saved`} />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.quickMealsScroll}
                    contentContainerStyle={styles.quickMealsContent}
                  >
                    {quickMeals.map((qm) => (
                      <QuickMealCard
                        key={qm.id}
                        meal={qm}
                        onUse={() => handleUseQuickMeal(qm)}
                        onDelete={() => deleteQuickMeal(qm.id)}
                      />
                    ))}
                  </ScrollView>
                </>
              )}

              {/* ── Add Meal ── */}
              {!showMealForm ? (
                <Pressable
                  style={styles.addMealBtn}
                  onPress={() => {
                    setShowMealForm(true);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Ionicons name="add-circle-outline" size={20} color={colors.body} />
                  <Text style={styles.addMealText}>Add Meal</Text>
                </Pressable>
              ) : (
                <Animated.View entering={FadeInDown.duration(300)}>
                  <SectionHeader title="Add Meal" />
                  <Panel>
                    <Text style={styles.fieldLabel}>Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Chicken & Rice"
                      placeholderTextColor={colors.textMuted}
                      value={mealName}
                      onChangeText={setMealName}
                    />

                    <View style={styles.macroInputRow}>
                      <View style={styles.macroInputCol}>
                        <Text style={styles.fieldLabel}>Calories</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="450"
                          placeholderTextColor={colors.textMuted}
                          value={mealCalories}
                          onChangeText={setMealCalories}
                          keyboardType="number-pad"
                        />
                      </View>
                      <View style={styles.macroInputCol}>
                        <Text style={styles.fieldLabel}>Protein (g)</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="35"
                          placeholderTextColor={colors.textMuted}
                          value={mealProtein}
                          onChangeText={setMealProtein}
                          keyboardType="number-pad"
                        />
                      </View>
                    </View>

                    <View style={styles.macroInputRow}>
                      <View style={styles.macroInputCol}>
                        <Text style={styles.fieldLabel}>Carbs (g)</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="50"
                          placeholderTextColor={colors.textMuted}
                          value={mealCarbs}
                          onChangeText={setMealCarbs}
                          keyboardType="number-pad"
                        />
                      </View>
                      <View style={styles.macroInputCol}>
                        <Text style={styles.fieldLabel}>Fat (g)</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="12"
                          placeholderTextColor={colors.textMuted}
                          value={mealFat}
                          onChangeText={setMealFat}
                          keyboardType="number-pad"
                        />
                      </View>
                    </View>

                    {/* Save as quick meal toggle */}
                    <Pressable
                      style={styles.quickSaveToggle}
                      onPress={() => {
                        setSaveAsQuick(!saveAsQuick);
                        Haptics.selectionAsync();
                      }}
                    >
                      <Ionicons
                        name={saveAsQuick ? "bookmark" : "bookmark-outline"}
                        size={18}
                        color={saveAsQuick ? colors.body : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.quickSaveText,
                          saveAsQuick && { color: colors.body },
                        ]}
                      >
                        Save to Quick Meals
                      </Text>
                    </Pressable>

                    <View style={styles.formActions}>
                      <Pressable
                        style={styles.cancelFormBtn}
                        onPress={() => {
                          setShowMealForm(false);
                          setMealName("");
                          setMealCalories("");
                          setMealProtein("");
                          setMealCarbs("");
                          setMealFat("");
                          setSaveAsQuick(false);
                        }}
                      >
                        <Text style={styles.cancelFormText}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.primaryBtn,
                          { flex: 1 },
                          (!mealName.trim() || !mealCalories) && styles.btnDisabled,
                        ]}
                        onPress={handleAddMeal}
                        disabled={!mealName.trim() || !mealCalories}
                      >
                        <Text style={styles.primaryBtnText}>Save Meal</Text>
                      </Pressable>
                    </View>
                  </Panel>
                </Animated.View>
              )}

              {/* ── Today's Meals ── */}
              <SectionHeader
                title="Today's Meals"
                right={`${todayMeals.length} meals`}
              />
              {todayMeals.length === 0 ? (
                <Panel delay={200}>
                  <Text style={styles.emptyText}>No meals logged today</Text>
                  <Text style={styles.emptySub}>Tap "Add Meal" to start tracking</Text>
                </Panel>
              ) : (
                todayMeals.map((meal, i) => (
                  <Panel key={meal.id} style={styles.mealCard} delay={200 + i * 40}>
                    <View style={styles.mealTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.mealName}>{meal.name}</Text>
                        <Text style={styles.mealCal}>{meal.calories} cal</Text>
                      </View>
                      <Pressable
                        onPress={() => handleDeleteMeal(String(meal.id))}
                        style={styles.deleteBtn}
                        hitSlop={8}
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.danger} />
                      </Pressable>
                    </View>
                    <View style={styles.mealMacros}>
                      <Text style={[styles.mealMacro, { color: colors.mind }]}>
                        P {meal.protein_g}g
                      </Text>
                      <Text style={[styles.mealMacro, { color: colors.charisma }]}>
                        C {meal.carbs_g}g
                      </Text>
                      <Text style={[styles.mealMacro, { color: colors.warning }]}>
                        F {meal.fat_g}g
                      </Text>
                    </View>
                  </Panel>
                ))
              )}

              {/* ── Summary Stats ── */}
              <SectionHeader title="Summary" />
              <View style={styles.summaryRow}>
                <Panel style={styles.summaryCard} delay={300}>
                  <Ionicons name="flame-outline" size={18} color={colors.body} />
                  <MetricValue
                    label="Calories"
                    value={dayMacros.calories}
                    size="sm"
                    animated
                  />
                  <Text style={styles.summaryTarget}>/ {profile.calorie_target}</Text>
                </Panel>
                <Panel style={styles.summaryCard} delay={350}>
                  <Ionicons name="barbell-outline" size={18} color={colors.mind} />
                  <MetricValue
                    label="Protein"
                    value={`${dayMacros.protein}g`}
                    size="sm"
                    color={colors.mind}
                  />
                  <Text style={styles.summaryTarget}>/ {profile.protein_g}g</Text>
                </Panel>
              </View>
            </>
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

  // Form inputs
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
  },

  // Segment buttons
  segmentRow: { flexDirection: "row", gap: spacing.sm },
  segmentBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    alignItems: "center",
  },
  segmentBtnActive: {
    borderColor: colors.body,
    backgroundColor: colors.bodyDim,
  },
  segmentText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  segmentTextActive: { color: colors.body },

  // Activity
  activityList: { gap: spacing.xs },
  activityItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  activityItemActive: {
    borderColor: colors.body,
    backgroundColor: colors.bodyDim,
  },
  activityText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  activityTextActive: { color: colors.body },
  activityMult: { ...fonts.mono, fontSize: 12, color: colors.textMuted },

  // Preview
  previewBox: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    gap: spacing.sm,
  },
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  previewLabel: { fontSize: 13, color: colors.textSecondary },
  previewValue: { ...fonts.mono, fontSize: 15 },

  // Buttons
  primaryBtn: {
    backgroundColor: colors.body,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.xl,
  },
  primaryBtnText: { fontSize: 16, fontWeight: "700", color: "#000" },
  btnDisabled: { opacity: 0.4 },

  // Dashboard
  // Weight sync banner
  syncBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.charismaDim,
    borderWidth: 1,
    borderColor: colors.charisma + "30",
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  syncBannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.charisma,
    fontWeight: "500",
  },

  dashRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xl,
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ringCenter: {
    position: "absolute",
    alignItems: "center",
  },
  ringValue: {
    fontFamily: MONO_FONT,
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
  },
  ringLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  ringUnit: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  dashInfo: { flex: 1, alignItems: "center", gap: spacing.sm },
  remainingValue: {
    fontFamily: MONO_FONT,
    fontSize: 28,
    fontWeight: "800",
  },
  remainingLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
  },
  goalBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    marginTop: spacing.xs,
  },
  goalBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
  },

  // Macro bars
  macroBars: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  macroBarWrap: {},
  macroBarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  macroBarLabel: { fontSize: 13, fontWeight: "600", color: colors.text },
  macroBarValue: { ...fonts.mono, fontSize: 13 },
  macroBarTarget: { color: colors.textMuted },
  barTrack: {
    height: 8,
    backgroundColor: colors.surfaceBorder,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  barFill: {
    height: 8,
    borderRadius: radius.full,
  },

  // Water
  waterContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xl,
  },
  waterRingWrap: {
    width: WATER_RING_SIZE,
    height: WATER_RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  waterCenter: {
    position: "absolute",
    alignItems: "center",
  },
  waterValue: {
    fontFamily: MONO_FONT,
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginTop: 2,
  },
  waterInfo: { flex: 1, gap: 4 },
  waterMl: {
    fontFamily: MONO_FONT,
    fontSize: 18,
    fontWeight: "700",
    color: colors.charisma,
  },
  waterTarget: { fontSize: 12, color: colors.textMuted },
  waterBtns: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  waterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  waterBtnActive: {
    borderColor: colors.charisma + "40",
    backgroundColor: colors.charismaDim,
  },

  // Quick meals
  quickMealsScroll: { marginTop: spacing.sm },
  quickMealsContent: { gap: spacing.sm, paddingRight: spacing.lg },
  quickMealCard: {
    width: 120,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 4,
  },
  quickMealName: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  quickMealCal: {
    fontFamily: MONO_FONT,
    fontSize: 14,
    fontWeight: "700",
    color: colors.body,
  },
  quickMealMacros: { flexDirection: "row", gap: spacing.sm, marginTop: 4 },
  quickMealMacro: { fontFamily: MONO_FONT, fontSize: 10, fontWeight: "600" },

  // Add Meal button
  addMealBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.body,
    borderStyle: "dashed",
  },
  addMealText: { fontSize: 16, fontWeight: "600", color: colors.body },

  // Meal form
  macroInputRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  macroInputCol: { flex: 1 },
  quickSaveToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  quickSaveText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  formActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  cancelFormBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelFormText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },

  // Meal cards
  mealCard: { marginBottom: spacing.sm },
  mealTop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  mealName: { fontSize: 15, fontWeight: "600", color: colors.text },
  mealCal: { ...fonts.mono, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  deleteBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: colors.dangerDim,
  },
  mealMacros: {
    flexDirection: "row",
    gap: spacing.lg,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.panelBorder,
  },
  mealMacro: { ...fonts.mono, fontSize: 12 },

  // Summary
  summaryRow: { flexDirection: "row", gap: spacing.md },
  summaryCard: { flex: 1, alignItems: "center", gap: 4 },
  summaryTarget: { fontSize: 12, color: colors.textMuted },

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
