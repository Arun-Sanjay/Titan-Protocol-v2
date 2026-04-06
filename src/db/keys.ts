import type { EngineKey } from "./schema";

/**
 * Phase 2.2D: Central MMKV key registry.
 *
 * Single source of truth for every MMKV key used by the app. Prevents
 * typo bugs where a writer and reader used slightly different strings
 * (e.g. `tasks:${engine}` vs `task:${engine}`) and silently missed
 * persisted data. Also provides one place to audit the full surface
 * area of local storage before the Supabase migration in Phase 3.3.
 *
 * Templated keys are builder functions so the returned string is
 * always the canonical shape — impossible to forget the separator or
 * mistype the namespace.
 *
 * Most static keys become Supabase tables in Phase 3 — the registry
 * is transitional but still catches bugs today.
 */
export const K = {
  // ─── Core (templated) ────────────────────────────────────────────────────

  /** Per-engine task list. Stored as `Task[]`. */
  tasks: (engine: EngineKey) => `tasks:${engine}` as const,

  /** Per-engine per-day completion IDs. Stored as `number[]`. */
  completions: (engine: EngineKey, dateKey: string) =>
    `completions:${engine}:${dateKey}` as const,

  /** Per-day habit log IDs. Stored as `number[]`. */
  habitLogs: (dateKey: string) => `habit_logs:${dateKey}` as const,

  /** Per-day journal entry (plain text). */
  journal: (dateKey: string) => `journal:${dateKey}` as const,

  /** Legacy per-day protocol completion marker. */
  protocolCompletions: (dateKey: string) =>
    `protocol_completions:${dateKey}` as const,

  /** Per-engine stat counters. */
  stat: (engine: EngineKey) => `stat:${engine}` as const,

  /** Per-day morning protocol data. Stored as `MorningData`. */
  morning: (dateKey: string) => `morning_${dateKey}` as const,

  /** Per-day evening protocol data. Stored as `EveningData`. */
  evening: (dateKey: string) => `evening_${dateKey}` as const,

  // ─── Profile & progression (static) ──────────────────────────────────────

  userProfile: "user_profile",
  pendingRankUps: "pending_rank_ups",
  playerRank: "player_rank",
  progressionPhase: "progression_phase",
  firstActiveDate: "first_active_date",

  // ─── Protocol (static) ───────────────────────────────────────────────────

  protocolSessions: "protocol_sessions",
  protocolStreak: "protocol_streak",
  protocolStreakDate: "protocol_streak_date",
  protocolStreakPrevious: "protocol_streak_previous",
  protocolWritePending: "protocol_write_pending",

  // ─── Skill tree (static) ─────────────────────────────────────────────────

  skillTreeUnlocks: "skill_tree_unlocks",
  skillTreeProgress: "skill_tree_progress",

  // ─── Story & narrative (static) ──────────────────────────────────────────

  storyState: "story_state",
  userName: "user_name",
  narrativeEntries: "narrative_entries",

  // ─── Habits / goals (static) ─────────────────────────────────────────────

  habits: "habits",
  goals: "goals",

  // ─── Gym (static) ────────────────────────────────────────────────────────

  gymExercises: "gym_exercises",
  gymTemplates: "gym_templates",
  gymTemplateExercises: "gym_template_exercises",
  gymSessions: "gym_sessions",
  gymSets: "gym_sets",
  gymPRs: "gym_prs",

  // ─── Nutrition (static) ──────────────────────────────────────────────────

  nutritionProfile: "nutrition_profile",
  nutritionQuickMeals: "nutrition_quick_meals",
  nutritionWaterTarget: "nutrition_water_target",

  // ─── Weight (static) ─────────────────────────────────────────────────────

  weightEntries: "weight_entries",
  weightGoal: "weight_goal",

  // ─── Mind training (static) ──────────────────────────────────────────────

  exerciseHistory: "exercise_history",
  mindStats: "mind_stats",
  exercisesSeen: "exercises_seen",
  srsCards: "srs_cards",

  // ─── Modes & features (static) ───────────────────────────────────────────

  titanMode: "titan_mode",
  focusSettings: "focus_settings",
  bossChallenges: "boss_challenges",
  completedBossIds: "completed_boss_ids",
  consecutiveHighDays: "consecutive_high_days",
  fieldOpCooldown: "field_op_cooldown",
  selectedCurrency: "selected_currency",
  surpriseDoubleXpExpires: "surprise_double_xp_expires",
  firstTaskVoicePlayed: "first_task_voice_played",

  // ─── Internal ────────────────────────────────────────────────────────────

  idCounter: "id_counter",
} as const;
