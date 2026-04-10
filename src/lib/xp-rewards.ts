/**
 * Phase 4.1: XP reward constants extracted from useProfileStore so
 * screens can import them without pulling in the Zustand store.
 */

export const XP_REWARDS = {
  MAIN_TASK: 20,
  SIDE_QUEST: 10,
  HABIT_COMPLETE: 5,
  JOURNAL_ENTRY: 15,
  STREAK_BONUS_7: 50,
  STREAK_BONUS_30: 200,
  PERFECT_DAY: 100,
} as const;
