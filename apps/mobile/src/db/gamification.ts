import { getJSON, setJSON } from "./storage";
import type { UserProfile } from "./schema";

const XP_PER_LEVEL = 500;

// Rank names and XP thresholds aligned with web version (CLAUDE.md)
// Initiate (0), Operator (500 XP), Specialist (1500 XP), Vanguard (3500 XP), Sentinel (7000 XP), Titan (15000 XP)
export const RANKS = [
  { name: "Initiate", minLevel: 1, color: "#6B7280" },    // 0 XP
  { name: "Operator", minLevel: 2, color: "#A78BFA" },    // 500 XP
  { name: "Specialist", minLevel: 4, color: "#60A5FA" },  // 1500 XP
  { name: "Vanguard", minLevel: 8, color: "#34D399" },    // 3500 XP
  { name: "Sentinel", minLevel: 15, color: "#FBBF24" },   // 7000 XP
  { name: "Titan", minLevel: 31, color: "#F97316" },      // 15000 XP
] as const;

export const DAILY_RANKS = [
  { letter: "D", min: 0, color: "#6B7280" },
  { letter: "C", min: 30, color: "#A78BFA" },
  { letter: "B", min: 50, color: "#60A5FA" },
  { letter: "A", min: 70, color: "#34D399" },
  { letter: "S", min: 85, color: "#FBBF24" },
  { letter: "SS", min: 95, color: "#F97316" },
] as const;

export function getDailyRank(score: number) {
  for (let i = DAILY_RANKS.length - 1; i >= 0; i--) {
    if (score >= DAILY_RANKS[i].min) return DAILY_RANKS[i];
  }
  return DAILY_RANKS[0];
}

export function getRankForLevel(level: number) {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (level >= RANKS[i].minLevel) return RANKS[i];
  }
  return RANKS[0];
}

// ─── Profile ───────────────────────────────────────────────────────────────

const PROFILE_KEY = "user_profile";

const DEFAULT_PROFILE: UserProfile = {
  id: "default",
  xp: 0,
  level: 1,
  streak: 0,
  best_streak: 0,
  last_active_date: "",
};

export function getProfile(): UserProfile {
  return getJSON<UserProfile>(PROFILE_KEY, DEFAULT_PROFILE);
}

function saveProfile(p: UserProfile): void {
  setJSON(PROFILE_KEY, p);
}

export function awardXP(dateKey: string, _source: string, amount: number): UserProfile {
  const profile = getProfile();
  profile.xp += amount;

  // Level up
  const newLevel = Math.floor(profile.xp / XP_PER_LEVEL) + 1;
  if (newLevel > profile.level) {
    profile.level = newLevel;
  }

  saveProfile(profile);
  return profile;
}

// ─── Streak ────────────────────────────────────────────────────────────────

export function updateStreak(dateKey: string): number {
  const profile = getProfile();

  const today = new Date(dateKey + "T00:00:00");
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  let newStreak: number;
  if (profile.last_active_date === yesterdayKey) {
    newStreak = profile.streak + 1;
  } else if (profile.last_active_date === dateKey) {
    newStreak = profile.streak;
  } else {
    newStreak = 1;
  }

  profile.streak = newStreak;
  profile.best_streak = Math.max(newStreak, profile.best_streak);
  profile.last_active_date = dateKey;
  saveProfile(profile);

  return newStreak;
}

export const XP_REWARDS = {
  MAIN_TASK: 20,
  SIDE_QUEST: 10,
  HABIT_COMPLETE: 5,
  JOURNAL_ENTRY: 15,
  STREAK_BONUS_7: 50,
  STREAK_BONUS_30: 200,
  PERFECT_DAY: 100,
} as const;
