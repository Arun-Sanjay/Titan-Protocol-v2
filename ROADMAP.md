# Titan Protocol — Unified Roadmap

> **Status:** Planning complete. No implementation started.
> **Last updated:** 2026-04-06
> **Owner:** Arun Sanjay
> **Target:** Production launch on Google Play Store

---

## How to use this document

This is the canonical implementation roadmap for Titan Protocol's mobile-first transition, bug fix campaign, Supabase migration, and Play Store launch.

**If you're Claude reading this at the start of a session:** this supersedes any older context in `CLAUDE.md` about the project state. The web/Tauri app is frozen. All active development is on the mobile app (Expo + React Native) at `apps/mobile/` (will move to repo root in Phase 1.1). Read the Context section below, check the Status Tracker to see which phases are done, and pick up from the next pending phase.

**If you're a human:** read top-to-bottom. Push back on anything you disagree with in chat before execution starts.

This file should be updated as phases complete. Each phase has a status flag — flip it to ✅ when done and add a brief "completed on" note.

---

## Context

Titan Protocol is a gamified 365-day personal-performance operating system. It tracks four "engines" (Body, Mind, Money, Charisma), layered with a narrative/cinematic story system (day-based cinematics at Day 1-14, 30, 45, 60, 90, 365), boss challenges, skill trees, archetypes, and a 4-phase progression system (Foundation → Building → Intensify → Sustain).

**Current state (as of 2026-04-06):**
- The original web/Tauri app at `apps/web/` is shipped and frozen. It works but product-market fit is on mobile.
- The mobile app at `apps/mobile/` is feature-rich (Expo SDK 55, RN 0.83, New Architecture, Hermes, ~30 Zustand stores, MMKV storage, Reanimated 4, Skia, React Three Fiber, 143 audio files, full narrative system).
- **Known critical bugs:**
  - **Crashes on 15+ tasks** — diagnosed: infinite `withRepeat(-1)` Reanimated loops with no `cancelAnimation()` cleanup + double store updates in `addTask` + Android `elevation` layer bomb from `shadows.card` on every row.
  - **Rank-up overlays don't appear** — diagnosed: `LevelUpOverlay` lives in `app/(tabs)/index.tsx:625-629` (only the dashboard screen), not in the root layout. `useRef(profileLevel)` detection silently misses level changes when user is on any other screen.
- **No backend** — the app is MMKV-only. For a 365-day tracking product, losing data on phone loss/reinstall is an existential UX failure.
- **Repo structure** is a leftover from the dead monorepo era — mobile lives three levels deep in `apps/mobile/`.

**Goal:** clean the repo, fix every known bug, migrate to Supabase for cloud sync, and ship to Google Play with a freemium model where onboarding is free and the paywall triggers after the user completes their first task.

---

## Confirmed Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Billing infrastructure | **RevenueCat** | Handles Google Play Billing + receipt validation + webhooks. Free up to $10k MRR. Saves weeks of solo-dev time vs native integration. |
| Auth methods | **Google Sign-In + email magic link + email/password** | Google for lowest-friction Android path. Magic link for passwordless fallback. Email+password for users who prefer it. Apple Sign-In deferred until iOS launch. |
| Repo layout | **Mobile promoted to repo root**, web → `legacy/web/` | Simplest. When you `cd` into the repo you're in the mobile app. Web preserved for reference but out of the way. |
| Backend | **Supabase** (PostgreSQL + Auth + Edge Functions + Storage) | Open source, generous free tier, PostgreSQL with RLS for security, works well with React Native, has MCP tools for management. |
| Data layer | **Supabase + React Query + MMKV as offline cache** | Best-of-both: server is source of truth, offline-first via React Query persistence. |
| Platform priority | **Android first**, iOS later | Android has the Play Console set up already (keystore exists). iOS adds cost and review friction. |

---

## Pricing (placeholder — validate with beta users)

These are placeholder defaults for the plan, not final business decisions.

**Recommended starting pricing** (will be tested in Phase 4.4 closed beta):

| Tier | Price | Equivalent Monthly | Positioning |
|---|---|---|---|
| Monthly | $6.99 | $6.99 | "Try it out" — discouraged in favor of annual |
| Annual | $49.99 | $4.17/mo | "BEST VALUE" — highlighted, ~40% discount |
| Lifetime (optional) | $119.99 | — | Power users, funds early dev, ~2.4x annual |

**Competitive benchmarks:**
- Finch: $4.99/mo, $39.99/yr
- Fabulous: $9.99/mo, $39.99/yr, $79.99 lifetime
- Habitica: free + donation model
- Streaks: $4.99 one-time
- Todoist Pro: $4/mo, $36/yr

**Rationale:**
- The 365-day narrative commitment aligns with annual pricing framing ("start your year").
- Paywall triggers very early (first task completion) → lower conversion rate but self-selected serious users → justifies premium pricing.
- Cinematic production value + voice lines signal premium — pricing below $4/mo would feel inconsistent with quality.
- Google Play takes 15% on first $1M/year, then 30%.

**Action:** validate in Phase 4.4 closed testing. Survey 10-20 testers with "would you pay $X?" for each tier before committing to Play Console listings.

---

## Status Tracker

