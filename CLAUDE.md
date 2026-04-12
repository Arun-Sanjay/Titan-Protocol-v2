# Titan Protocol — Claude Instructions

> Mobile-first gamified "personal OS" app. Expo SDK 55, RN 0.83, React 19, Hermes + New Architecture. Ship target: Google Play (freemium, solo dev).
>
> **Deep recipes live in `.claude/skills/titan-dev/SKILL.md`.** This file is the always-loaded summary + the rules you must never break. Load the skill for how-tos, decision trees, and full feature chains.

---

## 1. Working directory

All active code lives in **`titan-protocol/`**. `cd` here before running anything.

- `titan-protocol/legacy/` — frozen web/Tauri app. **Never modify.** Already excluded from `tsconfig.json` and `jest.config.js`.
- `titan-protocol.BACKUP-2026-04-06/` (parent dir) — pre-refactor backup. Read-only reference.

Absolute import alias: `@/*` → `src/*` (see `tsconfig.json`). Prefer it over relative paths for anything two levels deep.

---

## 2. Tech stack (pinned — do not upgrade without discussion)

| Area | Package | Version |
|---|---|---|
| Runtime | `expo` | `~55.0.12` |
| | `react-native` | `0.83.4` |
| | `react` | `19.2.0` |
| Routing | `expo-router` | `~55.0.11` |
| Language | `typescript` | `5.9` strict |
| Local state | `zustand` | `^5.0.12` (legacy, do not extend) |
| Cloud state | `@tanstack/react-query` | `^5.96.2` |
| DB client | `@supabase/supabase-js` | `^2.101` |
| Local storage | `react-native-mmkv` | `^4.3` |
| Session storage | `@react-native-async-storage/async-storage` | `2.2` |
| Animation | `react-native-reanimated` | `4.2.1` + worklets `0.7.2` |
| Gestures | `react-native-gesture-handler` | `~2.30` |
| Canvas | `@shopify/react-native-skia` | `2.4.18` |
| 3D | `@react-three/fiber` `^9.5` + `three` `^0.183` + `expo-gl` `~55` |
| Lists | `@shopify/flash-list` | `2.0.2` |
| Validation | `zod` | `^4.3` |
| Audio | `expo-av` `^16.0.8` + `expo-speech` `~55` |
| Fonts | `@expo-google-fonts/jetbrains-mono` |
| Tests | `jest` + `jest-expo` (pure logic only) |

No NativeWind, no styled-components, no Redux, no SWR, no Supabase edge functions. One MMKV instance named `titan-protocol`.

---

## 3. CRITICAL: the data layer is mid-migration (dual-stack)

Every piece of user data currently lives in **one of two places**. Know which before you touch anything.

### Cloud-backed (Supabase + React Query) — prefer for all new code

| Domain | Hook file | Service file | Supabase table |
|---|---|---|---|
| Profile (xp, level, streak) | `src/hooks/queries/useProfile.ts` | `src/services/profile.ts` | `profiles` |
| Tasks + completions | `src/hooks/queries/useTasks.ts` | `src/services/tasks.ts` | `tasks`, `completions` |
| Habits + logs | `src/hooks/queries/useHabits.ts` | `src/services/habits.ts` | `habits`, `habit_logs` |
| Protocol sessions | `src/hooks/queries/useProtocol.ts` | `src/services/protocol.ts` | `protocol_sessions` |
| Rank-up queue | `src/hooks/queries/useRankUps.ts` | `src/services/rank-ups.ts` | `rank_up_events` |

All mutations are optimistic (snapshot → `setQueryData` → rollback on error → invalidate on settle). Query keys are per-domain and per-date so invalidations are surgical.

### Legacy MMKV (Zustand) — maintain, do NOT extend

Everything else: 32 stores in `src/stores/`. Reads/writes go through `getJSON`/`setJSON` in `src/db/storage.ts`. Keys should use the `K.*` registry in `src/db/keys.ts` (adoption is still incomplete — the `K` registry covers ~5 stores today, hardcoded key strings in the other 17 are a migration target).

