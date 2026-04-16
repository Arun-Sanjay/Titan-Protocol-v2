# Titan Protocol — Ship Roadmap

> From clean shell to Google Play release.
> Each phase is a shippable milestone. Complete them in order.

---

## Phase 0: Foundation (data layer core)

Build the three files that every screen depends on.

| Task | File | What |
|---|---|---|
| 0.1 | `src/lib/supabase.ts` | Supabase client — AsyncStorage session, autoRefreshToken, typed with `Database` |
| 0.2 | `src/lib/query-client.ts` | React Query client — MMKV persister for offline cache, staleTime defaults |
| 0.3 | `src/stores/useAuthStore.ts` | Auth store — initialize, onAuthStateChange with recovery, AppState resume refresh (throttled), signOut |
| 0.4 | `src/types/supabase.ts` | Regenerate via Supabase MCP `generate_typescript_types` |
| 0.5 | `src/db/storage.ts` | MMKV instance — device-local prefs ONLY (sound, voice, dev flags, story flags). No user data. |
| 0.6 | Wire `app/_layout.tsx` | QueryClientProvider, auth gates, font loading. Strip all dead store imports. |

**Done when:** App boots, shows login screen, user can sign up/in, session persists across restarts.

---

## Phase 1: Core Loop (tasks + dashboard)

The daily task system is the heart of the app. Wire it first so every subsequent phase has something to build on.

| Task | Files | What |
|---|---|---|
| 1.1 | `src/services/tasks.ts` | listAllTasks, listCompletions, createTask, deleteTask, toggleCompletion, computeEngineScore |
| 1.2 | `src/hooks/queries/useTasks.ts` | useAllTasks, useCompletions, useToggleCompletion (optimistic), useCreateTask, useDeleteTask |
| 1.3 | `src/services/profile.ts` | getProfile, updateProfile, awardXP, updateStreak, completeOnboarding |
| 1.4 | `src/hooks/queries/useProfile.ts` | useProfile, useAwardXP, useUpdateStreak, useCompleteOnboarding |
| 1.5 | Wire `app/(tabs)/index.tsx` | HQ dashboard — engine scores, task list, XP bar, streak badge, daily rank |
| 1.6 | Wire `app/(modals)/add-task.tsx` | Add-task modal — engine picker, title, kind (main/secondary) |
| 1.7 | Wire `app/engine/[id].tsx` | Per-engine mission list — shows tasks for that engine, toggle completion |
| 1.8 | Wire `app/(tabs)/engines.tsx` | Engine summary grid — per-engine scores from cloud data |
| 1.9 | Wire onboarding `BeatSetup.tsx` | Batch task/habit creation during onboarding (already uses direct Supabase inserts) |
| 1.10 | Wire `OnboardingGate.tsx` | Gate on `profile.onboarding_completed` via useProfile |

**Done when:** User completes onboarding → tasks appear on dashboard + engine screens → completing tasks awards XP → streak updates → rank displays correctly.

---

## Phase 2: Habits + Protocol

| Task | Files | What |
|---|---|---|
| 2.1 | `src/services/habits.ts` | listHabits, createHabit, toggleHabit (with chain logic), listHabitLogs |
| 2.2 | `src/hooks/queries/useHabits.ts` | useHabits, useHabitLogs, useToggleHabit (optimistic), useCreateHabit |
| 2.3 | `src/services/protocol.ts` | getSession, startMorning, completeEvening, upsertSession |
| 2.4 | `src/hooks/queries/useProtocol.ts` | useProtocolSession, useStartMorning, useCompleteEvening |
| 2.5 | Wire `app/(tabs)/track.tsx` | Habits tab — habit list with chains, toggle, daily log |
| 2.6 | Wire `app/protocol.tsx` | Morning + evening protocol session screen |

**Done when:** Habits track with chains, protocol sessions log to cloud, track tab shows daily completion.

---

## Phase 3: Progression + Rank-ups

| Task | Files | What |
|---|---|---|
| 3.1 | `src/services/rank-ups.ts` | enqueueRankUp, listPending, dismissRankUp |
| 3.2 | `src/hooks/queries/useRankUps.ts` | usePendingRankUps, useEnqueueRankUp, useDismissRankUp |
| 3.3 | `src/services/progression.ts` | getProgression, upsertProgression |
| 3.4 | `src/hooks/queries/useProgression.ts` | useProgression |
| 3.5 | Wire `RankUpOverlayMount.tsx` | Rank-up celebration overlay reads from cloud queue |
| 3.6 | Wire `app/(tabs)/profile.tsx` | Profile screen — XP, level, rank tier, streak, archetype |
| 3.7 | Wire level-up detection | awardXP → detect level change → enqueue rank-up event |