| # | Phase | Status | Notes |
|---|---|---|---|
| 1.0 | Pre-flight safety (backups) | ✅ Done | 2026-04-06 |
| 1.1 | Restructure repo | ✅ Done | 2026-04-06 · 2 commits (archive web, promote mobile) |
| 1.2 | Verify configs post-move | ✅ Done | 2026-04-06 · npm install, tsc, expo config all pass |
| 1.3 | Rewrite CLAUDE.md | ✅ Done | 2026-04-06 · new mobile-first CLAUDE.md at repo root |
| 1.4 | Baseline safety nets | ✅ Done | 2026-04-06 · +not-found, RootErrorBoundary, .env.example |
| 2.1A | Animation cleanup pass | ✅ Done | 2026-04-06 · 10 files, cancelAnimation on unmount |
| 2.1B | Collapse addTask double update | ✅ Done | 2026-04-06 · addTask recomputes scores in one set() |
| 2.1C | Memoize MissionRow | ✅ Done | 2026-04-06 · taskId API, useMemo gesture, useCallback |
| 2.1D | Android shadow optimization | ✅ Done | 2026-04-06 · Platform.select, capped elevation |
| 2.1E | Rank-up refactor (queue + root) | ✅ Done | 2026-04-06 · pendingRankUps queue, overlay in root |
| 2.1F | Overlay priority state machine | ✅ Done | 2026-04-06 · priority by render order, extract deferred to 2.3 |
| 2.2A | Atomic protocol session writes | ✅ Done | 2026-04-06 · write-ahead flag, shared computeNewStreak helper |
| 2.2B | Kill silent catches + error log | ✅ Done | 2026-04-06 · src/lib/error-log.ts ring buffer, storage.ts logs via logError |
| 2.2C | Zod schemas at read boundaries | ✅ Done | 2026-04-06 · src/lib/schemas.ts + parseOrFallback, fixes skill tree `as any` |
| 2.2D | Central MMKV key registry | ✅ Done | 2026-04-06 · src/db/keys.ts, 4 stores migrated |
| 2.3F | Habit stats denormalization | ✅ Done | 2026-04-06 · cache-warmed reads, ~1200 MMKV → ~30 |
| 2.3E | Settings route ambiguity | ✅ Done | 2026-04-06 · removed orphaned app/settings/index.tsx |
| 2.3B | Track sub-tabs persistence | ✅ Done (partial) | 2026-04-06 · MMKV-persisted tab; full route split deferred to 2.4 |
| 2.3C | Typed routes + remove as any | ✅ Done | 2026-04-06 · 7 router.push 'as any' casts removed via Href type |
| 2.3A+D | Overlay orchestrator + ScreenHeader | 🚫 Deferred to 2.4 | architectural refactors with high churn, low blocker value |
| 2.4-pre | Fix 4 pre-existing SharedValue tsc errors | ✅ Done | 2026-04-06 · clean tsc baseline for first time |
| 2.4D | JetBrains Mono via expo-font | ✅ Done | 2026-04-06 · @expo-google-fonts/jetbrains-mono, render-blocked |
| 2.4B | Loading skeleton primitive | ✅ Done | 2026-04-06 · Skeleton + SkeletonGroup + SkeletonCard |
| 2.4A | FlashList audit | ✅ Done | 2026-04-06 · budgets converted, others audited & deferred |
| 2.4F | Jest framework + 67 unit tests | ✅ Done | 2026-04-06 · scoring (27), date (16), schemas (24) |
| 2.4C/E | Worklet directives, asset audit | 🚫 Skipped | low value, can revisit post-launch |
| 3.1 | Supabase project + schema + types | ✅ Done | 2026-04-07 · ref rmvodrpgaffxeultskst, 27 tables, 6 migrations, 0 advisor lints |
| 3.2 | Auth flow (Supabase client, store, screens, route guards) | ✅ Done | 2026-04-07 · email + password + magic link; Google deferred on OAuth client ID |
| 3.3 | Data layer refactor (services + React Query) | ⏳ Pending | **Biggest phase** |
| 3.4 | Offline-first sync | ⏳ Pending | |
| 3.5 | MMKV → Supabase migration | ⏳ Pending | |
| 3.6 | Realtime multi-device sync | 🚫 Deferred post-launch | |
| 4.1 | RevenueCat integration | ⏳ Pending | |
| 4.2 | Paywall UX | ⏳ Pending | |
| 4.3 | Play Store assets + listing | ⏳ Pending | |
| 4.4 | Pre-launch quality gate | ⏳ Pending | |
| 4.5 | Staged production rollout | ⏳ Pending | |

Legend: ⏳ Pending · 🔨 In Progress · ✅ Done · 🚫 Deferred

---

# PART 1 — Repo Cleanup & Foundation

**Timeline:** 1-2 days

## 1.1 Restructure the repo

**Target layout:**
```
titan-protocol/
├── app/                    # from apps/mobile/app/
├── src/                    # from apps/mobile/src/
├── assets/                 # from apps/mobile/assets/
├── android/                # from apps/mobile/android/
├── titan-voice-lines/      # from apps/mobile/titan-voice-lines/
├── package.json            # from apps/mobile/package.json
├── app.json                # from apps/mobile/app.json
├── eas.json                # from apps/mobile/eas.json
├── tsconfig.json           # from apps/mobile/tsconfig.json
├── CLAUDE.md               # rewritten
├── ROADMAP.md              # this file
├── legacy/
│   ├── web/                # from apps/web/ (includes src-tauri)
│   └── packages-shared/    # from packages/shared/ (was empty)
└── .github/, .gitignore, LICENSE, README.md
```

**Actions:**
- `git mv` all contents of `apps/mobile/*` → repo root
- `git mv apps/web legacy/web`
- `git mv packages/shared legacy/packages-shared`
- Delete empty `apps/`, `packages/`, `infra/` dirs
- Update `.gitignore` (remove web-specific entries like `/apps/web/.next`, keep mobile-relevant entries)

## 1.2 Verify paths and configs post-move

- `tsconfig.json` — `paths: { "@/*": ["./src/*"] }` still resolves (no change needed)
- `app.json`, `eas.json`, `android/app/build.gradle` — all use relative paths, should work
- Add `"legacy"` to `tsconfig.json` excludes
- Verify: `npm install`, `npx expo start`, `npx expo prebuild` all succeed
- Verify Android build still compiles after the move

## 1.3 Rewrite `CLAUDE.md`

New CLAUDE.md covers:
- Active codebase: mobile app at repo root (no more `apps/mobile/` path)
- Tech stack: Expo SDK 55, RN 0.83 + New Architecture + Hermes, expo-router, Zustand + MMKV (transitioning to Supabase), Reanimated 4, Skia, React Three Fiber, RevenueCat
- Directory structure with pointers to key files
- Common commands: `npm start`, `npx expo run:android`, `eas build`, `eas submit`
- Architectural notes: ~30 Zustand stores under `src/stores/`, MMKV abstraction at `src/db/storage.ts`, overlay orchestration in `app/_layout.tsx`, HUD theme tokens in `src/theme/`
- Reference to this ROADMAP.md as source of truth for work in progress
- Note: `legacy/` is historical web app, read-only reference only

## 1.4 Baseline safety nets (non-bug but critical)

- **`app/+not-found.tsx`** — expo-router fallback for unknown routes (prevents white screen on bad deep links)
- **Root error boundary** wrapping the Stack in `app/_layout.tsx` — the existing `SceneErrorBoundary` only covers 3D scenes. Needs a reset-to-home CTA.
- **`.env.example`** with placeholders: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `REVENUECAT_ANDROID_KEY`, `POSTHOG_KEY`, `SENTRY_DSN`
- **Delete `test-onboarding.ts` and `test-simulation.ts`** at repo root (imperative scripts, not real tests — will be replaced by Jest in Phase 2.4)

---

# PART 2 — Bug Fix Phases

Each phase is self-contained and verifiable on device before moving on.

## Phase 2.1 — Critical Stability

**Fixes the two bugs the user explicitly called out.**
**Timeline:** 2-3 days

### A. Animation cleanup pass — eliminates the 15+ task crash

