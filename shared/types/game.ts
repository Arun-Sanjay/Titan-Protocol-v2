/**
 * Shared game types used across both platforms.
 *
 * These mirror the Supabase enum types but are defined here so
 * pure logic files (scoring, ranks, etc.) don't need to import
 * from the auto-generated supabase.ts.
 */

export type Archetype =
  | "titan"
  | "athlete"
  | "scholar"
  | "hustler"
  | "showman"
  | "warrior"
  | "founder"
  | "charmer";

export type EngineKey = "body" | "mind" | "money" | "charisma";

export type TaskKind = "main" | "secondary";

export type AppMode =
  | "full_protocol"
  | "structured"
  | "tracker"
  | "focus"
  | "zen"
  | "titan";

export type DailyGrade = "D" | "C" | "B" | "A" | "S" | "SS";