**Done when:** Completing tasks → XP awarded → level up detected → rank-up overlay fires → profile shows correct level/rank.

---

## Phase 4: Cinematics + Story

| Task | Files | What |
|---|---|---|
| 4.1 | Wire `app/_layout.tsx` overlay system | Day cinematics, daily briefing, integrity overlays, surprise system |
| 4.2 | Wire `FirstLaunchCinematic` | Day 1 cinematic flow |
| 4.3 | Wire all `Day*Cinematic.tsx` | Days 2-14, 30, 45, 60, 90, 365 — verify all fire on correct days |
| 4.4 | Wire `DailyBriefing` | Daily briefing with operation codename, task preview |
| 4.5 | Wire `useStoryStore` | Story flags, cinematic played state (MMKV — device-local) |
| 4.6 | Wire `StreakBreakCinematic` + `ComebackCinematic` | Integrity system overlays |

**Done when:** App shows correct cinematic on each day, briefing on non-cinematic days, integrity overlays on missed days.

---

## Phase 5: Hub Screens (trackers)

Each hub screen is self-contained. Wire them one at a time.

| Task | Service | Screen | Table |
|---|---|---|---|
| 5.1 | `services/journal.ts` | `app/(tabs)/track.tsx` (journal tab) | `journal_entries` |
| 5.2 | `services/goals.ts` | `app/(tabs)/track.tsx` (goals tab) | `goals` |
| 5.3 | `services/budgets.ts` | `app/hub/budgets.tsx` + `cashflow.tsx` | `budgets`, `money_transactions` |
| 5.4 | `services/weight.ts` | `app/hub/weight.tsx` | `weight_logs` |
| 5.5 | `services/sleep.ts` | `app/hub/sleep.tsx` | `sleep_logs` |
| 5.6 | `services/nutrition.ts` | `app/hub/nutrition.tsx` | `meal_logs`, `nutrition_profile` |
| 5.7 | `services/gym.ts` | `app/hub/workouts.tsx` | `gym_sessions`, `gym_sets`, `gym_exercises`, `gym_templates`, `gym_personal_records` |
| 5.8 | `services/focus.ts` | `app/hub/focus.tsx` + `deep-work.tsx` | `focus_sessions`, `focus_settings`, `deep_work_sessions` |
| 5.9 | `services/analytics.ts` | `app/hub/analytics.tsx` | Computed from existing tables |
| 5.10 | | `app/hub/settings.tsx` | Sign-out, preferences, dev tools |
| 5.11 | | `app/hub/command.tsx` | Command center (operation engine) |

**Done when:** Every hub screen reads/writes from Supabase. No MMKV data reads in any hub screen.

---

## Phase 6: Gamification Systems

| Task | Service/Hook | Screen | Table |
|---|---|---|---|
| 6.1 | `services/achievements.ts` | `app/achievements.tsx` | `achievements_unlocked` |
| 6.2 | `services/quests.ts` | `app/quests.tsx` | `quests` |
| 6.3 | `services/field-ops.ts` | `app/field-ops.tsx` | `field_ops`, `field_op_cooldown` |
| 6.4 | `services/skill-tree.ts` | `app/skill-tree/` | `skill_tree_progress` |
| 6.5 | `services/titles.ts` | `app/titles.tsx` | `user_titles` |
| 6.6 | `services/boss.ts` | Boss challenge modal | `boss_challenges` |
| 6.7 | `services/narrative.ts` | `app/narrative.tsx` | `narrative_entries`, `narrative_log` |
| 6.8 | `services/mind-training.ts` | `app/mind-training.tsx` | `mind_training_results`, `srs_cards` |
| 6.9 | `services/titan-mode.ts` | Profile + mode toggle | `titan_mode_state` |
| 6.10 | Wire achievement checker | Auto-check on task/habit/protocol completion | `achievements_unlocked` |

**Done when:** All gamification screens are fully cloud-backed. Achievements unlock, quests generate, skill tree progresses, titles are earned.

---

## Phase 7: Polish + Ship Prep