Screens still reading MMKV directly: `(tabs)/engines.tsx`, Journal + Goals halves of `(tabs)/track.tsx`, every file in `app/hub/`, `field-ops.tsx`, `titles.tsx`, `achievements.tsx`, `quests.tsx`, `mind-training.tsx`, all story/onboarding/walkthrough flows, all v2 celebrations.

### Rule: if you are adding a NEW feature, go cloud-first

Build the Supabase table, write the service, write the React Query hook, wire the component. **Do not add a new Zustand store for new data.** See `SKILL.md` → "Adding a cloud-backed feature" for the full recipe.

---

## 4. Golden rules (non-negotiable)

1. **Never reinvent gamification math. There are THREE distinct rank concepts — know which one you want.**
   - **Daily letter grade (D/C/B/A/S/SS) from a score:** use `lib/scoring-v2.ts` → `calculateRank(score)` for new code. It's test-pinned in `__tests__/scoring.test.ts`. `db/gamification.ts` → `getDailyRank(score)` returns the same thing and is still imported by 6 UI files (`RankCeremony`, `PowerRing`, `StatScreen`, `DailyBriefing`, `(tabs)/index.tsx`, `protocol.tsx`) — both are safe to call, do NOT invent a third.
   - **Weighted daily Titan score (0-100) from engine scores:** only `lib/scoring-v2.ts` → `calculateWeightedTitanScore(engineScores, archetype, isTitanMode?, activeEngines?)`. Handles archetype weights + focus-mode renormalization.
   - **XP-level-based tier name (Initiate → Operator → Specialist → Vanguard → Sentinel → Titan):** only `db/gamification.ts` → `getRankForLevel(level)` + `RANKS` constant. Used by `profile.tsx` and `XPBar`. There is no alternative — do not treat this file as dead.
   - **Consecutive-day rank promotion FSM (initiate → operative → agent → specialist → commander → vanguard → sentinel → titan):** only `lib/ranks-v2.ts` → `evaluateRankDay(titanScore)`. Separate from the XP-level rank — this tracks promotion/demotion based on qualifying days at/above a score threshold. Used by field ops and rank ceremonies.
   - **These two rank ladders (`gamification.RANKS` vs `ranks-v2.RANK_NAMES`) overlap in naming but encode DIFFERENT concepts.** Don't try to unify them without a full design conversation — they answer different questions.
   - **Dates:** `lib/date.ts` → `getTodayKey`, `toLocalDateKey`, `addDays`, `formatDateDisplay`, `getMonthKey`. Never use `.toISOString().slice(0,10)` — not DST-safe, explicit warning in the header comment.
   - **Integrity/streak:** `lib/protocol-integrity.ts` (see §7 for the known streak-advance bug).

2. **Never bypass `db/storage.ts`.** Always import `getJSON`, `setJSON`, `nextId` from `@/db/storage`. Direct `storage.set()` / `storage.getString()` skips the Phase 2.2B `error-log` wrapper and your failures become invisible.

3. **Never hardcode MMKV keys in new code.** Extend `src/db/keys.ts` instead.

4. **Never add a new Zustand store for cloud-bound data.** See §3.

5. **Every `withRepeat(-1)` Reanimated loop MUST have `cancelAnimation()` in cleanup.** Canonical examples: `components/ui/Panel.tsx` (`GlowLine`), `components/ui/Skeleton.tsx`, `components/ui/MissionRow.tsx` (the discipline gold standard — it cancels 6 shared values even though none of them loop).

6. **Android shadows only via `theme/shadows.ts`.** It caps `elevation` at 2 for panels and 0 for rows/cards — anything else risks the GPU compositor OOM seen on mid-range Androids with 15+ MissionRow children.

7. **No inline colors.** Use `colors.*` from `theme/colors.ts`. Dynamic accent/border colors on individual components are the only legitimate exception.

8. **No inline hex/rgba in styles for anything that has a theme token.** `colors.bg`, `colors.text`, `colors.panelBorder`, etc.