Every `withRepeat(..., -1)` needs an explicit `cancelAnimation()` in cleanup. Files to fix (confirmed from diagnostic):

- `src/components/ui/Panel.tsx:38-45` — **biggest offender**, GlowLine drift in every panel
- `src/components/ui/PulsingGlow.tsx`
- `src/components/ui/SkillTreeNode.tsx:64-71, 72-79` — two loops per node
- `src/components/ui/TitanProgress.tsx`
- `src/components/ui/AnimatedBackground.tsx` — multiple infinite loops
- `src/components/ui/FloatingActionButton.tsx`
- `src/components/ui/MissionBoard.tsx:178-185`
- Grep for any others during audit

**Pattern applied everywhere:**
```
import { cancelAnimation } from 'react-native-reanimated';
useEffect(() => {
  sharedValue.value = withRepeat(...);
  return () => cancelAnimation(sharedValue);
}, []);
```

Also fix `MissionRow.tsx` — add cleanup for its 6 shared values (`translateX`, `checkScale`, `cardScale`, `flashOpacity`, `xpPopupY`, `xpPopupOpacity`).

### B. Collapse double store update in `addTask`

- `src/stores/useEngineStore.ts` `addTask()` — write to MMKV once AND return fresh engine slice in a single `set()` call. No need for a separate `loadEngine` call after.
- `app/engine/[id].tsx:241-252` (`handleAddSuggestion`) — remove the `useEngineStore.getState().loadEngine(engine, dateKey)` call that currently runs right after `addTask`
- Audit all other callers of `addTask + loadEngine` in sequence and remove the redundant reload

### C. Memoize `MissionRow` properly

- Wrap Pan gesture in `useMemo` so it's not recreated every render
- Wrap `handleToggle`, `handleDelete` in `useCallback` with stable deps
- Verify `React.memo` isn't being defeated by parent passing new prop references (custom `areEqual` if needed)

### D. Android shadow/elevation optimization

- `src/theme/shadows.ts` — wrap `elevation` in `Platform.select`, cap Android at `elevation: 2`, or emulate card depth via border gradient
- Each `elevation` creates a native RenderNode on Android — 15+ rows = 15+ GPU layers = memory pressure on mid-range devices

### E. Rank-up architectural refactor

Core fix: detect level change at the source, queue it, render from root layout.

**1. Update `src/stores/useProfileStore.ts`:**
- Add state: `pendingRankUps: RankUpEvent[]`
- Add actions: `enqueueRankUp(event)`, `dequeueRankUp()`
- Modify `awardXP()`: capture `prevLevel` BEFORE mutation, compute `newLevel` AFTER, if different → enqueue `{ from: prevLevel, to: newLevel, at: Date.now() }`
- Persist queue to MMKV key `pending_rank_ups` (migrates to Supabase in Phase 3)

**2. Move `LevelUpOverlay` to root:**
- Remove from `app/(tabs)/index.tsx:625-629` (and delete the buggy useRef+useEffect detection on lines 210-221)
- Mount in `app/_layout.tsx` alongside other overlays
- Subscribe to `useProfileStore(s => s.pendingRankUps[0])`
- When non-null → show overlay; on dismiss → `dequeueRankUp()`

**3. Reference pattern:** `useAchievementStore.pendingCelebration` already works this way. Use it as the template.

### F. Overlay priority state machine

Extract the 447-line `app/_layout.tsx` overlay logic to `src/lib/overlay-orchestrator.ts`. Explicit priority (highest first):

1. Integrity warning
2. Streak break cinematic
3. Comeback cinematic
4. Cinematic onboarding
5. First-launch cinematic
6. Day-N cinematic
7. Daily briefing
8. Boss defeat/fail cinematics
9. Surprise overlay
10. **Rank-up (newly added)**
11. Motivational splash
12. Achievement toast (non-blocking, always on top)

Only the highest-priority overlay renders at once. Others queue. When one dismisses, the next one appears. Fixes the "rank-up rendered but invisible behind briefing" failure mode.

### Verification for Phase 2.1
- Real Android device (not simulator), mid-range preferred
- Add 30+ tasks rapidly → must not crash
- Navigate between engine screens 10+ times → no memory growth in Android Profiler
- Complete task from engine detail + protocol completion + habit toggle → rank-up overlay appears in all three
- Background then foreground the app → pending rank-ups still show

---

## Phase 2.2 — Data Integrity

**Clean the local data model before replicating to Supabase.**
**Timeline:** 2 days

### A. Atomic protocol session writes

`src/stores/useProtocolStore.ts` `completeEvening()` currently writes to multiple MMKV keys sequentially. Fix:
- Consolidate to single `protocol_day:{dateKey}` JSON blob containing `{ morning, evening, streak_snapshot }`
- OR implement write-ahead: set `protocol_write_pending:{dateKey} = true`, do all writes, clear flag
- On app launch, check for stuck flags and repair/rollback

### B. Kill silent catches in storage layer

- `src/db/storage.ts` — remove bare `catch {}` blocks
- Add `src/lib/error-log.ts` — in-memory ring buffer (last 50 errors)
- Debug screen accessible via hidden 5-tap on settings version number
- Upgraded to Sentry in Phase 4.4

### C. Zod schemas at read boundaries

- `src/lib/schemas.ts` — Zod schemas for Task, Completion, Habit, HabitLog, ProtocolSession, Quest, BossChallenge, SkillNode, UserProfile, RankUpEvent
- Validate in storage reads (wrap `getJSON` with optional schema)
- On validation failure: log, fall back to default, don't crash
- **Specifically fix `src/stores/useSkillTreeStore.ts:41-42`** — remove `(skillTreeData as any)[engine]`, validate against schema

### D. Central MMKV key registry

- `src/db/keys.ts` — typed key builders:
```
export const K = {
  tasks: (engine: EngineKey) => `tasks:${engine}`,
  completions: (engine: EngineKey, dateKey: string) => `completions:${engine}:${dateKey}`,
  habitLogs: (dateKey: string) => `habit_logs:${dateKey}`,
  protocolDay: (dateKey: string) => `protocol_day:${dateKey}`,
  // ...
} as const;
```
- Every store imports from here — zero typos possible
- Short-lived investment (most keys become Supabase tables in Phase 3) but prevents bugs in the interim

### Verification for Phase 2.2
- Manually corrupt MMKV via debug tool → app shows fallback, doesn't crash, error logged
- Kill app mid-protocol completion → on relaunch, detect incomplete write and repair
- `tsc --noEmit` → zero `as any` in storage/store code paths

---

## Phase 2.3 — Architecture Cleanup

**Timeline:** 2-3 days

### A. Extract overlay orchestrator

Already covered in 2.1.F above — listed here for tracking.