| Task | What |
|---|---|
| 7.1 | `useAppResumeSync` — invalidate key caches on app foreground |
| 7.2 | Offline support — React Query MMKV persister ensures reads work offline, mutations queue |
| 7.3 | Error boundaries — `RootErrorBoundary` catches render crashes, shows recovery UI |
| 7.4 | Loading states — skeleton screens for every data-dependent view |
| 7.5 | Empty states — meaningful empty state messages for every list (missions, habits, journal, etc.) |
| 7.6 | Pull-to-refresh — wire on HQ, engines, track, profile |
| 7.7 | Date/time resilience — no logout on clock change, no cinematic re-fire |
| 7.8 | Rapid-tap guard — in-flight mutex on task toggle, no cascading mutations |
| 7.9 | Android shadow safety — audit every component for raw `elevation`, use `shadows.*` |
| 7.10 | Animation cleanup — audit every `withRepeat(-1)` for `cancelAnimation()` in cleanup |

**Done when:** App handles offline, clock changes, rapid taps, and edge cases without crashing or data corruption.

---

## Phase 8: Observability + Analytics

| Task | What |
|---|---|
| 8.1 | Sentry — crash reporting, breadcrumbs, user context |
| 8.2 | PostHog — typed event taxonomy, screen views, funnel tracking |
| 8.3 | Error log — `src/lib/error-log.ts` ring buffer for debugging |
| 8.4 | Performance — `get_advisors({ type: "performance" })` on Supabase |
| 8.5 | Security audit — `get_advisors({ type: "security" })`, verify all RLS policies |

**Done when:** Crashes are reported, user behavior is tracked, database is optimized and secure.

---

## Phase 9: Store Listing + Release

| Task | What |
|---|---|
| 9.1 | App icon + splash screen — already in assets/ |
| 9.2 | Play Store listing — screenshots, description, feature graphic |
| 9.3 | Privacy policy — data handling disclosure |
| 9.4 | EAS production build — `eas build --profile production --platform android` |
| 9.5 | Internal testing track — upload to Play Console, smoke test |
| 9.6 | Open testing / production release |
| 9.7 | RevenueCat — freemium paywall (if launching with paid tier) |

**Done when:** App is live on Google Play.

---

## Phase Summary

| Phase | Scope | Screens Wired | Priority |
|---|---|---|---|
| **0** | Foundation | 0 (infra only) | **CRITICAL** |
| **1** | Core Loop | 5 (HQ, engines, engine detail, add-task, onboarding) | **CRITICAL** |
| **2** | Habits + Protocol | 2 (track habits, protocol) | **HIGH** |
| **3** | Progression | 2 (profile, rank-up overlay) | **HIGH** |
| **4** | Cinematics | 0 (overlay system in _layout) | **HIGH** |
| **5** | Hub Screens | 11 (all trackers) | **MEDIUM** |
| **6** | Gamification | 8 (achievements, quests, field-ops, etc.) | **MEDIUM** |
| **7** | Polish | 0 (cross-cutting quality) | **HIGH** |
| **8** | Observability | 0 (monitoring infra) | **MEDIUM** |
| **9** | Store Release | 0 (publishing) | **FINAL** |

**Phases 0-4 = MVP.** The app is usable after Phase 4. Phases 5-6 add depth. Phases 7-9 make it shippable.

---

## Supabase Tables by Phase

| Phase | Tables Used |
|---|---|
| 0 | `profiles` (auth bootstrap) |
| 1 | `tasks`, `completions`, `profiles` |
| 2 | `habits`, `habit_logs`, `protocol_sessions` |
| 3 | `rank_up_events`, `progression` |
| 4 | None (MMKV story flags only) |
| 5 | `journal_entries`, `goals`, `budgets`, `money_transactions`, `weight_logs`, `sleep_logs`, `meal_logs`, `nutrition_profile`, `gym_*` (5 tables), `focus_sessions`, `focus_settings`, `deep_work_sessions` |
| 6 | `achievements_unlocked`, `quests`, `field_ops`, `field_op_cooldown`, `skill_tree_progress`, `user_titles`, `boss_challenges`, `narrative_entries`, `narrative_log`, `mind_training_results`, `srs_cards`, `titan_mode_state` |
| 7-9 | `subscriptions` (RevenueCat) |

---

## Non-Negotiable Rules (carry from old repo)

1. Every screen reads from React Query hooks. No direct Supabase calls from components.
2. Services throw. Hooks catch.
3. Mutations are optimistic.
4. `enabled: Boolean(userId)` on every query.
5. Dates via `lib/date.ts`. Never `.toISOString().slice(0,10)`.
6. `cancelAnimation()` on every `withRepeat(-1)`.
7. Android shadows via `theme/shadows.ts` only.
8. No inline hex colors. Use `colors.*`.
9. TypeScript strict. Zero `@ts-ignore`. `as any` only for Ionicon names and `DimensionValue`.
10. Tests for pure logic in `src/__tests__/`. No component tests (use device testing).
