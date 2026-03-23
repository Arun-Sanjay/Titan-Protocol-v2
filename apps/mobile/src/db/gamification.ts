import { getDB } from "./database";
import type { UserProfile, XPEvent } from "./schema";

// ─── XP & Level System ────────────────────────────────────────────────────

const XP_PER_LEVEL = 500; // XP needed per level

export const RANKS = [
  { name: "Recruit", minLevel: 1, color: "#6B7280" },
  { name: "Soldier", minLevel: 5, color: "#A78BFA" },
  { name: "Captain", minLevel: 10, color: "#60A5FA" },
  { name: "Commander", minLevel: 20, color: "#34D399" },
  { name: "Titan", minLevel: 35, color: "#FBBF24" },
  { name: "Legend", minLevel: 50, color: "#F97316" },
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

export function xpForLevel(level: number): number {
  return level * XP_PER_LEVEL;
}

export function xpProgress(xp: number, level: number): number {
  const base = xpForLevel(level - 1) * (level - 1) / 2; // not exact, simplified
  const currentLevelXP = xp - (level - 1) * XP_PER_LEVEL;
  return Math.max(0, Math.min(1, currentLevelXP / XP_PER_LEVEL));
}

// ─── Profile ───────────────────────────────────────────────────────────────

export async function getProfile(): Promise<UserProfile> {
  const db = await getDB();
  const profile = await db.getFirstAsync<UserProfile>(
    "SELECT * FROM user_profile WHERE id = 'default'"
  );
  return profile || { id: "default", xp: 0, level: 1, streak: 0, best_streak: 0, last_active_date: "" };
}

export async function awardXP(dateKey: string, source: string, amount: number): Promise<UserProfile> {
  const db = await getDB();

  // Record XP event
  await db.runAsync(
    "INSERT INTO xp_events (date_key, source, amount, created_at) VALUES (?, ?, ?, ?)",
    [dateKey, source, amount, Date.now()]
  );

  // Update profile
  await db.runAsync(
    "UPDATE user_profile SET xp = xp + ? WHERE id = 'default'",
    [amount]
  );

  // Check for level up
  const profile = await getProfile();
  const newLevel = Math.floor(profile.xp / XP_PER_LEVEL) + 1;
  if (newLevel > profile.level) {
    await db.runAsync(
      "UPDATE user_profile SET level = ? WHERE id = 'default'",
      [newLevel]
    );
  }

  return getProfile();
}

// ─── Streak ────────────────────────────────────────────────────────────────

export async function updateStreak(dateKey: string): Promise<number> {
  const db = await getDB();
  const profile = await getProfile();

  // Calculate yesterday's date
  const today = new Date(dateKey);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);

  let newStreak: number;
  if (profile.last_active_date === yesterdayKey) {
    // Consecutive day
    newStreak = profile.streak + 1;
  } else if (profile.last_active_date === dateKey) {
    // Same day, no change
    newStreak = profile.streak;
  } else {
    // Streak broken
    newStreak = 1;
  }

  const newBest = Math.max(newStreak, profile.best_streak);

  await db.runAsync(
    "UPDATE user_profile SET streak = ?, best_streak = ?, last_active_date = ? WHERE id = 'default'",
    [newStreak, newBest, dateKey]
  );

  return newStreak;
}

// ─── XP amounts ────────────────────────────────────────────────────────────

export const XP_REWARDS = {
  MAIN_TASK: 20,
  SIDE_QUEST: 10,
  HABIT_COMPLETE: 5,
  JOURNAL_ENTRY: 15,
  STREAK_BONUS_7: 50,
  STREAK_BONUS_30: 200,
  PERFECT_DAY: 100, // All tasks done
} as const;

export async function getXPForDate(dateKey: string): Promise<number> {
  const db = await getDB();
  const result = await db.getFirstAsync<{ total: number }>(
    "SELECT COALESCE(SUM(amount), 0) as total FROM xp_events WHERE date_key = ?",
    [dateKey]
  );
  return result?.total ?? 0;
}