### B. Promote Track sub-tabs to real routes

- Delete local `useState` tab switching in `app/(tabs)/track.tsx`
- Create `app/(tabs)/track/_layout.tsx` with nested Stack or material top tabs
- `app/(tabs)/track/habits.tsx`, `track/journal.tsx`, `track/goals.tsx`
- State persists across navigation, back button works correctly

### C. Enable typed routes

- Add `experiments: { typedRoutes: true }` to `app.json`
- Remove every `router.push(route as any)` — fix type errors that surface
- Particularly: `app/(tabs)/hub.tsx` where hub items navigate via `as any`

### D. Shared `ScreenHeader` component

- `src/components/ui/ScreenHeader.tsx` — props: `title`, `onBack?`, `rightSlot?`
- Replace per-screen reinvented headers in: engines, profile, track, status, field-ops, titles, hub subscreens
- Consistent padding, back icon, typography

### E. Resolve Settings route ambiguity

- Decide between `/settings` and `/hub/settings`
- Recommend `/hub/settings` (stays within the Hub stack)
- Delete the other; fix any links

### F. Habit stats denormalization

- `src/stores/useHabitStore.ts` — stop computing `currentChain`/`bestChain` on read via O(n²) scans
- Store `current_chain`, `best_chain`, `last_broken_date` directly on each habit
- Update on toggle only
- One-time migration on first launch: compute from existing logs, write to habit fields

### Verification for Phase 2.3
- Navigate Track → Habits → back → Track — habit tab still selected
- `tsc --noEmit` passes with zero `as any`
- Habits screen opens in <100ms with 20 habits × 90-day history

---

## Phase 2.4 — Performance & Polish

**Timeline:** 2-3 days

### A. FlashList audit

- Grep for `.map(` inside ScrollView / View rendering >20 items
- Convert to FlashList where appropriate
- Candidates: habit list, engine task lists, achievement gallery, journal history, quest list
- `@shopify/flash-list` is already in deps

### B. Loading skeletons

- `src/components/ui/Skeleton.tsx` — reusable (rectangle, card, metric variants)
- Replace "Loading..." text on HQ, engines, profile, track, hub subscreens
- Use `LinearGradient` shimmer effect

### C. Explicit worklet directives

- Audit all callbacks passed to `useAnimatedStyle`, `useAnimatedProps`, `useAnimatedGestureHandler`
- Add `'worklet'` directive explicitly (Reanimated 4 infers, but explicit is clearer)

### D. JetBrains Mono via expo-font

- Add `JetBrainsMono-Regular.ttf`, `JetBrainsMono-Bold.ttf` to `assets/fonts/`
- Load in root layout via `useFonts` hook
- Update `src/theme/typography.ts` mono stack: JetBrainsMono → Menlo → monospace
- Aesthetic parity with web app

### E. Orphaned asset audit

- Shell script: grep every MP3 filename in `assets/audio/` and `titan-voice-lines/` against `src/` and `app/`
- List unreferenced files → manually review → delete

### F. Jest test framework

- Install `jest-expo` preset
- `src/__tests__/scoring.test.ts` — weighted titan score per archetype, edge cases
- `src/__tests__/streaks.test.ts` — streak break, recovery, DST boundary, month boundary
- `src/__tests__/progression.test.ts` — phase advancement math, `firstUseDate` edge cases
- `src/__tests__/schemas.test.ts` — Zod validation happy path + malformed data
- `src/__tests__/rank-up-queue.test.ts` — enqueue/dequeue, no duplicates, persists across reload

### Verification for Phase 2.4
- Habits screen, achievements gallery scroll at 60fps on mid-range Android
- Loading skeletons visible on slow network simulation
- `npm test` passes all tests
- Visual comparison before/after JetBrains Mono

---

# PART 3 — Cloud Migration to Supabase

**Timeline:** ~11-13 days total (Phase 3.3 is the biggest single chunk at 4-5 days)

## Phase 3.1 — Supabase Setup & Schema

### A. Project creation
- Create new Supabase project (can use MCP tools for this)
- Region: closest to target audience (likely `us-east-1` or `eu-west-1`)
- Add credentials to `.env`
- Enable Google OAuth + email magic link + email/password providers in dashboard

### B. Schema design

All tables get RLS (`user_id = auth.uid()`).

**Core tables:**
- `profiles` — id (= auth.uid), email, archetype, xp, level, streak_current, streak_best, first_use_date, onboarding_completed, first_task_completed_at, mode, focus_engines (text[]), created_at, updated_at
- `tasks` — id, user_id, engine, title, kind, days_per_week, is_active, created_at, updated_at
- `completions` — id, user_id, task_id, engine, date_key, created_at (unique on task_id+date_key)
- `habits` — id, user_id, title, engine, icon, trigger, duration_minutes, frequency, current_chain, best_chain, last_broken_date, created_at
- `habit_logs` — id, user_id, habit_id, date_key, created_at (unique on habit_id+date_key)
- `protocol_sessions` — id, user_id, date_key, morning_intention, morning_completed_at, evening_reflection, evening_completed_at, titan_score, identity_at_completion (unique on user_id+date_key)
- `progression` — user_id (PK), current_phase, current_week, phase_start_week, first_use_date, phase_start_date, phase_history (jsonb)

**Gamification:**
- `quests` — id, user_id, week_start_key, type, title, description, target, progress, status, xp_reward, created_at, expires_at
- `boss_challenges` — id, user_id, boss_id, started_at, progress, days_required, evaluator_type, status, resolved_at
- `achievements_unlocked` — id, user_id, achievement_id, unlocked_at (unique on user_id+achievement_id)
- `skill_tree_progress` — id, user_id, engine, node_id, state, progress, claimed_at
- `rank_up_events` — id, user_id, from_level, to_level, created_at, dismissed_at (replaces MMKV queue)

**Content/logging:**
- `journal_entries` — id, user_id, date_key, content, updated_at (unique on user_id+date_key)
- `gym_sessions`, `gym_sets`, `gym_templates`, `personal_records`
- `sleep_logs`, `weight_logs`, `meal_logs`, `nutrition_profile`
- `money_transactions`, `budgets`
- `deep_work_sessions`
- `narrative_entries` — id, user_id, flag, seen_at

**Billing (Phase 4):**
- `subscriptions` — user_id (PK), status, product_id, expires_at, renewed_at, will_renew, updated_at (written by RevenueCat webhook)

**Index strategy:**
- `user_id` indexed on every table
- Compound indexes where queried together: `(user_id, date_key)`, `(user_id, engine)`, etc.
- `updated_at` trigger on all tables for last-write-wins conflict resolution

