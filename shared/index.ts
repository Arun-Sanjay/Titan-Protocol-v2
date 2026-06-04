/**
 * @titan/shared — Pure-logic, types, and static game data.
 *
 * This package no longer contains services, React Query hooks, or auth
 * context. Mobile uses its own local-first SQLite service layer; web
 * uses its own (mirrored from mobile). What remains here is the stuff
 * that's genuinely platform-neutral:
 *
 *   - Supabase client factory + regenerated Database types
 *     (still needed — both apps hit Supabase for auth + manual backup)
 *   - Pure scoring / ranking / date / SRS / XP logic
 *   - Static game data (JSON + hand-written TS)
 *   - Gamification constants (RANKS, DAILY_RANKS)
 *   - Zod schemas + error-logger hook
 *
 * Usage:
 *   import { supabase, initSupabase } from "@titan/shared/lib/supabase";
 *   import { calculateWeightedTitanScore } from "@titan/shared/lib/scoring-v2";
 *   import { getDailyRank } from "@titan/shared/db/gamification";
 *   import type { EngineKey } from "@titan/shared/types/game";
 *   import type { Tables } from "@titan/shared/types/supabase";
 */

// ─── Supabase client ─────────────────────────────────────────────────────────
export { initSupabase, supabase, requireUserId, ensureProfileRow } from "./lib/supabase";
export type { SupabaseInitOptions } from "./lib/supabase";

// ─── Zod schemas + error logger ──────────────────────────────────────────────
export { setErrorLogger, parseOrFallback } from "./lib/schemas";

// ─── Types ──────────────────────────────────────────────────────────────────
export type { Archetype, EngineKey, TaskKind, AppMode, DailyGrade } from "./types/game";

// ─── Pure Logic ─────────────────────────────────────────────────────────────
export { calculateWeightedTitanScore } from "./lib/scoring-v2";
export {
  getTodayKey,
  toLocalDateKey,
  addDays,
  formatDateDisplay,
  formatDateShort,
  getGreeting,
  getDayOfWeek,
  getMonthKey,
  getMonthLabel,
} from "./lib/date";
export { RANKS, DAILY_RANKS, getDailyRank, getRankForLevel } from "./db/gamification";
