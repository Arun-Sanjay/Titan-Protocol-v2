/**
 * Phase 2.2C: Runtime schema validation at storage read boundaries.
 *
 * TypeScript gives us compile-time types but zero runtime guarantees
 * about MMKV data. If storage is corrupted, a schema migration was
 * missed, or a user rolled back to an older app version, reads can
 * return garbage that crashes the UI with cryptic property-access errors.
 *
 * Strategy: Zod schemas that MIRROR the types in src/db/schema.ts and
 * src/stores/*. Use them in `getJSONSafe()` (new) for critical reads
 * at layer boundaries. Validation failure → error-log → fall back to
 * default. This gives us:
 *   - Graceful degradation on corrupt data
 *   - Diagnostic visibility when unexpected shapes appear
 *   - A shared source of truth when Supabase arrives in Phase 3
 *     (same schemas can validate server responses)
 *
 * Zod is intentionally used only at READ boundaries, not in hot paths.
 * Writes trust TypeScript because we own the caller.
 */
import { z } from "zod";
import { logError } from "./error-log";

// ─── Engines & basic enums ──────────────────────────────────────────────────

export const EngineKeySchema = z.enum(["body", "mind", "money", "charisma"]);

export const TaskKindSchema = z.enum(["main", "secondary"]);

// ─── Core entities ───────────────────────────────────────────────────────────

export const TaskSchema = z.object({
  id: z.number().int().optional(),
  engine: EngineKeySchema,
  title: z.string(),
  kind: TaskKindSchema,
  created_at: z.number(),
  days_per_week: z.number().min(1).max(7),
  is_active: z.number().int().min(0).max(1),
});

export const CompletionIdsSchema = z.array(z.number().int());

export const HabitSchema = z.object({
  id: z.number().int().optional(),
  title: z.string(),
  engine: z.string(),
  icon: z.string(),
  created_at: z.number(),
  trigger: z.string().optional(),
  duration: z.string().optional(),
  frequency: z.string().optional(),
});

export const HabitLogIdsSchema = z.array(z.number().int());

// ─── User profile & rank-ups ─────────────────────────────────────────────────

export const UserProfileSchema = z.object({
  id: z.literal("default"),
  xp: z.number().min(0),
  level: z.number().int().min(1),
  streak: z.number().int().min(0),
  best_streak: z.number().int().min(0),
  last_active_date: z.string(),
});

export const RankUpEventSchema = z.object({
  id: z.string(),
  from: z.number().int().min(1),
  to: z.number().int().min(1),
  at: z.number(),
});

export const RankUpQueueSchema = z.array(RankUpEventSchema);

// ─── Protocol ────────────────────────────────────────────────────────────────

// Archetype enum — must stay in sync with useModeStore.IdentityArchetype
const IdentityArchetypeSchema = z.enum([
  "titan",
  "athlete",
  "scholar",
  "hustler",
  "showman",
  "warrior",
  "founder",
  "charmer",
]);

export const ProtocolSessionSchema = z.object({
  dateKey: z.string(),
  completedAt: z.number(),
  intention: z.string(),
  habitChecks: z.record(z.string(), z.boolean()),
  titanScore: z.number().min(0).max(100),
  identityVote: IdentityArchetypeSchema.nullable(),
});

export const ProtocolSessionsMapSchema = z.record(z.string(), ProtocolSessionSchema);

// ─── Skill tree (src/data/skill-trees.json) ─────────────────────────────────

// Matches the raw JSON shape that useSkillTreeStore.buildSkillTrees() reads.
// Each engine has branches, each branch has levels (level-indexed nodes).
// Leaf level nodes have rich requirement fields that drive the evaluator;
// we use passthrough() there to accept any extra requirement metadata.
export const SkillTreeLevelSchema = z
  .object({
    nodeId: z.string(),
    level: z.number().int(),
    name: z.string(),
    description: z.string(),
    requirementType: z.string().optional(),
  })
  .passthrough();

export const SkillTreeBranchRawSchema = z.object({
  id: z.string(),
  name: z.string(),
  levels: z.array(SkillTreeLevelSchema),
});

export const SkillTreeEngineRawSchema = z.object({
  branches: z.array(SkillTreeBranchRawSchema),
});

export const SkillTreeDataSchema = z.object({
  body: SkillTreeEngineRawSchema.optional(),
  mind: SkillTreeEngineRawSchema.optional(),
  money: SkillTreeEngineRawSchema.optional(),
  charisma: SkillTreeEngineRawSchema.optional(),
});

// ─── Safe read helper ────────────────────────────────────────────────────────

/**
 * Validate data against a schema, logging failures and returning the
 * fallback if invalid. Use at storage read boundaries only.
 *
 * Example:
 *   const tasks = parseOrFallback(
 *     TaskSchema.array(),
 *     getJSON("tasks:body", []),
 *     [],
 *     "tasks:body",
 *   );
 */
export function parseOrFallback<T>(
  schema: z.ZodType<T>,
  value: unknown,
  fallback: T,
  source: string,
): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  logError("schema.validation", new Error(`Invalid shape at ${source}`), {
    source,
    issues: result.error.issues.slice(0, 5), // cap for log size
    preview: typeof value === "object" ? JSON.stringify(value).slice(0, 200) : String(value),
  });
  return fallback;
}

// ─── Type exports (inferred from schemas, single source of truth) ───────────

export type ValidatedTask = z.infer<typeof TaskSchema>;
export type ValidatedHabit = z.infer<typeof HabitSchema>;
export type ValidatedProtocolSession = z.infer<typeof ProtocolSessionSchema>;
export type ValidatedUserProfile = z.infer<typeof UserProfileSchema>;
export type ValidatedRankUpEvent = z.infer<typeof RankUpEventSchema>;