### C. Generate TypeScript types
- Use Supabase CLI or MCP `generate_typescript_types`
- Save to `src/types/supabase.ts`

---

## Phase 3.2 — Auth Flow

### A. Client setup
- Install `@supabase/supabase-js`, `@react-native-async-storage/async-storage`
- `src/lib/supabase.ts`:
```
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
export const supabase = createClient(URL, KEY, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }
});
```
- `src/stores/useAuthStore.ts` — subscribes to `supabase.auth.onAuthStateChange`

### B. Auth screens
- `app/(auth)/_layout.tsx` — Stack, no header, dark background
- `app/(auth)/login.tsx` — Continue with Google / Sign in with email / Create account
- `app/(auth)/email-login.tsx` — email + password + magic link toggle
- `app/(auth)/signup.tsx` — email + password + confirm
- `app/(auth)/verify.tsx` — magic link deep link handler via `titan-protocol://auth/verify`

### C. Google Sign-In native integration
- `expo-auth-session` with Google provider OR `@react-native-google-signin/google-signin`
- Configure OAuth client IDs in Google Cloud Console (needs SHA-1 from `titan-release.jks`)
- Add to `app.json` plugins

### D. Route guarding
- In `app/_layout.tsx`, check auth state before rendering main Stack
- `!user` → `<Redirect href="/(auth)/login" />`
- `user && !profileLoaded` → show loading
- `user && !profile.onboarding_completed` → `<Redirect href="/onboarding" />`
- Else → normal app
- Onboarding completion upserts row into `profiles` table

### E. Sign-out flow
- Settings → Sign out → `supabase.auth.signOut()` → clear React Query cache → clear MMKV cache → redirect to login

---

## Phase 3.3 — Data Layer Refactor (biggest phase)

### A. Service layer

`src/services/` — one file per domain, all async, typed:
- `tasks.ts`: `getTasks(engine)`, `createTask(input)`, `deleteTask(id)`, `getCompletions(engine, dateRange)`, `toggleCompletion(taskId, dateKey)`
- `habits.ts`: similar
- `protocol.ts`: `getProtocolSession`, `saveMorning`, `saveEvening`
- `quests.ts`, `achievements.ts`, `skill-trees.ts`, `progression.ts`, `journal.ts`, `gym.ts`, `nutrition.ts`, `sleep.ts`, `weight.ts`, `money.ts`, `rank-ups.ts`
- RLS handles `user_id` scoping automatically

### B. React Query integration
- Install `@tanstack/react-query`, `@tanstack/react-query-persist-client`
- QueryClient provider in `app/_layout.tsx`
- Convert service calls to hooks:
  - `useTasks(engine)` — `useQuery({ queryKey: ['tasks', engine], queryFn: () => tasks.getTasks(engine) })`
  - `useCreateTask()` — `useMutation` with optimistic update via `queryClient.setQueryData`
  - `useToggleCompletion()` — optimistic + rollback on error
- Default stale time: 5 minutes; refetch on app focus

### C. Shrink Zustand stores
- Data-persisting stores become either **deleted entirely** (data moves to React Query) or **UI-state-only** (keep `useModeStore`, date navigation, modal visibility, etc.)
- Outcome: ~30 stores → ~8 thin UI-state stores

### D. MMKV → offline cache only
- Install `@tanstack/query-async-storage-persister`
- MMKV adapter wrapping the AsyncStorage API
- Persist all queries to MMKV on every mutation
- App launch: hydrate from cache instantly → render UI → refetch in background

---

## Phase 3.4 — Offline-First Sync

### A. Network state
- Install `@react-native-community/netinfo`
- Global `useIsOnline()` hook
- Banner/toast when offline

### B. Mutation queue
- React Query's built-in mutation persistence + `onlineManager.setOnline(isOnline)`
- Offline mutations queue in MMKV
- On reconnect, auto-replay in order
- Failed mutations → error log + debug screen

### C. Conflict resolution
- Server authoritative for: streaks, protocol sessions, progression phase, achievements, rank-up events
- Client-wins (last-write-wins via `updated_at`) for: tasks, habits, journal entries, logs
- DB triggers auto-update `updated_at`

### D. Background sync
- On app resume, invalidate critical queries: profile, current engine, today's completions
- No push-based realtime for v1

---

## Phase 3.5 — MMKV → Supabase Migration

One-time, runs on first launch after cloud-enabled version is installed.

### A. Migration script (`src/lib/migrate-to-supabase.ts`)
- Check MMKV for `migration_to_cloud_completed: boolean`
- If false and user is authenticated:
  1. Read all local data (tasks, habits, protocol sessions, quests, etc.)
  2. Batch upload to Supabase (one transaction per table where possible)
  3. Verify row counts
  4. Set `migration_to_cloud_completed: true`
  5. Keep MMKV data as safety net for 30 days
- If migration fails: log, retry next launch, user keeps using local data meanwhile

### B. UI during migration
- Full-screen modal: "Syncing your Titan Protocol to the cloud..." with progress
- Cinematic-themed (reuse HUD effects)
- Don't block app usage after initial sync — subsequent sessions skip entirely

---

## Phase 3.6 — Realtime Multi-Device Sync
**Deferred to post-launch.** Add later if users request it. Would use Supabase Realtime channels to subscribe to row changes and invalidate React Query caches.

### Verification for Part 3
- Fresh install → sign in → onboarding → create tasks → kill app → sign in on second device → data present
- Offline: create task → go online → task syncs
- Kill app mid-mutation → relaunch → mutation still queued → completes
- Migration: install old version → use it → install new version → data migrates to cloud without loss

---

# PART 4 — Play Store Launch with Freemium

**Timeline:** ~1 week dev + 2 weeks testing/rollout

## Phase 4.1 — Subscription Infrastructure (RevenueCat)

### A. RevenueCat setup
- Create RevenueCat account (free tier up to $10k MRR)
- Create project "Titan Protocol"
- Connect to Google Play Console (requires Play Console account — $25 one-time)
- Create products in Play Console → sync to RevenueCat:
  - `titan_monthly` — $6.99/month (validate in beta)
  - `titan_annual` — $49.99/year (BEST VALUE)
  - Optional: `titan_lifetime` — $119.99 one-time
- Create RevenueCat entitlement `titan_access` including all three

### B. Client integration
- Install `react-native-purchases`
- Initialize in root layout: `Purchases.configure({ apiKey: REVENUECAT_ANDROID_KEY })`
- On auth state change: `Purchases.logIn(supabaseUserId)` — links RC user to Supabase user
- `src/lib/subscription.ts` — `useIsSubscribed()` hook reading RC customer info + Supabase `subscriptions` table

