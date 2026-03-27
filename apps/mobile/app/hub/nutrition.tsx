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
  Animated as RNAnimated,
  AppState,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, fonts } from "../../src/theme";
import { Panel } from "../../src/components/ui/Panel";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { getTodayKey } from "../../src/lib/date";
import {
  useNutritionStore,
  computeTDEE,
  computeDayMacros,
  type NutritionProfile,
  type Meal,
} from "../../src/stores/useNutritionStore";

// ─── Constants ──────────────────────────────────────────────────────────────

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

const RING_SIZE = 160;
const STROKE_WIDTH = 12;
const RING_RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// ─── Setup Form Component ───────────────────────────────────────────────────

// Bug 18: Accept optional initialProfile prop to pre-populate form
function ProfileSetup({
  onSave,
  initialProfile,
}: {
  onSave: (profile: NutritionProfile) => void;
  initialProfile?: NutritionProfile | null;
}) {
  const [height, setHeight] = useState(initialProfile ? String(initialProfile.height_cm) : "");
  const [weight, setWeight] = useState(initialProfile ? String(initialProfile.weight_kg) : "");
  const [age, setAge] = useState(initialProfile ? String(initialProfile.age) : "");
  const [sex, setSex] = useState<"male" | "female">(initialProfile?.sex ?? "male");
  const [activity, setActivity] = useState(initialProfile?.activity_multiplier ?? 1.55);
  const [goal, setGoal] = useState<"cut" | "bulk" | "maintain">(initialProfile?.goal ?? "maintain");

  const previewProfile = useMemo((): NutritionProfile | null => {
    const h = parseFloat(height);
    const w = parseFloat(weight);
    const a = parseInt(age, 10);
    if (isNaN(h) || isNaN(w) || isNaN(a) || h <= 0 || w <= 0 || a <= 0)
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
    // Bug 15: enforce calorie floor in preview too
    calorie_target = Math.max(calorie_target, sex === "female" ? 1200 : 1500);
    const protein_g = Math.round(w * 2.0); // 2g per kg

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
        {/* Height */}
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

        {/* Weight */}
        <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
          Weight (kg)
        </Text>
        <TextInput
          style={styles.input}
          placeholder="75"
          placeholderTextColor={colors.textMuted}
          value={weight}
          onChangeText={setWeight}
          keyboardType="decimal-pad"
          maxLength={6}
        />

        {/* Age */}
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

        {/* Sex */}
        <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>Sex</Text>
        <View style={styles.segmentRow}>
          {(["male", "female"] as const).map((s) => (
            <Pressable
              key={s}
              style={[
                styles.segmentBtn,
                sex === s && styles.segmentBtnActive,
              ]}
              onPress={() => {
                setSex(s);
                Haptics.selectionAsync();
              }}
            >
              <Text
                style={[
                  styles.segmentText,
                  sex === s && styles.segmentTextActive,
                ]}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Activity Level */}
        <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
          Activity Level
        </Text>
        <View style={styles.activityList}>
          {ACTIVITY_LEVELS.map((level) => (
            <Pressable
              key={level.value}
              style={[
                styles.activityItem,
                activity === level.value && styles.activityItemActive,
              ]}
              onPress={() => {
                setActivity(level.value);
                Haptics.selectionAsync();
              }}
            >
              <Text
                style={[
                  styles.activityText,
                  activity === level.value && styles.activityTextActive,
                ]}
              >
                {level.label}
              </Text>
              <Text style={styles.activityMult}>{level.value}x</Text>
            </Pressable>
          ))}
        </View>

        {/* Goal */}
        <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>Goal</Text>
        <View style={styles.segmentRow}>
          {GOALS.map((g) => (
            <Pressable
              key={g.value}
              style={[
                styles.segmentBtn,
                goal === g.value && styles.segmentBtnActive,
              ]}
              onPress={() => {
                setGoal(g.value);
                Haptics.selectionAsync();
              }}
            >
              <Text
                style={[
                  styles.segmentText,
                  goal === g.value && styles.segmentTextActive,
                ]}
              >
                {g.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* TDEE Preview */}
        {previewProfile && (
          <View style={styles.previewBox}>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>TDEE</Text>
              <Text style={styles.previewValue}>
                {computeTDEE(previewProfile)} cal
              </Text>
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

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function NutritionScreen() {
  const router = useRouter();

  // Bug 20: AppState listener for stale todayKey
  const [appActive, setAppActive] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setAppActive(c => c + 1);
    });
    return () => sub.remove();
  }, []);
  const todayKey = useMemo(() => getTodayKey(), [appActive]);

  const profile = useNutritionStore((s) => s.profile);
  const meals = useNutritionStore((s) => s.meals);
  const loadProfile = useNutritionStore((s) => s.loadProfile);
  const updateProfile = useNutritionStore((s) => s.updateProfile);
  const loadMeals = useNutritionStore((s) => s.loadMeals);
  const addMeal = useNutritionStore((s) => s.addMeal);
  const deleteMeal = useNutritionStore((s) => s.deleteMeal);

  const [showMealForm, setShowMealForm] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [mealName, setMealName] = useState("");
  const [mealCalories, setMealCalories] = useState("");
  const [mealProtein, setMealProtein] = useState("");
  const [mealCarbs, setMealCarbs] = useState("");
  const [mealFat, setMealFat] = useState("");

  // Bug 21: include todayKey and load functions in deps
  useEffect(() => {
    loadProfile();
    loadMeals(todayKey);
  }, [todayKey, loadProfile, loadMeals]);

  const todayMeals = meals[todayKey] ?? [];
  const dayMacros = useMemo(() => computeDayMacros(todayMeals), [todayMeals]);

  // Bug 19: Guard against NaN ring offset when calorie_target is 0
  const calPct = profile && profile.calorie_target > 0
    ? Math.min(dayMacros.calories / profile.calorie_target, 1)
    : 0;
  const caloriesRemaining = profile
    ? profile.calorie_target - dayMacros.calories
    : 0;

  // Bug 16: Clamp remainingCals to prevent negative macro targets
  const macroTargets = useMemo(() => {
    if (!profile) return { protein: 150, carbs: 250, fat: 65 };
    const proteinCals = profile.protein_g * 4;
    const remainingCals = Math.max(0, profile.calorie_target - proteinCals);
    // Roughly 55% carbs, 45% fat of remaining
    const carbsCals = remainingCals * 0.55;
    const fatCals = remainingCals * 0.45;
    return {
      protein: profile.protein_g,
      carbs: Math.round(carbsCals / 4),
      fat: Math.round(fatCals / 9),
    };
  }, [profile]);

  // Bug 17: Validate negative calories and clamp macros
  const handleAddMeal = useCallback(() => {
    const cal = parseInt(mealCalories, 10);
    if (!mealName.trim() || isNaN(cal)) return;
    if (cal < 0) return;

    addMeal(todayKey, {
      name: mealName.trim(),
      calories: cal,
      protein_g: Math.max(0, parseInt(mealProtein, 10) || 0),
      carbs_g: Math.max(0, parseInt(mealCarbs, 10) || 0),
      fat_g: Math.max(0, parseInt(mealFat, 10) || 0),
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMealName("");
    setMealCalories("");
    setMealProtein("");
    setMealCarbs("");
    setMealFat("");
    setShowMealForm(false);
  }, [mealName, mealCalories, mealProtein, mealCarbs, mealFat, todayKey, addMeal]);

  const handleDeleteMeal = useCallback(
    (mealId: number) => {
      deleteMeal(todayKey, mealId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    [todayKey, deleteMeal],
  );

  const ringOffset = CIRCUMFERENCE * (1 - calPct);

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
              // Bug 18: pass existing profile as initialProfile
              initialProfile={showEditProfile ? profile : null}
              onSave={(p) => {
                updateProfile(p);
                setShowEditProfile(false);
              }}
            />
          )}

          {/* ── Dashboard (profile exists) ── */}
          {profile && !showEditProfile && (
            <>
              {/* Calorie Ring */}
              <SectionHeader title="Daily Dashboard" />
              <Panel style={styles.dashPanel}>
                <View style={styles.ringRow}>
                  {/* SVG Ring */}
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
                      <Text style={styles.ringLabel}>
                        / {profile.calorie_target}
                      </Text>
                      <Text style={styles.ringUnit}>cal</Text>
                    </View>
                  </View>

                  {/* Remaining */}
                  <View style={styles.ringInfo}>
                    <Text
                      style={[
                        styles.remainingValue,
                        {
                          color:
                            caloriesRemaining < 0
                              ? colors.danger
                              : colors.body,
                        },
                      ]}
                    >
                      {caloriesRemaining >= 0
                        ? caloriesRemaining
                        : `+${Math.abs(caloriesRemaining)}`}
                    </Text>
                    <Text style={styles.remainingLabel}>
                      {caloriesRemaining >= 0
                        ? "cal remaining"
                        : "cal over target"}
                    </Text>
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
                    color={colors.general}
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
                <>
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
                        }}
                      >
                        <Text style={styles.cancelFormText}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.primaryBtn,
                          { flex: 1 },
                          (!mealName.trim() || !mealCalories) &&
                            styles.btnDisabled,
                        ]}
                        onPress={handleAddMeal}
                        disabled={!mealName.trim() || !mealCalories}
                      >
                        <Text style={styles.primaryBtnText}>Save Meal</Text>
                      </Pressable>
                    </View>
                  </Panel>
                </>
              )}

              {/* ── Today's Meals ── */}
              <SectionHeader
                title="Today's Meals"
                right={`${todayMeals.length} meals`}
              />
              {todayMeals.length === 0 ? (
                <Panel>
                  <Text style={styles.emptyText}>No meals logged today</Text>
                  <Text style={styles.emptySub}>
                    Tap "Add Meal" to start tracking
                  </Text>
                </Panel>
              ) : (
                todayMeals.map((meal) => (
                  <Panel key={meal.id} style={styles.mealCard}>
                    <View style={styles.mealTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.mealName}>{meal.name}</Text>
                        <Text style={styles.mealCal}>
                          {meal.calories} cal
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handleDeleteMeal(meal.id)}
                        style={styles.deleteBtn}
                        hitSlop={8}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color={colors.danger}
                        />
                      </Pressable>
                    </View>
                    <View style={styles.mealMacros}>
                      <Text style={[styles.mealMacro, { color: colors.mind }]}>
                        P {meal.protein_g}g
                      </Text>
                      <Text
                        style={[styles.mealMacro, { color: colors.general }]}
                      >
                        C {meal.carbs_g}g
                      </Text>
                      <Text
                        style={[styles.mealMacro, { color: colors.warning }]}
                      >
                        F {meal.fat_g}g
                      </Text>
                    </View>
                  </Panel>
                ))
              )}

              {/* ── Summary Stats ── */}
              <SectionHeader title="Summary" />
              <View style={styles.summaryRow}>
                <Panel style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Calories</Text>
                  <Text style={styles.summaryValue}>
                    {dayMacros.calories}
                  </Text>
                  <Text style={styles.summaryTarget}>
                    / {profile.calorie_target}
                  </Text>
                </Panel>
                <Panel style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Protein</Text>
                  <Text style={[styles.summaryValue, { color: colors.mind }]}>
                    {dayMacros.protein}g
                  </Text>
                  <Text style={styles.summaryTarget}>
                    / {profile.protein_g}g
                  </Text>
                </Panel>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── MacroBar Sub-Component ─────────────────────────────────────────────────

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
  const pct = target > 0 ? Math.min(current / target, 1) : 0;

  return (
    <View style={styles.macroBarWrap}>
      <View style={styles.macroBarHeader}>
        <Text style={styles.macroBarLabel}>{label}</Text>
        <Text style={styles.macroBarValue}>
          {current}
          <Text style={styles.macroBarTarget}>
            {" "}
            / {target}
            {unit}
          </Text>
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${pct * 100}%`, backgroundColor: color },
          ]}
        />
      </View>
    </View>
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
  segmentRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
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
  segmentText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
  },
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

  // Preview box
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
  dashPanel: { paddingVertical: spacing.xl },
  ringRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
    ...fonts.monoValue,
    fontSize: 22,
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
  ringInfo: { alignItems: "center" },
  remainingValue: {
    ...fonts.monoValue,
    fontSize: 28,
  },
  remainingLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: "center",
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
  addMealText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.body,
  },

  // Meal form
  macroInputRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  macroInputCol: { flex: 1 },
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
  summaryCard: { flex: 1, alignItems: "center", gap: 2 },
  summaryLabel: {
    ...fonts.kicker,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  summaryValue: { ...fonts.monoValue },
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
