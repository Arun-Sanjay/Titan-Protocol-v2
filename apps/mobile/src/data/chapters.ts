/**
 * Chapter system — 6 chapters, 2 weeks each.
 * After Chapter 6: "Endgame" with harder targets.
 */

import { getJSON } from "../db/storage";

export type Chapter = {
  number: number;
  name: string;
  subtitle: string;
  weekStart: number;
  weekEnd: number;
  theme: string;
  bossName: string;
  bossDescription: string;
};

export const CHAPTERS: Chapter[] = [
  {
    number: 1,
    name: "The Awakening",
    subtitle: "Every legend starts somewhere.",
    weekStart: 1,
    weekEnd: 2,
    theme: "Build your first habits. Understand the system. Show up.",
    bossName: "First Blood",
    bossDescription: "Complete all 4 engines for 3 consecutive days.",
  },
  {
    number: 2,
    name: "The Foundation",
    subtitle: "Discipline is choosing between what you want now and what you want most.",
    weekStart: 3,
    weekEnd: 4,
    theme: "Solidify routines. Establish consistency. No days off.",
    bossName: "Iron Will",
    bossDescription: "7-day streak with all engines at 60%+.",
  },
  {
    number: 3,
    name: "The Grind",
    subtitle: "The gap between where you are and where you want to be is called discipline.",
    weekStart: 5,
    weekEnd: 6,
    theme: "Push harder. Build discipline. Outwork yesterday.",
    bossName: "Breaking Point",
    bossDescription: "14-day streak with one engine at 80%+.",
  },
  {
    number: 4,
    name: "The Breakthrough",
    subtitle: "You didn't come this far to only come this far.",
    weekStart: 7,
    weekEnd: 8,
    theme: "Level up. Unlock skill nodes. Prove your mastery.",
    bossName: "Skill Master",
    bossDescription: "Claim 4 skill tree nodes in any engine.",
  },
  {
    number: 5,
    name: "The Ascent",
    subtitle: "The view from the top was worth the climb.",
    weekStart: 9,
    weekEnd: 10,
    theme: "Peak performance. Dominate every engine.",
    bossName: "Peak Protocol",
    bossDescription: "All engines at 70%+ for 5 consecutive days.",
  },
  {
    number: 6,
    name: "Titan Mode",
    subtitle: "You are not the same person who started this.",
    weekStart: 11,
    weekEnd: 12,
    theme: "Full mastery. The endgame begins.",
    bossName: "The Titan Trial",
    bossDescription: "30-day streak with Titan Score 80%+.",
  },
];

const ENDGAME: Chapter = {
  number: 7,
  name: "Endgame",
  subtitle: "There is no finish line. Only the next level.",
  weekStart: 13,
  weekEnd: 999,
  theme: "Maintain excellence. Push new limits. Forever.",
  bossName: "Eternal",
  bossDescription: "Maintain Titan Score 85%+ for 14 consecutive days.",
};

/**
 * Get the current chapter based on day number (1-indexed).
 */
export function getCurrentChapter(dayNumber: number): Chapter {
  const weekNumber = Math.ceil(dayNumber / 7);
  for (const chapter of CHAPTERS) {
    if (weekNumber >= chapter.weekStart && weekNumber <= chapter.weekEnd) {
      return chapter;
    }
  }
  return ENDGAME;
}

/**
 * Get day number from first active date.
 * Includes dev_day_offset for testing (DEV skip-day button).
 */
export function getDayNumber(firstActiveDate: string | null): number {
  if (!firstActiveDate) return 1;
  const start = new Date(firstActiveDate + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const realDay = Math.max(1, Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1);

  // Add dev offset for testing (DEV skip-day button)
  const offset = getJSON<number>("dev_day_offset", 0);
  return realDay + offset;
}