### C. Webhook → Supabase edge function
- Create Supabase edge function: `/functions/revenuecat-webhook`
- Receives RC events (INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, REFUND)
- Updates `subscriptions` table
- Configure webhook URL in RevenueCat dashboard

### D. Feature gating
- `<PaidFeature fallback={<PaywallTrigger />}>` wrapper component
- Gated routes: everything except `(auth)`, `/onboarding`, `/tutorial`, first-session `(tabs)`, `/(modals)/paywall`
- Check on app launch + on resume + every gated screen mount

---

## Phase 4.2 — Paywall UX

### A. Freemium trigger (per user spec)
- Onboarding: **free** (quiz, archetype, schedule)
- Tutorial + first-launch cinematic: **free**
- Dashboard view after onboarding: **free**
- Add first task: **free**
- **Complete first task → paywall triggers**
- Every subsequent action requires subscription

### B. Tracking the trigger
- `first_task_completed_at` column in Supabase `profiles` table
- On first completion → set column → navigate to `/(modals)/paywall` as fullScreenModal
- User can dismiss paywall once (soft wall) → any further interaction shows hard wall

### C. Paywall screen (`app/(modals)/paywall.tsx`)
- Hero: cinematic-themed animated background (reuse HUD effects + particle field)
- Headline: "You've completed your first mission."
- Subheadline: "Continue your 365-day transformation."
- Two pricing cards, annual highlighted with "BEST VALUE" ribbon
- Feature list with checkmark animations: Unlimited tasks, Full cinematic story, Boss challenges, Skill trees, Multi-device sync, Daily briefings, All 4 engines
- CTA: "Subscribe" → `Purchases.purchasePackage(pkg)` → on success, close modal
- "Restore Purchases" link (Google Play requirement)
- Terms of Service + Privacy Policy links (Google Play requirement)

### D. Grace period + lapse handling
- Subscription expires → 3-day grace period ("Your subscription expired, renew to continue")
- After grace: lock to paywall + read-only dashboard
- **Never delete user data on lapse** — Supabase keeps it, just gated on sub status

---

## Phase 4.3 — Play Store Assets & Listing

### A. Required assets
- App icon 512×512 — ✅ have
- **Feature graphic 1024×500** — need to create (cinematic HUD hero)
- **Phone screenshots** (2 min, 8 recommended) — need to capture:
  1. HQ dashboard with radar chart
  2. Engine detail + task list
  3. Rank-up cinematic (RankUpScene captured)
  4. Skill tree screen
  5. Protocol (morning) screen
  6. Quests + boss challenge
  7. Archetype selection
  8. Analytics/stats screen
- Short description (80 chars)
- Full description (4000 chars)

### B. Legal pages (required)
- Privacy policy — host on Vercel / GitHub Pages at e.g. `titanprotocol.app/privacy`
- Terms of service — same
- Content: Supabase as data processor, RevenueCat for payments, analytics tools, user rights (GDPR/CCPA — right to deletion, data export)

### C. Play Console setup
- Create Google Play Console account ($25 one-time)
- Create app listing, fill out:
  - App details (name, short desc, full desc, category: Productivity or Health & Fitness)
  - Store listing (graphics + screenshots)
  - **Data safety form** — declare: email, user-generated content (tasks/habits/journal), usage analytics; encryption in transit, deletion on request
  - **Content rating** questionnaire (likely PEGI 3 / ESRB Everyone)
  - **Target audience** (13+)
  - **App access** — describe freemium
  - **Ads** — No
  - Countries/regions → worldwide except exclusions

---

## Phase 4.4 — Pre-Launch Quality Gate

### A. Error tracking with Sentry
- Install `@sentry/react-native`
- Configure in `app/_layout.tsx`
- Wire source maps via EAS build hooks
- Replace `src/lib/error-log.ts` ring buffer for production (keep both if useful for dev debug screen)
- Alert on crash-free rate < 99.5%

### B. Analytics with PostHog
- Install `posthog-react-native`
- Track key events:
  - `app_opened`, `onboarding_step_completed`, `archetype_selected`
  - `first_task_added`, `first_task_completed`
  - `paywall_shown`, `paywall_price_selected`, `paywall_subscribe_clicked`, `paywall_purchase_succeeded`, `paywall_purchase_failed`, `paywall_dismissed`
  - `subscription_started`, `subscription_cancelled`, `subscription_expired`
  - `rank_up`, `phase_advanced`, `boss_started`, `boss_defeated`, `boss_failed`
  - `streak_broken`, `streak_milestone_reached`
- User properties: archetype, current_level, current_phase, subscription_status, days_since_first_use
- **Critical funnel:** install → onboarding_completed → first_task_added → first_task_completed → paywall_shown → purchase_succeeded

### C. Closed testing track
- EAS Build → production AAB
- Upload via EAS Submit → Play Console closed testing track
- Invite 10-20 testers (friends, Discord, Twitter)
- 1-2 week test period
- Collect: crash logs via Sentry, conversion via PostHog, direct feedback via email/form
- **Survey for pricing validation** — "Would you pay $X for this?"

### D. Release readiness checklist
- Crash-free rate > 99.5% in closed testing
- ANR rate < 0.47% (Google Play threshold)
- Subscription flow tested on real device with real payment
- Restore purchases tested
- Offline mode tested
- Android back button tested from every screen
- Deep links tested (magic link, paywall trigger)
- Privacy policy + ToS live and linked
- Data safety form accurate
- All screenshots current
- Short + full description finalized
- In-app version bumped
- `android/app/build.gradle` versionCode incremented

---

## Phase 4.5 — Production Launch

### A. Staged rollout
- Promote closed testing → production
- Start at 10% of users
- Monitor: crash rate, ANR rate, rating, review sentiment, subscription conversion
- Stable for 48h → bump to 50%
- Stable for another 48h → bump to 100%
- If issues: halt rollout, patch, restart staged

### B. Post-launch (week 1)
- Daily Sentry, Play Console vitals, PostHog funnels review
- Respond to every Play Store review
- EAS hotfix pipeline ready (Build → Submit → review in ~2 hours)
- Pin feedback form in the app

---

# Critical Files Reference

## Part 1 (cleanup)
- `CLAUDE.md` (rewrite)
- `tsconfig.json`, `.gitignore`, `.env.example`
- `app/+not-found.tsx` (new)
- `app/_layout.tsx` (add error boundary wrapper)

## Part 2.1 (stability)
- `src/components/ui/Panel.tsx`, `PulsingGlow.tsx`, `SkillTreeNode.tsx`, `TitanProgress.tsx`, `AnimatedBackground.tsx`, `FloatingActionButton.tsx`, `MissionBoard.tsx`, `MissionRow.tsx`
- `src/stores/useEngineStore.ts`, `useProfileStore.ts`
- `app/engine/[id].tsx`, `app/(tabs)/index.tsx`, `app/_layout.tsx`
- `src/lib/overlay-orchestrator.ts` (new)
- `src/theme/shadows.ts`