9. **Mutations are optimistic.** Every React Query mutation follows the `onMutate → snapshot → apply → onError rollback → onSettled invalidate` pattern. See `hooks/queries/useTasks.ts → useToggleCompletion` as the canonical example.

10. **Services throw, hooks catch.** Functions in `src/services/` must `throw error` from Supabase. Hooks convert to mutation `onError` callbacks and the UI decides what to show.

11. **Tests only for `src/lib/` pure logic.** `jest-expo` can't easily run components or stores. Don't add test files outside `src/__tests__/` that import RN.

12. **TypeScript discipline.**
    - `as any` is banned except for two patterns: `Ionicons name={x as any}` (RN's icon name widening) and template-string `DimensionValue` (`width: \`${n}%\` as any`).
    - Zero `@ts-ignore` / `@ts-expect-error` in the repo. Keep it that way. Fix the type instead.

13. **Fonts are hydrated at the root.** `JetBrainsMono_*` weights are loaded by `app/_layout.tsx` via `useFonts()` and the whole app is render-blocked until they resolve. Don't ship styles that assume a different font family.

14. **One MMKV instance.** Never call `createMMKV()` outside `src/db/storage.ts`.

15. **Phase comments.** Every non-trivial fix lands with a `// Phase X.Y.Z: why` comment. Keep this discipline — it's the only changelog we have inside the code.

---

## 5. File structure cheat sheet

```
titan-protocol/
├── app/
│   ├── _layout.tsx              Root layout + overlay orchestration (~600 lines, refactor target)
│   ├── (auth)/                  Supabase login/signup/verify/magic-link
│   ├── (tabs)/
│   │   ├── _layout.tsx          Custom TitanTabBar
│   │   ├── index.tsx            HQ dashboard (cloud-backed)
│   │   ├── engines.tsx          Engine summary grid (MMKV — migration pending)
│   │   ├── track.tsx            Habits (cloud) + Journal/Goals (MMKV)
│   │   ├── hub.tsx              Static router into app/hub/
│   │   └── profile.tsx          Rank + XP + titan-mode
│   ├── (modals)/                add-task (form) + 5 celebration bridges
│   ├── hub/                     11 sub-trackers — all 500-2448 LOC monoliths, MMKV only
│   │                            (workouts, sleep, cashflow, nutrition, weight,
│   │                             budgets, focus, deep-work, analytics, command, settings)
│   ├── protocol.tsx             Morning+evening session (cloud-backed, single Supabase row/day)
│   ├── skill-tree/              Tree overview + per-engine drill-down
│   ├── engine/[id].tsx          Per-engine mission detail (FlashList)
│   └── (leaf routes)            achievements, quests, field-ops, titles, narrative, mind-training, etc.
├── src/
│   ├── components/
│   │   ├── ui/                  46 primitives (Panel, MissionRow, ScoreGauge, SystemWindow, …)
│   │   ├── 3d/                  React-Three-Fiber scenes (RankUp, ChapterTransition, ParticleField)
│   │   ├── v2/onboarding/       27 files — two parallel flows (Beat* is active, Step* is legacy)
│   │   ├── v2/story/            35 files — Day cinematics + briefings (copy-paste reduction target)
│   │   ├── v2/walkthrough/      13 files — post-onboarding tour
│   │   ├── v2/celebrations/     Boss defeat, perfect day, titan unlock, share card
│   │   ├── v2/{achievements,habits,identity,mind-training,narrative,progression,quests,skill-tree}/
│   │   └── {Migration,Onboarding,RankUpOverlay,AppResumeSync}Mount/Gate   Root lifecycle gates
│   ├── stores/                  32 Zustand stores + 1 dead helper (mmkv-storage.ts)
│   ├── lib/                     39 business-logic modules:
│   │                            scoring-v2, ranks-v2, operation-engine, protocol-integrity,
│   │                            narrative-engine, narrative-writer, protocol-audio, voice,
│   │                            notifications, haptics, surprise-engine, achievement-checker,
│   │                            quest-generator, mission-suggester, titles, field-ops,
│   │                            skill-tree-evaluator, transmissions, supabase, query-client,
│   │                            migrate-to-supabase, schemas, safety, error-log, date, format,
│   │                            animations, srs, momentum, safeNum, share
│   ├── services/                5 typed Supabase wrappers (profile, tasks, habits, protocol, rank-ups)
│   ├── hooks/queries/           5 React Query hook files matching the services
│   ├── hooks/                   useAppResumeSync, useIsOnline, useAnalyticsData (legacy)
│   ├── db/
│   │   ├── storage.ts           MMKV wrapper + getJSON/setJSON/nextId + migration runner
│   │   ├── keys.ts              K.* central key registry (adopt this for new code)
│   │   ├── schema.ts            Shared local types
│   │   └── {engine,habits,goals,gamification}.ts   LEGACY — do not extend
│   ├── data/                    Static content (achievements.json, boss-challenges.json, skill-trees.json,
│   │                            quest-templates.json, identity-quiz.ts, archetype-stories.ts, chapters.ts,
│   │                            starter-missions.ts, titles.json, field-ops.json, exercises/*)
│   ├── theme/                   colors.ts, typography.ts (JetBrains Mono), spacing.ts, shadows.ts
│   ├── types/supabase.ts        Auto-generated (27 tables, do not hand-edit)
│   └── __tests__/               scoring.test.ts, date.test.ts, schemas.test.ts
├── assets/audio/protocol/       138 voice-line MP3s / 9.3 MB across 9 categories
│                                (archetypes, bosses, cinematics, daily, failure,
│                                 onboarding, operations, ranks, surprises)
├── assets/                      icon, splash, adaptive-icon, favicon
├── android/                     Native Android project (tracked — OAuth + signing live here)
├── legacy/                      FROZEN web/Tauri app
├── app.json                     Expo config (slug com.titan.protocol, dark UI, adaptive icon)
├── eas.json                     EAS build profiles (development, preview, production)
├── jest.config.js               jest-expo preset, pure-logic coverage only
├── tsconfig.json                strict, @/* → src/*, excludes legacy/android
├── babel.config.js              babel-preset-expo
├── metro.config.js              Default Metro
├── titan-release.jks            Play Store signing keystore (gitignored mirror at .jks.b64)
└── .env                         Supabase URL + anon key populated (others empty until later phases)
```

---

## 6. Commands (from `titan-protocol/`)

```bash
# Dev
npm run start              # expo start (Metro + dev menu)
npm run android            # expo run:android (requires SDK + adb device)
npm run ios                # expo run:ios (macOS only)

# Tests
npm test                   # jest (src/__tests__/ only)
npm run test:watch         # jest --watch
npx tsc --noEmit           # typecheck (strict)

# EAS builds (profiles in eas.json)
eas build --profile development --platform android
eas build --profile preview --platform android      # internal APK
eas build --profile production --platform android   # Play release
```

**Signing:** `titan-release.jks` is the Play Store app-signing key. **Do not regenerate.** Play Store signing is locked to this key; losing it means users lose update continuity.

**Supabase project ref:** `rmvodrpgaffxeultskst` (region `ap-south-1`). URL and anon key are in `.env` (publishable, gated by RLS on every table).

---

## 7. Known critical bugs — fix, don't work around

These were found by full code read and are NOT in any tracker yet. Fix the root cause when you encounter them; do not build walls around them.

1. **`lib/protocol-integrity.ts:136-150`** — 1-day miss increments the streak counter in both the grace and post-grace branches, contradicting the module's own "pause, not advance" comment. Users get rewarded for missing days.

2. **`lib/skill-tree-evaluator.ts:217-239`, `290-312`, `326-332`, `362-372`** — `storage.getAllKeys()` is called inside day-level loops. `checkStreakDays` runs it 365× per call; `checkWeeklyConsistency` runs it `(weeks+2) × 7` times nested. On a year-old power user this will stall the JS thread. Fix: hoist `getAllKeys()` out of the loops or maintain a dedicated index key.

3. **`lib/achievement-checker.ts:79`** — Mutates `useAchievementStore` by calling `unlockAchievement()` inside the condition evaluation loop. Meta-achievements (unlock-on-unlock, first-X-unlocked) are missed in the same pass. Fix: collect unlocks into an array, apply after the loop. Also the `defs` array on line 57 is computed but never read — dead code.

4. **`lib/migrate-to-supabase.ts:277-415`** — Tasks and habits use plain `insert`, not upsert, and rely on Postgres preserving insertion order to build the id-map. If a partial run crashes after inserts but before the outer `migration_completed:{userId}` flag is written, re-running duplicates every task and habit. Fix: write a per-domain completion flag OR include a local-id column and upsert on it.

5. **`lib/supabase.ts:37-39`** — `createClient()` is called with empty strings when env vars are missing, logging but not throwing. The app boots into a broken state with cryptic 401s. Fix: throw from the module top-level if `EXPO_PUBLIC_SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_ANON_KEY` is missing.

6. **`hub/settings.tsx:381`** — `storage.clearAll()` button is not `__DEV__`-gated. Production users can nuke their MMKV while the Supabase profile stays intact, leaving a confusing half-wiped state. Fix: gate with `if (__DEV__)` OR wire it to also delete the cloud profile + sign out.

7. **`(tabs)/_layout.tsx` TabDef.gameIcon / gameLabel** — The type declares override fields for a "game mode" tab bar variant, the TABS array populates them, but the renderer at lines 99-113 never reads them. Dead code. Either wire it to `useModeStore.mode` and branch, or delete the fields.

8. **Daily-rank helper duplication.** `db/gamification.ts → getDailyRank` and `lib/scoring-v2.ts → calculateRank` return the same D-SS grade. Both are in active use (6 files import the former). Consolidate to `calculateRank` and update the 6 call sites — but keep `getRankForLevel` and `RANKS` in `gamification.ts` because they encode the XP-tier name system, which is distinct and has no replacement.

9. **Two pending rank-up queues.** `useProfileStore.pendingRankUps` (legacy MMKV) and the Supabase `rank_up_events` table (active) both exist. Delete the store queue now that `RankUpOverlayMount` consumes the cloud one.

10. **Two parallel narrative systems.** `lib/narrative-engine.ts` (writes MMKV directly) and `lib/narrative-writer.ts` (pure generator → store). Pick one, migrate callers, delete the other.

11. **Parallel onboarding flows.** `src/components/v2/onboarding/` has both `Beat*.tsx` files (active, mounted by `CinematicOnboarding.tsx`) and `Step*.tsx` files (`OnboardingShell.tsx` — legacy, not mounted). Delete the Step flow once you're confident no code path reaches it.

12. **`BeatTaskSelection.tsx`** still exists in `v2/onboarding/` but is commented out of the beat flow. Delete it when convenient.

---

## 8. Commit, PR, and deploy hygiene

- **Commit messages:** conventional subject + body explaining the *why*. Prefix with phase tag if applicable (`feat(3.4): …`).
- **Never commit `.env`, `titan-release.jks` (mirror `.jks.b64` is fine), node_modules, or `android/app/build/`.** Already in `.gitignore` but double-check.
- **Before pushing:** `npx tsc --noEmit && npm test`. Non-negotiable.
- **Never force-push to main.** Never skip hooks (`--no-verify`) unless explicitly asked.
- **Never run `expo prebuild` without asking** — the `android/` directory is hand-maintained and tracked.

---

## 9. When to load skills

- **`titan-dev`** — the only project-scoped skill. Load it whenever you are:
  - adding a new cloud-backed feature
  - migrating an existing MMKV store to Supabase
  - adding a new hub screen (to avoid the monolithic pattern)
  - adding a day cinematic (to avoid the copy-paste trap)
  - adding an achievement, title, quest, or boss
  - working with the protocol-audio voice-line system
  - touching scoring/ranks/streak math
  - running Supabase schema migrations via the MCP tools
  - debugging animation cleanup or Android shadow bombs

Skill lives at `.claude/skills/titan-dev/SKILL.md` and should be your first read on any non-trivial dev task in this repo.