## Part 2.2 (data integrity)
- `src/stores/useProtocolStore.ts`, `useSkillTreeStore.ts`
- `src/db/storage.ts`, `src/db/keys.ts` (new)
- `src/lib/schemas.ts` (new), `src/lib/error-log.ts` (new)

## Part 2.3 (architecture)
- `app/(tabs)/track.tsx` → `app/(tabs)/track/_layout.tsx`, `habits.tsx`, `journal.tsx`, `goals.tsx`
- `src/components/ui/ScreenHeader.tsx` (new)
- `app.json` (typedRoutes)
- `src/stores/useHabitStore.ts` (denormalize stats)

## Part 2.4 (polish)
- `src/components/ui/Skeleton.tsx` (new)
- `assets/fonts/JetBrainsMono-*.ttf` (new)
- `src/theme/typography.ts`
- `src/__tests__/*.test.ts` (new)
- `jest.config.js` (new)

## Part 3 (cloud)
- `src/lib/supabase.ts` (new), `src/stores/useAuthStore.ts` (new)
- `app/(auth)/*` (new)
- `src/services/*` (new — ~15 files)
- `src/types/supabase.ts` (generated)
- All of `src/stores/*` (shrunk or deleted)
- `src/lib/migrate-to-supabase.ts` (new)

## Part 4 (launch)
- `src/lib/subscription.ts` (new), `src/lib/analytics.ts` (new)
- `app/(modals)/paywall.tsx` (new)
- `supabase/functions/revenuecat-webhook/index.ts` (new)
- `app.json` (Sentry, PostHog, Google Sign-In plugins)
- `.env.example` (final keys)

---

# Existing Utilities to Reuse

Don't reinvent these — they're already good:

- `src/db/storage.ts` `getJSON`/`setJSON` — stays as MMKV wrapper, will be adapted for React Query persister in Phase 3.4
- `src/components/3d/RankUpScene.tsx` — already correct, just needs to mount from the new queue system
- `src/components/ui/SystemWindow.tsx` — reuse for paywall modal chrome
- `src/components/ui/Panel.tsx` — reuse in paywall feature list
- Existing haptics system — reuse in paywall CTA
- `src/components/ui/AchievementToast.tsx` — **reference implementation for the rank-up queue pattern**
- `src/stores/useAchievementStore.ts` `pendingCelebration` — **template to copy for rank-up queue refactor**
- Existing theme tokens in `src/theme/` — reuse everywhere, no new design system needed

---

# Timeline Summary

| Phase | Work Days |
|---|---|
| Part 1 — Cleanup | 1-2 |
| Phase 2.1 — Stability (fixes 2 bugs) | 2-3 |
| Phase 2.2 — Data integrity | 2 |
| Phase 2.3 — Architecture | 2-3 |
| Phase 2.4 — Polish | 2-3 |
| Phase 3.1-3.2 — Supabase + auth | 2 |
| Phase 3.3 — Data layer refactor | 4-5 ← biggest |
| Phase 3.4 — Offline sync | 2 |
| Phase 3.5 — Migration | 1 |
| Phase 4.1-4.2 — Subscription + paywall | 2-3 |
| Phase 4.3 — Store assets + listing | 1-2 |
| Phase 4.4 — Quality gate + closed testing | ~1 week calendar |
| Phase 4.5 — Staged rollout | 1-2 weeks calendar |

**Total: ~5-6 weeks from now to production launch.**

---

# Verification Gates

Each phase gets its own verification — don't move forward until current passes.

- **Phase 2.1:** Real Android device, add 30+ tasks, must not crash. Trigger rank-up from engine detail + protocol completion + habit toggle, overlay appears in all three.
- **Phase 2.2:** Corrupt MMKV via debug tool → graceful fallback. Kill app mid-protocol → relaunches, repairs. `tsc --noEmit` shows zero `as any` in storage/store code.
- **Phase 2.3:** Navigate Track → Habits → back → Track, tab persists. Typed routes pass `tsc --noEmit`. Habits screen opens <100ms with 20 habits × 90-day history.
- **Phase 2.4:** `npm test` passes. FlashList screens scroll at 60fps. JetBrains Mono visibly loaded.
- **Phase 3:** Cross-device sync works. Offline mutations replay on reconnect. Migration from local-only installs uploads cleanly.
- **Phase 4:** Real subscription purchase end-to-end on closed testing. Sentry captures crashes. PostHog funnels tracking. Crash-free rate > 99.5% before production promote. Staged rollout stable at each step.

---

# Change Log

- **2026-04-06** — Initial roadmap created by Claude after repo analysis. Diagnosed the 15+ task crash and the rank-up overlay bug. Plan approved by Arun in planning session.
- **2026-04-06** — **Part 1 complete.** Repo restructured (mobile → root, web → `legacy/`), `android/` now tracked in git (53 files, build artifacts excluded), new mobile-first CLAUDE.md at repo root, baseline safety nets added (`app/+not-found.tsx`, `src/components/ui/RootErrorBoundary.tsx`, `.env.example` with Supabase/RevenueCat/Sentry/PostHog placeholders), stale `test-onboarding.ts` / `test-simulation.ts` deleted, 4 clean commits. Backup at `~/Documents/Projects/Titan/titan-protocol.BACKUP-2026-04-06` and `~/titan-critical-backup-2026-04-06/` can be deleted once smoke test on real device confirms everything works. Git rollback tag: `pre-restructure-2026-04-06`.
- **2026-04-06** — **Phase 2.1 complete.** Both user-reported bugs fixed: (1) 15+ task crash addressed via animation cleanup in 10 files (Panel, MissionRow, HabitChain, SkillTreeNode+v2, TitanProgress, PulsingGlow, AnimatedBackground, FloatingActionButton, MissionBoard) + single-atomic addTask/deleteTask in useEngineStore + MissionRow memoization (taskId API + stable gesture) + Android elevation cap via Platform.select. (2) Rank-up overlay fixed via persistent `pendingRankUps` queue in useProfileStore, detection moved into `awardXP()`, overlay mounted in `app/_layout.tsx`. Overlay priority order made explicit via documented render sequence. 6 commits (2.1A–2.1F). Needs smoke test on a real Android device to confirm the crash is gone and rank-up triggers from all screens.
- **2026-04-06** — **Phase 2.2 complete.** Data integrity hardened before the Supabase migration. (A) Protocol session writes now use a write-ahead flag (`protocol_write_pending`) so crashes mid-multi-key-write are detected on next launch; shared `computeNewStreak` helper extracted. (B) Silent `catch {}` blocks in `src/db/storage.ts` replaced with a new `src/lib/error-log.ts` ring buffer (last 50 errors, subscribable, will forward to Sentry in Phase 4.4). (C) Zod runtime validation at storage read boundaries via new `src/lib/schemas.ts` with 15+ schemas + `parseOrFallback` helper; first consumer is `useSkillTreeStore.buildSkillTrees()` which replaces the unsafe `(skillTreeData as any)` cast. (D) Central MMKV key registry at `src/db/keys.ts` with typed builders for templated keys; `useEngineStore`, `useProtocolStore`, `useProfileStore`, `useSkillTreeStore` all migrated. 4 commits (2.2A–2.2D). tsc clean throughout. Other stores keep their local key constants since their data moves to Supabase in Phase 3.3.
- **2026-04-07** — **Phase 3.2 complete.** End-to-end Supabase auth is live. Installed `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `react-native-url-polyfill`. New `src/lib/supabase.ts` creates a typed `createClient<Database>` with AsyncStorage session persistence (gated by the Phase 3.1 RLS policies) and exports a `requireUserId()` helper for the service layer. New `src/stores/useAuthStore.ts` is a minimal Zustand store that hydrates the initial session from AsyncStorage and subscribes to `onAuthStateChange` exactly once. Four auth screens under `app/(auth)/`: `login.tsx` (three paths — Google [deferred], Sign in with email, Create account), `email-login.tsx` (password + magic link toggle), `signup.tsx` (email + password + confirm, 8-char min), `verify.tsx` (magic-link deep-link handler — tries PKCE, falls back to implicit, then session check). All match the HUD aesthetic via `HUDBackground`, `FadeIn`/`FadeInDown`, theme tokens. Route guarding added to `app/_layout.tsx`: the root layout calls `initializeAuth()`, blocks render while `isLoading`, and uses `<Redirect>` with `useSegments()` to route unauthenticated users to `/(auth)/login` and redirect post-sign-in users back to `/(tabs)`. A separate lean render path for unauthenticated users bypasses the story/cinematic/integrity overlays entirely. `tsc --noEmit` zero errors, 67/67 Jest tests pass. **Deferred:** Google OAuth button shows a 'coming soon' alert until `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` is populated from a Google Cloud Console OAuth client registered against the SHA-1 of `titan-release.jks`; profile-based onboarding gating (redirect to `/onboarding` if `!profile.onboarding_completed`) happens in Phase 3.3 when the data layer is in place.
- **2026-04-07** — **Phase 3.1 complete.** Cloud backend is live. Created Supabase project `Titan Protocol` (ref `rmvodrpgaffxeultskst`, region `ap-south-1`). Applied 6 migrations: (1) foundation — 9 enums, `set_updated_at()` trigger fn, `profiles` table with auto-create trigger on `auth.users` INSERT; (2) core — `tasks`, `completions`, `habits` (with denormalized chain fields from 2.3F), `habit_logs`, `protocol_sessions` (one row per day, fixes the 2.2A dual-write race), `progression`; (3) gamification — `quests`, `boss_challenges`, `achievements_unlocked`, `skill_tree_progress`, `rank_up_events` (replaces the MMKV queue from 2.1E); (4) content — `journal_entries`, 5 gym tables, `sleep_logs`, `weight_logs`, `nutrition_profile`, `meal_logs`, `money_transactions`, `budgets`, `deep_work_sessions`, `narrative_entries`; (5) billing + RLS — `subscriptions` (written by RevenueCat webhook in 4.1, read-only to client), RLS enabled and policies attached on all 27 tables; (6) hardening — pinned `set_updated_at()` search_path. **27 tables, 0 Supabase security advisor lints.** Generated `src/types/supabase.ts` (1300 lines) via MCP `generate_typescript_types`. `.env.example` + `.env` populated with project URL and publishable anon key (RLS-gated, safe to commit to `.env.example`). `tsc --noEmit` clean.
- **2026-04-06** — **Phase 2.4 complete.** Polish + safety net before the Supabase migration. Pre: fixed the 4 lingering pre-existing TypeScript errors in onboarding Beat components (`SharedValue` was being accessed via `Animated.SharedValue` instead of imported as a top-level type) — `tsc --noEmit` now reports zero errors for the first time. (D) JetBrains Mono loaded via `@expo-google-fonts/jetbrains-mono` — root layout uses `useFonts` and gates render until ready, typography theme switched to the loaded font names. (B) New `src/components/ui/Skeleton.tsx` with Skeleton/SkeletonGroup/SkeletonCard primitives (animated pulse with cleanup-on-unmount). Adoption deferred until Phase 3.3 React Query introduces real `isLoading` states. (A) FlashList audit: `budgets.tsx` converted, `cashflow.tsx` unused import removed, `engine/[id].tsx` already using FlashList; `workouts.tsx` and `track.tsx` audited and intentionally not converted (low ROI / overlap with deferred refactors). (F) Jest framework added with `jest-expo` preset — 67 unit tests across 3 suites (scoring 27, dates 16, schemas 24) covering the most safety-critical pure-function logic. **Skipped (low value):** 2.4C explicit worklet directives, 2.4E orphaned asset audit. 7 commits (2.4-pre, 2.4D, 2.4B, 2.4A, 2.4F, plus the typing fix). Completes Part 2 of the roadmap. Ready for Part 3 (Supabase cloud migration).
- **2026-04-06** — **Phase 2.3 complete (with deferrals).** Architecture cleanup focused on the high-impact fixes. (F) Habit stats moved from O(N×days×2) MMKV reads to a single warm-then-iterate-in-memory pass via new `useHabitStore.loadDateRange()` action; `getHabitStats()` reads from cache, `HabitChain` component reads from cache, analytics screen warms before per-habit calls — net ~1200 disk reads → ~30 on the analytics screen. (E) Removed orphaned `app/settings/index.tsx` (zero consumers); `app/hub/settings.tsx` is canonical. (B partial) Track sub-tab selection now persists to MMKV under `track_active_tab` so navigating away and back restores the user's last view; full expo-router route split deferred to Phase 2.4 because the existing 1000-line file shares state across tabs. (C) All 7 `router.push("..." as any)` casts removed: static routes lose the cast outright (it was never needed), dynamic-route configs use `Href` from expo-router as the type for the `route` field. **Deferred to Phase 2.4:** (A) overlay orchestrator extraction — current render-order priority is documented and works. (D) shared `ScreenHeader` component — tedious churn across many screens, low blocker value. 4 commits (2.3F, 2.3E, 2.3B, 2.3C).

---

**End of roadmap.**
