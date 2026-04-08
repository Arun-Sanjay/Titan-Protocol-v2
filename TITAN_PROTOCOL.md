# Titan Protocol — Complete Project Reference

> **Last updated:** 2026-04-07 (end of full-repo audit + Phase 3.5-3.8 sweep)
> **Status:** Pre-launch. Cloud data layer shipped. Android APK builds green in CI.
> **Owner:** Arun Sanjay
> **Repo:** https://github.com/Arun-Sanjay/Titan-Protocol-v2
> **Package:** `com.titan.protocol`

This document is the single-file encyclopedic reference for Titan Protocol. It's meant to be what you hand a new collaborator (or yourself six months from now) to get the full picture without clicking through 300 files. Read top to bottom once, then jump to sections as needed.

**Canonical source-of-truth documents still live elsewhere:**
- `CLAUDE.md` — rules for Claude Code sessions (conventions, coding style, what not to do)
- `ROADMAP.md` — phase tracker + change log (flip status flags there, not here)
- `ARCHITECTURE.md` — historical architecture doc from pre-restructure era; still relevant for feature context

---

## Table of Contents

1. [What Titan Protocol Is](#1-what-titan-protocol-is)
2. [Current State Snapshot](#2-current-state-snapshot)
3. [Tech Stack](#3-tech-stack)
4. [Repository Layout](#4-repository-layout)
5. [Data Architecture](#5-data-architecture)
6. [Supabase Schema](#6-supabase-schema)
7. [Zustand Store Inventory](#7-zustand-store-inventory)
8. [Cloud Service + React Query Layer](#8-cloud-service--react-query-layer)
9. [Routes & Screens](#9-routes--screens)
10. [Component Inventory](#10-component-inventory)
11. [Library Helpers (`src/lib/`)](#11-library-helpers-srclib)
12. [Theme System](#12-theme-system)
13. [Auth Flow](#13-auth-flow)
14. [Boot Sequence](#14-boot-sequence)
15. [Native Build Configuration](#15-native-build-configuration)
16. [Environment Variables](#16-environment-variables)
17. [CI/CD Pipeline](#17-cicd-pipeline)
18. [Testing](#18-testing)
19. [Assets](#19-assets)
20. [Phase History (Completed Work)](#20-phase-history-completed-work)
21. [Known Bugs & Tech Debt](#21-known-bugs--tech-debt)
22. [Remaining Work (Pre-Launch)](#22-remaining-work-pre-launch)
23. [Pricing & Monetization](#23-pricing--monetization)
24. [Critical Invariants & Conventions](#24-critical-invariants--conventions)
25. [Architectural Decisions Log](#25-architectural-decisions-log)
26. [Glossary](#26-glossary)

---

## 1. What Titan Protocol Is

Titan Protocol is a **gamified 365-day personal performance operating system** for mobile. It's built around four "engines" representing the pillars of a high-performance life:

| Engine | Color | Meaning |
|---|---|---|
| **Body** | `#00FF88` (green) | Physical capacity — workouts, sleep, nutrition, recovery |
| **Mind** | `#A78BFA` (violet) | Intellectual edge — deep work, learning, mind training |
| **Money** | `#FBBF24` (gold) | Financial system — income, budgeting, cashflow, capital |
| **Charisma** | `#60A5FA` (blue) | Social influence — presence, communication, network |

### The 365-day arc
Users commit to a yearlong journey from Day 1 to Day 365, with scripted story beats at Day 1-14 (daily cinematics), Day 30, 45, 60, 90, and 365. Each day has a Morning Protocol and Evening Protocol ritual. Between them, the user tracks tasks, habits, and metrics against their four engines.

### Core loops
- **Daily loop:** Morning protocol → mission list → habit log → evening protocol → score reveal → identity vote
- **Weekly/monthly loop:** Chapters (Foundation → Building → Intensify → Sustain), boss challenges, skill tree unlocks
- **Yearlong loop:** Archetype selection, rank progression (initiate → operative → agent → specialist → commander → vanguard → sentinel → titan), Titan Mode unlock at 30 days × 85%+ average

### Narrative layer
The app has a heavy cinematic/voice-acted story layer. 138 audio files (voice lines, not music) drive:
- Onboarding beats (18 files)
- Day-by-day cinematics (39 files)
- Boss reveals (18 files)
- Rank promotions (8 files)
- Archetype-specific greetings (8 files)
- Failure/streak-break warnings (15 files)
- Surprise/bonus events (12 files)
- Daily greetings (11 files)
- Operation/mission announcements (9 files)

### Progression systems
- **XP & Level** — flat 500 XP per level
- **Rank** — 8 ranks with `avg_score` and `consecutive_days` gates
- **Daily Rank** — graded D/C/B/A/S/SS based on today's Titan Score
- **Streak** — best streak persisted, current streak lives on `profiles.streak_current`
- **Skill trees** — per-engine node trees that unlock passive buffs
- **Quests** — daily + weekly quest generation via `src/lib/quest-generator.ts`
- **Boss challenges** — multi-day challenges with XP rewards
- **Achievements** — ~80 defined achievements across all engines
- **Titles** — unlockable title badges shown on the profile card (`src/lib/titles.ts`)
- **Momentum multiplier** — streak-based XP multiplier
- **Variable rewards** — random XP bonuses via `src/lib/variable-rewards.ts`
- **Archetypes** — 8 identity archetypes (titan, athlete, scholar, hustler, showman, warrior, founder, charmer) each with a 4-engine weight distribution used to compute the weighted Titan Score

### Platform
- **Android first** — Play Store is the launch target, keystore exists at `titan-release.jks` (gitignored)
- **iOS deferred** — no `ios/` directory; will add once Android is stable
- **Web deferred indefinitely** — there's a `react-native-web` dep but no active web target

### Business model
Freemium. Onboarding is free. Paywall triggers after the user completes their first task. Billing via RevenueCat (Phase 4.1, pending).

---

## 2. Current State Snapshot

**As of 2026-04-07 (end of audit remediation sweep):**

- **Build:** APK builds green in CI (run `24090221033` succeeded, artifact `titan-protocol-android-2026.04.07-b7da4b5`).
- **Baseline health:** `npx tsc --noEmit` → 0 errors · `npm test` → 67/67 pass · `expo-doctor` → 2 cosmetic warnings (expo-av deprecation, flash-list minor version).
- **Cloud layer:** Supabase project live (`rmvodrpgaffxeultskst`, region `ap-south-1`). 27 tables, RLS on every one. React Query infrastructure wired. All core consumer screens migrated.
- **MMKV layer:** Still primary storage for ~28 non-core domains (gym, sleep, nutrition, weight, money, budgets, journal content, quests, achievements, skill tree, narrative, story, surprise, field ops, etc.). These don't have cloud service layers yet and are intentionally deferred to Phase 3.9.
- **Play Store:** Not submitted. Signing secrets not yet added to GitHub repo secrets. CI currently falls back to a dev keystore, so the APK is installable but not Play-Store-uploadable.
- **Auth:** Email + password + magic link all live. Google Sign-In deferred until Google Cloud OAuth client is registered against the signing key's SHA-1.
- **Monetization:** Not wired yet (Phase 4.1 pending).
- **Observability:** Not wired yet (Sentry + PostHog pending Phase 4.4). Error log is an in-memory ring buffer (`src/lib/error-log.ts`) ready to forward.

### Commit count
- **159 commits** on `main`
- Most recent: `b7da4b54` (proguard keep rules for expo-av + expo-modules-core DI)

### Source file counts
- **src/** — 266 `.ts`/`.tsx` files, ~52,534 lines total
- **app/** — 46 `.ts`/`.tsx` files (routes)
- **android/** — native project tracked in git (build artifacts gitignored)

---

## 3. Tech Stack

### Runtime
| Layer | Package | Version | Notes |
|---|---|---|---|
| Framework | `expo` | ~55.0.12 | SDK 55 |
| Runtime | `react-native` | 0.83.4 | New Architecture (Fabric + TurboModules) enabled |
| Language | `typescript` | 5.9 | Strict mode |
| React | `react` | 19.2.0 | |
| JS engine | Hermes | — | `hermesEnabled=true` in gradle.properties |
| Node (dev) | 20 | — | Pinned in CI |

### Navigation & UI
| Package | Version | Purpose |
|---|---|---|
| `expo-router` | ~55.0.11 | File-based routing, `app/` directory |
| `react-native-gesture-handler` | ~2.30.0 | Pan + tap gestures |
| `react-native-safe-area-context` | ~5.6.2 | Safe area insets |
| `react-native-screens` | ~4.23.0 | Native screen containers |
| `@expo/vector-icons` | ^15.0.2 | Ionicons (primary icon family) |
| `@expo-google-fonts/jetbrains-mono` | ^0.4.1 | Primary monospace font |

### Animation & Graphics
| Package | Version | Purpose |
|---|---|---|
| `react-native-reanimated` | 4.2.1 | Shared values, worklets, springs — everywhere |
| `react-native-worklets` | 0.7.2 | SDK 55-pinned (downgraded from 0.7.4 in Phase 3.8) |
| `@shopify/react-native-skia` | 2.4.18 | 2D graphics (charts, chain visualizations) |
| `@react-three/fiber` | ^9.5.0 | 3D scenes (rank-up, chapter transitions) |
| `@react-three/drei` | ^10.7.7 | R3F helpers |
| `three` | ^0.183.2 | Three.js core |
| `react-native-svg` | 15.15.3 | SVG rendering |
| `@shopify/flash-list` | 2.0.2 | Virtualized lists |

### State & Data
| Package | Version | Purpose |
|---|---|---|
| `zustand` | ^5.0.12 | Local state stores (33 of them, down from ~30 pre-audit) |
| `react-native-mmkv` | ^4.3.0 | Synchronous local storage |
| `@tanstack/react-query` | ^5.96.2 | Cloud data cache + mutations |
| `@tanstack/react-query-persist-client` | ^5.96.2 | Persist cache to MMKV |
| `@tanstack/query-async-storage-persister` | ^5.96.2 | AsyncStorage adapter (wrapped over MMKV) |
| `@supabase/supabase-js` | ^2.101.1 | Cloud backend |
| `@react-native-async-storage/async-storage` | 2.2.0 | Used ONLY by Supabase for session persistence |
| `@react-native-community/netinfo` | 11.5.2 | Feeds `onlineManager` for offline queue |
| `react-native-url-polyfill` | ^3.0.0 | Required by Supabase on RN |
| `zod` | ^4.3.6 | Runtime validation at storage boundaries |

### Platform APIs
| Package | Version | Purpose |
|---|---|---|
| `expo-haptics` | ~55.0.13 | Haptic feedback |
| `expo-notifications` | ~55.0.17 | Local/push notifications |
| `expo-splash-screen` | ~55.0.16 | Splash screen control |
| `expo-font` | ~55.0.4 | Font loading |
| `expo-linking` | ~55.0.11 | Deep links (magic-link auth) |
| `expo-sharing` | ~55.0.17 | Share sheet |
| `expo-status-bar` | ~55.0.5 | Status bar styling |
| `expo-system-ui` | ~55.0.14 | System UI color control |
| `expo-linear-gradient` | ~55.0.12 | Gradients |
| `expo-gl` | ~55.0.12 | Required by R3F |
| `expo-constants` | ~55.0.9 | App constants / manifest |
| `expo-av` | ^16.0.8 | Audio playback (voice lines). Flagged as unmaintained by expo-doctor — migrate to `expo-audio` post-launch. |
| `expo-speech` | ~55.0.12 | Text-to-speech fallback |
| `react-native-view-shot` | 4.0.3 | Screenshot capture for share cards |

### Dev & Build
| Package | Version | Purpose |
|---|---|---|
| `babel-preset-expo` | ~55.0.12 | Babel config (hoisted to devDeps in Phase 3.7) |
| `jest` | ^29.7.0 | Test runner |
| `jest-expo` | ^55.0.13 | Jest preset for Expo |
| `@types/jest` | ^30.0.0 | Jest type defs (minor version mismatch, cosmetic) |
| `@types/react` | ~19.2.2 | React type defs |

### Not installed (pending phases)
- RevenueCat SDK (Phase 4.1)
- Sentry SDK (Phase 4.4)
- PostHog SDK (Phase 4.4)
- Google Sign-In provider (Phase 3.2 deferral)

---

## 4. Repository Layout

```
titan-protocol/                         ← repo root = mobile app
├── app/                                # expo-router file-based routes (46 files)
│   ├── (auth)/                         # auth stack (4 screens)
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   ├── email-login.tsx
│   │   ├── signup.tsx
│   │   └── verify.tsx                  # magic-link deep-link handler
│   ├── (tabs)/                         # 5-tab bottom nav
│   │   ├── _layout.tsx
│   │   ├── index.tsx                   # HQ dashboard (1016 lines)
│   │   ├── engines.tsx                 # All-engines overview
│   │   ├── track.tsx                   # Habits / Journal / Goals sub-tabs (1055 lines)
│   │   ├── hub.tsx                     # Tools grid
│   │   └── profile.tsx                 # XP, level, streak
│   ├── (modals)/                       # 6 modal routes
│   │   ├── add-task.tsx
│   │   ├── achievement-popup.tsx
│   │   ├── boss-challenge.tsx
│   │   ├── perfect-day.tsx
│   │   ├── phase-transition.tsx
│   │   └── titan-unlock.tsx
│   ├── engine/[id].tsx                 # Engine detail (per-engine task list)
│   ├── hub/                            # 11 hub sub-screens
│   │   ├── _layout.tsx
│   │   ├── analytics.tsx               # Charts + 84-day heatmap
│   │   ├── budgets.tsx
│   │   ├── cashflow.tsx
│   │   ├── command.tsx                 # Cross-engine task view
│   │   ├── deep-work.tsx               # Task tracking + earnings
│   │   ├── focus.tsx                   # Pomodoro timer
│   │   ├── nutrition.tsx
│   │   ├── settings.tsx
│   │   ├── sleep.tsx
│   │   ├── weight.tsx
│   │   └── workouts.tsx
│   ├── skill-tree/
│   │   ├── index.tsx
│   │   └── [engine].tsx                # per-engine skill tree viewer
│   ├── _layout.tsx                     # Root layout (593 lines — orchestrates ~15 overlay types)
│   ├── +not-found.tsx                  # 404 fallback
│   ├── onboarding.tsx
│   ├── walkthrough.tsx
│   ├── tutorial.tsx
│   ├── protocol.tsx                    # Morning/Evening Protocol ritual (886 lines)
│   ├── narrative.tsx                   # Narrative timeline viewer
│   ├── quests.tsx
│   ├── achievements.tsx
│   ├── field-ops.tsx                   # Daily operations
│   ├── titles.tsx
│   ├── status.tsx                      # Player status screen
│   ├── war-room.tsx                    # Boss challenge command
│   └── mind-training.tsx               # Spaced-repetition mind exercises
│
├── src/                                # application source (266 files, ~52k lines)
│   ├── components/                     # UI components (see §10)
│   │   ├── ui/                         # 47 primitives
│   │   ├── 3d/                         # 3 R3F scenes
│   │   └── v2/                         # 94 feature components in 13 subdirs
│   ├── data/                           # Static data (chapters, exercises, rank defs, etc.)
│   ├── db/                             # MMKV data layer
│   │   ├── database.ts
│   │   ├── engine.ts                   # legacy per-engine scoring helpers
│   │   ├── gamification.ts             # getDailyRank and rank helpers
│   │   ├── goals.ts
│   │   ├── habits.ts
│   │   ├── journal.ts
│   │   ├── keys.ts                     # Central MMKV key registry (Phase 2.2D)
│   │   ├── schema.ts                   # TypeScript types for MMKV payloads
│   │   └── storage.ts                  # getJSON / setJSON / remove (Phase 2.2B: logs errors)
│   ├── hooks/                          # Custom hooks
│   │   ├── queries/                    # 5 React Query hook files (§8)
│   │   ├── useAnalyticsData.ts         # Historical sparklines + heatmap (still MMKV)
│   │   ├── useAppResumeSync.ts         # AppState 'active' → invalidate critical queries
│   │   └── useIsOnline.ts              # Thin wrapper around React Query's onlineManager
│   ├── lib/                            # Business logic + helpers (§11)
│   ├── services/                       # Supabase service layer (§8)
│   ├── stores/                         # Zustand stores (§7)
│   ├── theme/                          # Design tokens (§12)
│   ├── types/
│   │   └── supabase.ts                 # Auto-generated from Supabase schema (~1300 lines)
│   └── __tests__/                      # Jest test suites (§18)
│
├── assets/                             # Static assets
│   ├── icon.png                        # Launcher icon (671 KB)
│   ├── splash-icon.png                 # Splash (271 KB)
│   ├── android-icon-foreground.png     # Adaptive icon (88 KB)
│   ├── android-icon-background.png     # (1.7 KB)
│   ├── android-icon-monochrome.png     # (804 B)
│   ├── favicon.png                     # Web favicon (3.3 KB)
│   └── audio/
│       └── protocol/                   # 138 voice-line MP3s
│           ├── archetypes/    (8)
│           ├── bosses/        (18)
│           ├── cinematics/    (39)
│           ├── daily/         (11)
│           ├── failure/       (15)
│           ├── onboarding/    (18)
│           ├── operations/    (9)
│           ├── ranks/         (8)
│           └── surprises/     (12)
│
├── android/                            # Native Android project (tracked)
│   ├── app/
│   │   ├── build.gradle                # versionCode/Name from gradle props (Phase 3.7)
│   │   ├── proguard-rules.pro          # Keep rules for expo-av + expo-modules-core DI
│   │   └── src/main/
│   │       ├── AndroidManifest.xml     # Includes POST_NOTIFICATIONS (Phase 3.7)
│   │       └── java/com/titan/protocol/
│   │           ├── MainActivity.kt
│   │           └── MainApplication.kt
│   ├── build.gradle                    # Root gradle
│   ├── gradle.properties               # Includes TITAN_VERSION_CODE default + R8 enabled
│   ├── settings.gradle
│   ├── gradlew, gradlew.bat
│   └── titan-release.jks               # NOT tracked — signing key, gitignored
│
├── titan-voice-lines/                  # Raw voice MP3s (gitignored) — pre-processing source
├── legacy/                              # Frozen web/Tauri app + FastAPI archive (READ-ONLY)
├── .github/workflows/
│   └── android.yml                     # Android CI (2 jobs: checks → build)
├── babel.config.js                     # babel-preset-expo (Phase 3.7)
├── metro.config.js                     # expo/metro-config default (Phase 3.7)
├── jest.config.js                      # jest-expo preset
├── tsconfig.json                       # Strict mode, paths: @/* → ./src/*
├── app.json                            # Expo config
├── eas.json                            # EAS Build profiles
├── package.json                        # 47 deps, 6 devDeps
├── package-lock.json
├── .env                                # EXPO_PUBLIC_SUPABASE_* (gitignored)
├── .env.example                        # Publishable defaults (committed)
├── CLAUDE.md                           # Claude Code session rules
├── ROADMAP.md                          # Phase tracker + change log
├── ARCHITECTURE.md                     # Older architecture doc
├── TITAN_PROTOCOL.md                   # ← this file
├── LICENSE
└── README.md
```

---

## 5. Data Architecture

Titan Protocol runs a **three-tier data layer**:

```
                       ┌──────────────────────┐
                       │  Supabase Postgres   │  ← source of truth for 5 core domains
                       │  + RLS per table     │     (profile, tasks, completions,
                       └──────────┬───────────┘      habits, habit_logs, protocol
                                  │                   sessions, rank_up_events)
                                  │
                  ┌───────────────▼───────────────┐
                  │  React Query cache            │  ← the React-facing layer
                  │  + persistQueryClient         │     (stale-while-revalidate,
                  │  + MMKV-backed persister      │      optimistic updates,
                  │  + NetInfo → onlineManager    │      offline mutation queue)
                  └───────────────┬───────────────┘
                                  │
                  ┌───────────────▼───────────────┐
                  │  react-native-mmkv            │  ← physical local store
                  │  (synchronous key/value)      │     used by:
                  └───────────────────────────────┘       - React Query persister
                                                          - 28 non-core Zustand stores
                                                            (gym, sleep, money, etc.)
                                                          - misc flags (first_task_voice_played,
                                                            track_active_tab, dev_day_offset)
```

### The two coexisting storage models

1. **Cloud domains (5 total, migrated in Phase 3.3–3.5):**
   - `profile` (XP, level, streak, archetype, mode, onboarding_completed)
   - `tasks` + `completions`
   - `habits` + `habit_logs`
   - `protocol_sessions`
   - `rank_up_events`

   These are written via React Query mutations in `src/hooks/queries/*.ts`, which call `src/services/*.ts`, which hit Supabase. Reads go through `useQuery` from the same hook files. Cache persists to MMKV via the persister so the app opens instantly with last-known state.

2. **Local-only domains (~28 Zustand stores, not yet cloud-backed):**
   - Gym (workouts, exercises, templates), nutrition (meals, macros), sleep logs, weight logs, money (cashflow, budgets, transactions), deep work sessions, journal content, quests, achievements, skill tree progress, narrative entries, story state, field ops, onboarding flow, walkthrough, UI mode, identity votes, progression phase, titles, focus sessions, mind training (SRS), surprise queue, goal tracking
   - These have Supabase table definitions (Phase 3.1) but no service/hook layer yet. They'll migrate in Phase 3.9.

### Offline mutation queue

`src/lib/query-client.ts` configures React Query mutations with `networkMode: "offlineFirst"`:

1. Mutation fires → `onlineManager` checks NetInfo
2. If online → runs normally with optimistic update
3. If offline → mutation **pauses** (not fails). The persister serializes the paused mutation to MMKV
4. On reconnect (NetInfo flips) → `queryClient.resumePausedMutations()` replays them in original order
5. Force-quit during offline mode is safe — the queue is on disk

Conflict resolution is **last-write-wins** via the `updated_at` triggers on every mutable Supabase table.

### Migration mechanism

`src/lib/migrate-to-supabase.ts` is a one-time copy of MMKV → Supabase that runs once per (device, user) the first time the user signs in. Gated by `migration_to_supabase_completed:{userId}` MMKV flag. Migrates 7 domains in dependency order:

1. profile (XP/level/streak)
2. tasks
3. completions (needs task id map)
4. habits
5. habit_logs (needs habit id map)
6. protocol_sessions
7. rank_ups

Per-domain try/catch isolation — if `tasks` fails, `habits` still runs. Errors logged via `src/lib/error-log.ts` ring buffer. Batched upserts (500 rows) with `ignoreDuplicates` so re-runs are safe. Numeric MMKV IDs → UUID Supabase IDs mapped through a `Map<number, string>` preserved across related-table steps.

`src/components/MigrationGate.tsx` wraps the authenticated render path, shows a cinematic "SYSTEM SYNC" progress modal while it runs, and only releases children once complete. Positioned in `app/_layout.tsx` between `SystemNotificationProvider` and `OnboardingGate` so migration runs *before* onboarding-gate reads `profile.onboarding_completed`.

---

## 6. Supabase Schema

**Project:** `Titan Protocol`
**Ref:** `rmvodrpgaffxeultskst`
**Region:** `ap-south-1`
**Applied migrations:** 6 (foundation → core → gamification → content → billing+RLS → hardening)
**Total tables:** 27
**Security advisor lints:** 0

All tables have RLS enabled and a `user_id uuid references auth.users(id)` column, with policies that allow each user to see and mutate only their own rows. Every mutable table has an `updated_at` column maintained by a `set_updated_at()` trigger function (search_path pinned for hardening).

Auto-generated TypeScript types live at `src/types/supabase.ts` (~1300 lines) — regenerate via `mcp__...__generate_typescript_types` when the schema changes.

### Enums (9 total)
- `engine_key` — body | mind | money | charisma
- `task_kind` — main | secondary
- `app_mode` — full_protocol | tracker | focus | zen | titan
- `archetype` — titan | athlete | scholar | hustler | showman | warrior | founder | charmer
- `phase_key` — foundation | building | intensify | sustain
- `quest_kind` — daily | weekly | special
- `achievement_tier` — bronze | silver | gold | legendary
- `subscription_tier` — free | monthly | annual | lifetime
- `subscription_status` — active | expired | cancelled | pending

### Foundation tables
| Table | Purpose |
|---|---|
| `profiles` | Per-user profile. Has auto-create trigger on `auth.users` INSERT. Columns include xp, level, streak_current, streak_best, streak_last_date, archetype, mode, display_name, focus_engines[], first_use_date, onboarding_completed. |

### Core tables (Phase 3.3 migrated)
| Table | Purpose |
|---|---|
| `tasks` | User-defined task templates per engine. Columns: id (uuid), user_id, engine, title, kind, days_per_week, is_active. Soft-delete via `is_active=false`. |
| `completions` | Per-day task toggles. Unique (task_id, date_key). |
| `habits` | Habits with **denormalized** `current_chain`, `best_chain`, `last_broken_date` (no more O(n²) scans). Columns: user_id, title, engine, icon, trigger_text, duration_text, frequency. |
| `habit_logs` | Per-day habit toggles. Unique (habit_id, date_key). |
| `protocol_sessions` | **One row per (user_id, date_key)** — holds both morning and evening data in a single row. Unique constraint on (user_id, date_key). Columns: morning_intention, morning_completed_at, evening_reflection, evening_completed_at, titan_score, identity_at_completion, habit_checks. Atomic upsert fixes the Phase 2.2A multi-key-write race. |
| `progression` | Current phase (foundation/building/intensify/sustain), day_number, last_phase_transition. |

### Gamification tables
| Table | Purpose |
|---|---|
| `quests` | Daily/weekly/special quests. Generated by `src/lib/quest-generator.ts`, claimed on completion. |
| `boss_challenges` | Multi-day challenges with progress + xp_reward. |
| `achievements_unlocked` | Per-user record of which achievements have been earned. |
| `skill_tree_progress` | Per-(user, engine, node) progress rows. |
| `rank_up_events` | Level-up event queue (replaces Phase 2.1E MMKV queue). Has partial index on `WHERE dismissed_at IS NULL` for the pending-queue read. |

### Content tables
| Table | Purpose |
|---|---|
| `journal_entries` | Per-day journal content. |
| `gym_exercises` | Exercise catalog. |
| `gym_templates` | Workout templates. |
| `gym_template_exercises` | Join table. |
| `gym_sessions` | Completed workout sessions. |
| `gym_session_sets` | Per-set log rows. |
| `sleep_logs` | Nightly sleep duration + quality. |
| `weight_logs` | Weight measurements. |
| `nutrition_profile` | Daily macro targets. |
| `meal_logs` | Meal entries with macros. |
| `money_transactions` | Cashflow entries. |
| `budgets` | Monthly budget limits. |
| `deep_work_sessions` | Deep-work timer logs with associated earnings. |
| `narrative_entries` | Story/cinematic timeline entries. |

### Billing
| Table | Purpose |
|---|---|
| `subscriptions` | RevenueCat-written, client read-only. Columns: tier, status, period_start, period_end, product_id. Written by the Phase 4.1 webhook. |

---

## 7. Zustand Store Inventory

**Total: 33 stores** in `src/stores/` (plus `mmkv-storage.ts` helper). Grouped by current cloud-backing status:

### Cloud-backed (5) — read from React Query, Zustand is legacy
These still exist but the cloud hook is the new source of truth. The Zustand store is kept around for screens that haven't migrated yet and for flags that don't live in Supabase.

- `useAuthStore.ts` — Supabase session hydration. Subscribes to `onAuthStateChange`. Exposes `user`, `session`, `isLoading`, `initialize()`, `signOut()`. **Keep** — wraps Supabase auth, not MMKV.
- `useProfileStore.ts` — Legacy. Still used for `XP_REWARDS` constant + legacy MMKV reads on non-migrated screens. **Will be deleted** once all consumers move to `useProfile()`.
- `useEngineStore.ts` — Legacy. Still reads tasks/completions from MMKV for non-migrated screens (engines tab, hub/analytics, MorningMissionPreviewPhase subcomponent). **Will be deleted** after Phase 3.9.
- `useProtocolStore.ts` — Legacy. Still reads sessions from MMKV for a few read-only display paths. **Will be deleted** after Phase 3.9.
- `useHabitStore.ts` — Legacy. Dashboard habit summary still reads from this. **Will be deleted** after Phase 3.9.

### UI state (stays local)
These hold ephemeral UI state that doesn't belong in the cloud:

- `useWalkthroughStore.ts` — onboarding walkthrough steps (completed flags, pinned tools)
- `useOnboardingStore.ts` — onboarding flow progress (identity, mode, completed)
- `useSurpriseStore.ts` — surprise queue + last-shown timestamps
- `useStoryStore.ts` — story state (user name, current act)
- `useNarrativeStore.ts` — narrative entries cache
- `useModeStore.ts` — app mode selection + identity (full_protocol | tracker | focus | zen | titan)
- `useIdentityStore.ts` — archetype + weights + votes (archetype ALSO lives on profiles.archetype; votes are local)
- `useTitleStore.ts` — unlocked titles + equipped title
- `useTitanModeStore.ts` — titan-mode unlock state
- `useFocusStore.ts` — pomodoro timer state
- `useMindTrainingStore.ts` — SRS state for mind exercises
- `useGoalStore.ts` — goals (numeric IDs — pre-Supabase schema)
- `useAchievementStore.ts` — achievement state + `pendingCelebration` queue (reference implementation for the rank-up queue pattern)
- `useQuestStore.ts` — quest state + boss challenges
- `useSkillTreeStore.ts` — per-engine skill tree progress
- `useProgressionStore.ts` — current phase (foundation/building/intensify/sustain)
- `useFieldOpStore.ts` — daily field operations
- `useRankStore.ts` — rank state (may be dead; superseded by `profiles.level`)
- `useStatStore.ts` — per-engine stat counters
- `useDeepWorkStore.ts` — deep work session log

### Non-core domains (have Supabase tables, no cloud service layer yet)
These are the Phase 3.9 targets:

- `useGymStore.ts` — exercises, templates, sessions, sets
- `useNutritionStore.ts` — meals, macros, daily targets
- `useSleepStore.ts` — sleep logs
- `useWeightStore.ts` — weight log
- `useMoneyStore.ts` — transactions (cashflow)
- `useBudgetStore.ts` — monthly budgets
- `useJournalStore.ts` — journal entries (content now, writing still MMKV)

### Helper
- `mmkv-storage.ts` — shared MMKV instance + Zustand persistence adapter

---

## 8. Cloud Service + React Query Layer

All cloud data mutations go through this layer. Services are thin, typed wrappers around `supabase-js`; hooks compose them with React Query caching.

### Services (`src/services/`)
| File | Exports | Purpose |
|---|---|---|
| `profile.ts` | `getProfile`, `updateProfile`, `upsertProfile`, `awardXP`, `updateStreak`, `completeOnboarding` + types `Profile`, `ProfileUpdate`, `AwardXPResult` | Profile CRUD. `awardXP` returns `{ profile, leveledUp, fromLevel, toLevel }` so callers can enqueue rank-ups. Level formula: `floor(xp / 500) + 1`. |
| `tasks.ts` | `listTasks`, `listAllTasks`, `listCompletions`, `listAllCompletionsForDate`, `createTask`, `deleteTask` (soft), `toggleCompletion`, `computeEngineScore`, `ENGINES` + types `Task`, `Completion`, `EngineKey`, `TaskKind` | Tasks + completions. `computeEngineScore(tasks, completedIds)` is the canonical scoring helper (main=2pt, secondary=1pt). |
| `habits.ts` | `listHabits`, `listHabitLogsForDate`, `listHabitLogsForRange`, `createHabit`, `deleteHabit`, `toggleHabit` + types `Habit`, `HabitLog`, `ToggleHabitResult`, `CreateHabitInput` | Habits + logs. `toggleHabit` recomputes `current_chain` and `best_chain` on the server round-trip. |
| `protocol.ts` | `getProtocolSession`, `listRecentProtocolSessions`, `saveMorningSession`, `saveEveningSession`, `isMorningDone`, `isEveningDone`, `isDayComplete` + types `ProtocolSession`, `Archetype` | Single-row-per-day upserts. No more dual-write race. |
| `rank-ups.ts` | `listPendingRankUps`, `enqueueRankUp`, `dismissRankUp` + types `RankUpEvent`, `EnqueueRankUpInput` | Rank-up event queue. Dismiss is a soft-delete so Phase 4.4 PostHog can analyze dismissal rates. |

### Query hooks (`src/hooks/queries/`)
| File | Exports |
|---|---|
| `useProfile.ts` | `useProfile`, `useUpdateProfile`, `useAwardXP`, `useUpdateStreak`, `useCompleteOnboarding`, `profileQueryKey` |
| `useTasks.ts` | `useEngineTasks`, `useAllTasks`, `useEngineCompletions`, `useAllCompletionsForDate`, `useCreateTask`, `useDeleteTask`, `useToggleCompletion`, `tasksKeys` |
| `useHabits.ts` | `useHabits`, `useHabitLogsForDate`, `useHabitLogsForRange`, `useCreateHabit`, `useDeleteHabit`, `useToggleHabit`, `habitsKeys` |
| `useProtocol.ts` | `useProtocolSession`, `useRecentProtocolSessions`, `useSaveMorningSession`, `useSaveEveningSession`, `protocolKeys` |
| `useRankUps.ts` | `usePendingRankUps`, `useEnqueueRankUp`, `useDismissRankUp`, `rankUpsKeys` |

### Key conventions
- **Query keys** are namespaced by table name so `invalidateQueries({ queryKey: ['tasks'] })` can scope an invalidation
- **Optimistic updates** on `useToggleCompletion` and `useToggleHabit` — cache flips instantly, rolls back on server error
- **Enabled gating** — every query has `enabled: Boolean(userId)` so nothing fires before auth hydrates
- **Cache persistence** — `persistQueryClient` serializes everything to MMKV on a 1s throttle. Cache buster `v1-phase3.4` lets us invalidate the persisted cache on breaking schema changes
- **`staleTime: 5min`** default, `gcTime: 24h`. `refetchOnReconnect: true`, `refetchOnWindowFocus: false` (RN has no window focus; `AppResumeSyncMount` covers it via AppState)

### Query client setup (`src/lib/query-client.ts`)
- MMKV-backed AsyncStorage adapter → persister → `persistQueryClient`
- NetInfo listener → `onlineManager.setEventListener` → on-reconnect calls `resumePausedMutations()`
- Buster: `v1-phase3.4`
- Max persist age: 7 days

---

## 9. Routes & Screens

### Route groups
- **`(auth)`** — unauthenticated stack, bypasses story/cinematic/integrity overlays
- **`(tabs)`** — authenticated bottom-tab nav (HQ / Engines / Track / Hub / Profile)
- **`(modals)`** — presented as modals on top of tabs

### Tab routes
| Route | File | LOC | Purpose |
|---|---|---|---|
| `/` (HQ) | `app/(tabs)/index.tsx` | ~1000 | Character HUD, combat power, operation banner, engine radar + stat bars, daily quest, today's missions, habits+skill trees side-by-side, field ops bar. **Cloud-migrated in Phase 3.5.** |
| `/engines` | `app/(tabs)/engines.tsx` | 178 | All-engines overview. Read-only. **Still on legacy store** (Phase 3.9 target). |
| `/track` | `app/(tabs)/track.tsx` | ~1050 | Habits / Journal / Goals sub-tabs. Persists active tab to MMKV. **HabitsTab + Journal XP cloud-migrated.** |
| `/hub` | `app/(tabs)/hub.tsx` | — | Tools grid menu |
| `/profile` | `app/(tabs)/profile.tsx` | 306 | XP, level, streak, achievement wall, equipped title. **Cloud-migrated.** |

### Auth routes
| Route | Purpose |
|---|---|
| `/(auth)/login` | 3-button login (Google [deferred], email, signup) |
| `/(auth)/email-login` | Email + password, with magic-link toggle |
| `/(auth)/signup` | Email + password + confirm (8-char min) |
| `/(auth)/verify` | Magic-link deep-link handler: tries PKCE → implicit → getSession fallback |

### Single-screen routes
| Route | File | Purpose |
|---|---|---|
| `/protocol` | `app/protocol.tsx` (886 lines) | Morning Protocol: intention → mission preview → motivational. Evening Protocol: score reveal → reflection → identity vote → narrative. **Cloud-migrated in Phase 3.5.** |
| `/engine/[id]` | `app/engine/[id].tsx` | Per-engine task list with add/edit/delete + suggestions. **First screen migrated to cloud in Phase 3.5c.** |
| `/skill-tree` + `/skill-tree/[engine]` | | Skill tree viewer per engine |
| `/achievements` | `app/achievements.tsx` | Achievement wall |
| `/quests` | `app/quests.tsx` | Quest list + boss challenges |
| `/field-ops` | `app/field-ops.tsx` | Daily field operation detail |
| `/war-room` | `app/war-room.tsx` | Boss challenge HQ |
| `/narrative` | `app/narrative.tsx` | Narrative timeline |
| `/mind-training` | `app/mind-training.tsx` | SRS mind exercises (BiasCheck, DecisionDrill, KnowledgeDrop) |
| `/onboarding` | `app/onboarding.tsx` | Onboarding shell (identity selection, tour, identity reveal) |
| `/walkthrough` | `app/walkthrough.tsx` | Guided walkthrough after onboarding |
| `/tutorial` | `app/tutorial.tsx` | In-app tutorial overlay |
| `/titles` | `app/titles.tsx` | Title wall (earn + equip) |
| `/status` | `app/status.tsx` | Player status screen |
| `/+not-found` | `app/+not-found.tsx` | Route-not-found fallback |

### Hub sub-routes
All live under `/hub/*`:
| Route | Purpose |
|---|---|
| `/hub/analytics` | Charts: sparklines, 84-day heatmap, weekly summary. **Still MMKV** (Phase 3.9). |
| `/hub/command` | Cross-engine task view. **Cloud-migrated.** |
| `/hub/focus` | Pomodoro timer with XP on completion. **Cloud XP path migrated.** |
| `/hub/workouts` | Gym exercise + template tracking. **Cloud XP path migrated.** |
| `/hub/sleep` | Sleep logging (hours, quality). MMKV. |
| `/hub/weight` | Weight log. MMKV. |
| `/hub/nutrition` | Macro tracking, meal log. MMKV. |
| `/hub/cashflow` | Income/expense log. MMKV. |
| `/hub/budgets` | Monthly budget caps. MMKV. |
| `/hub/deep-work` | Deep work timer + earnings. MMKV. |
| `/hub/settings` | Profile display, backup/restore, app mode. **Profile reads cloud-migrated.** |

### Modal routes
| Route | Purpose |
|---|---|
| `/(modals)/add-task` | Add a new task. **Cloud-migrated** (`useCreateTask`). |
| `/(modals)/achievement-popup` | Achievement unlock celebration with XP reward. **Cloud XP migrated.** |
| `/(modals)/boss-challenge` | Boss challenge intro |
| `/(modals)/perfect-day` | Perfect day celebration (all tasks complete) |
| `/(modals)/phase-transition` | Chapter phase transition (Foundation → Building, etc.) |
| `/(modals)/titan-unlock` | Titan Mode unlock celebration. **Cloud XP read migrated.** |

### Root layout (`app/_layout.tsx`, 593 lines)
The orchestration spine. Manages:

**Provider chain (authenticated path):**
```
QueryClientProvider
  └ GestureHandlerRootView
    └ RootErrorBoundary
      └ SystemWindowProvider
        └ SystemNotificationProvider
          └ MigrationGate
            └ OnboardingGate
              └ AppResumeSyncMount
              └ RankUpOverlayMount
              └ Stack (tabs/auth/modals)
              └ [15+ overlay components]
```

**Overlay render order** (highest priority first — the first one that has `active=true` renders):
1. `IntegrityWarningOverlay` (amber, 1-day miss)
2. `StreakBreakCinematic` (red, multi-day miss)
3. `ComebackCinematic`
4. `CinematicOnboarding`
5. `FirstLaunchCinematic`
6. Day-N cinematic (Day2-Day365)
7. `DailyBriefing`
8. `BossDefeatCinematic` / `BossFailCinematic`
9. `BossUnlockCinematic`
10. `RankPromotionCinematic`
11. `SurpriseOverlay`
12. `RankUpOverlayMount` (pulls from cloud queue)
13. `MotivationalSplash`
14. `AchievementToast` (non-blocking, z=8000)
15. `OfflineBanner` (non-blocking, z=9999, `pointerEvents=none`)

**Boot logic:**
1. `useFonts` loads JetBrains Mono — render null until ready
2. `useAuthStore.initialize()` — hydrate Supabase session from AsyncStorage
3. If `authLoading` → render null (splash shown via app.json)
4. Redirect signed-out users to `/(auth)/login` via `<Redirect>`
5. Redirect signed-in users in the auth group to `/(tabs)`
6. `MigrationGate` runs once per user-device → shows progress modal
7. `OnboardingGate` reads `profile.onboarding_completed` → redirects to `/onboarding` if false
8. Integrity check useEffect runs (detects missed days, triggers streak-break/comeback cinematics)
9. Day-N cinematic decision (read `first_active_date` from MMKV → compute day → load story)
10. Daily briefing gate (`briefing_seen_${todayKey}`)

---

## 10. Component Inventory

### `src/components/ui/` — 47 primitives
Design-system primitives used throughout. All styled with `StyleSheet.create()` + theme tokens.

| Component | Purpose |
|---|---|
| `AchievementToast.tsx` | Slide-in achievement toast (z=8000) |
| `AnimatedBackground.tsx` | `HUDBackground` wrapper + `AmbientGlow` helper — scrolling particle/grid field |
| `AnimatedCounter.tsx` | Animated number tween (XP counters) |
| `Card.tsx` | Base card chrome |
| `DateNavigator.tsx` | Left/right date pager |
| `EngineCard.tsx` | Per-engine summary card |
| `FAB.tsx`, `FloatingActionButton.tsx` | FABs (two variants) |
| `HabitGrid.tsx` | 12-week habit completion grid |
| `HeatmapGrid.tsx` | 84-day heatmap |
| `LevelUpOverlay.tsx` | Rank-up overlay shown by `RankUpOverlayMount` |
| `MetricValue.tsx` | Large numeric display with label |
| `MissionBoard.tsx` | Task list container |
| `MissionRow.tsx` | Individual task row. Takes `taskId: string` (Phase 3.5c). Memoized, stable callbacks, animation cleanup on unmount. |
| `MotivationalSplash.tsx` | App-open motivational quote overlay |
| `OfflineBanner.tsx` | Thin top-of-screen status bar when offline |
| `OpsBanner.tsx`, `OpsCard.tsx` | Operation-themed banners |
| `PageHeader.tsx`, `SectionHeader.tsx` | Screen titles |
| `PageTransition.tsx` | Between-screen transition wrapper |
| `Panel.tsx` | **The main card primitive.** Has `GlowLine` drifting shimmer. Phase 2.1A added `cancelAnimation` cleanup. |
| `PowerRing.tsx`, `ProgressRing.tsx` | Circular progress |
| `PulsingGlow.tsx` | Reusable pulsing glow wrapper |
| `QuestCard.tsx` | Daily quest card with claim button |
| `RadarChart.tsx` | 4-axis engine radar |
| `RadialMenu.tsx` | Radial action menu |
| `RankBadge.tsx`, `StreakBadge.tsx`, `XPBar.tsx` | HUD stat displays |
| `RankCeremony.tsx` | Rank promotion ceremony overlay (uses R3F scene) |
| `RootErrorBoundary.tsx` | Top-level error boundary with reset CTA. TODO: forward to Sentry in Phase 4.4. |
| `ScoreGauge.tsx` | Circular score gauge |
| `Skeleton.tsx` + `SkeletonGroup`, `SkeletonCard` | Loading skeleton primitives (Phase 2.4B) |
| `SkillTreeNode.tsx` | Individual skill tree node |
| `SparklineChart.tsx` | 7-day trend line |
| `StatBar.tsx`, `StatScreen.tsx` | Stat visualization |
| `StatusWindow.tsx`, `SystemWindow.tsx`, `SystemWindowProvider.tsx` | Modal window chrome |
| `SystemNotification.tsx` | Toast notification context + hook |
| `SystemVoice.tsx` | Voice-line player indicator |
| `TitanProgress.tsx` | Horizontal shimmer progress bar |
| `TitleWall.tsx` | Title unlocks grid |
| `WeekComparison.tsx`, `WeeklySummary.tsx` | Week-over-week analytics |

### `src/components/3d/` — 3 R3F scenes
| Component | Purpose |
|---|---|
| `RankUpScene.tsx` | 3D rank-up celebration (used by `RankCeremony`). Has its own `SceneErrorBoundary`. |
| `ChapterTransition.tsx` | 3D chapter transition scene |
| `ParticleField.tsx` | Reusable particle field mesh |

### `src/components/v2/` — 94 feature components
| Folder | Files | What's inside |
|---|---|---|
| `onboarding/` | 26 | 8 Beat* components (ColdOpen, WhatIsThis, FourEngines, Briefing, Ladder, Reveal, Setup) + Step* components (Welcome, Complete) + `CinematicOnboarding`, `OnboardingShell`, `Tutorial`, identity selection screens |
| `story/` | 34 | `FirstLaunchCinematic` + 14 `DayNCinematic` files (Day2 through Day365) + `DailyBriefing`, `BossDefeatCinematic`, `BossFailCinematic`, `BossUnlockCinematic`, `RankPromotionCinematic`, `ComebackCinematic`, `StreakBreakCinematic`, `IntegrityWarningOverlay`, `SurpriseOverlay`, `WarRoom`, `ProtocolTerminal`, `ShareButton` |
| `walkthrough/` | 12 | `WalkthroughShell` + step components (engines intro, task creation, habit tour, goal setup, pinned tools, `WalkthroughSummary`) |
| `celebrations/` | 5 | `TitanUnlockCelebration`, level-up celebrations, boss defeat celebration |
| `achievements/` | 1 | Achievement card component |
| `quests/` | 2 | `QuestCard`, `BossChallengeCard` |
| `habits/` | 1 | `HabitChain` — 14-day chain visualization |
| `identity/` | 2 | Identity selection cards |
| `mind-training/` | 4 | `BiasCheck`, `DecisionDrill`, `KnowledgeDrop`, + exercise shell |
| `narrative/` | 2 | `NarrativeTimeline`, narrative entry card |
| `skill-tree/` | 3 | Skill tree node card, branch display |
| `progression/` | 2 | Phase transition ceremony, progression indicator |
| `modes/` | 0 | Empty (app mode selection moved elsewhere) |

### Mount components (zero-render glue)
- `src/components/AppResumeSyncMount.tsx` — mounts `useAppResumeSync` inside the QueryClientProvider
- `src/components/RankUpOverlayMount.tsx` — cloud-backed replacement for the old `LevelUpOverlay` mount
- `src/components/MigrationGate.tsx` — runs `maybeRunMigration()` and shows progress modal
- `src/components/OnboardingGate.tsx` — reads profile, redirects to `/onboarding` if incomplete

---

## 11. Library Helpers (`src/lib/`)

Business logic and pure helpers. ~40 files. All pure-function where possible (Jest tests cover the safety-critical ones).

| File | Purpose |
|---|---|
| `scoring-v2.ts` | Canonical scoring: weighted Titan score, per-engine score, rank grade (D/C/B/A/S/SS). **27 Jest tests pin this.** |
| `date.ts` | DST-safe date arithmetic: `getTodayKey`, `addDays`, `toLocalDateKey`, `formatDateShort`, `getDayOfWeek`. **16 Jest tests.** |
| `schemas.ts` | Zod schemas at storage boundaries + `parseOrFallback`. **24 Jest tests.** |
| `error-log.ts` | In-memory ring buffer (last 50 errors), subscribable. Will forward to Sentry in Phase 4.4. |
| `haptics.ts` | Haptic helpers — always use these, not `expo-haptics` directly (CLAUDE.md rule) |
| `migrate-to-supabase.ts` | One-time MMKV → Supabase migration (see §5) |
| `migration.ts` | Legacy MMKV schema migrations (archetype renames: builder→hustler, creator→showman, etc.) |
| `supabase.ts` | Supabase client + `requireUserId()` helper |
| `query-client.ts` | React Query client config + MMKV persister + NetInfo bridge |
| `narrative-engine.ts` | Story/cinematic gating by day number + archetype |
| `narrative-writer.ts` | Narrative entry creation |
| `operation-engine.ts` | Daily operation generator (codename banner on dashboard) |
| `quest-generator.ts` | Daily/weekly quest generation |
| `protocol-integrity.ts` | Streak break detection + integrity level (0-3) |
| `protocol-audio.ts` | Voice line player: `playVoiceLineAsync`, `stopCurrentAudio`, `playSequence`, `getDailyGreetingId`, `getArchetypeVoiceId`, `getRankPromotionVoiceId`, etc. |
| `ranks-v2.ts` | `RANK_ORDER`, `RANK_NAMES`, `RANK_COLORS`, `RANK_REQUIREMENTS`, `RANK_ABBREVIATIONS` |
| `titles.ts` | Title catalog + rarity colors |
| `achievement-checker.ts` | Achievement unlock detection |
| `skill-tree-evaluator.ts` | Skill tree unlock evaluation. **Phase 3.5f cutover**: reads `profiles.streak_current` via `queryClient` singleton instead of stale `useProtocolStore`. |
| `progression-engine.ts` | Phase transitions (foundation → building → intensify → sustain) |
| `mission-suggester.ts` | Suggested habits + tasks by archetype |
| `momentum.ts` | Streak-based momentum multiplier + tier colors |
| `variable-rewards.ts` | Random XP bonuses (stubs pending) |
| `surprise-engine.ts` | Surprise event trigger + double-XP window detection |
| `transmissions.ts` | Protocol transmission messages |
| `field-ops.ts` | Field operation definitions |
| `srs.ts` | Spaced-repetition scheduling (mind training) |
| `quiz-scoring.ts` | Mind training quiz scoring |
| `notifications.ts` | expo-notifications scheduling |
| `stats.ts` | Statistics helpers |
| `safety.ts` | Corruption recovery for MMKV reads |
| `safeNum.ts` | Safe number parsing |
| `format.ts` | Number formatting (1.2K, $1,234) |
| `animations.ts` | Reanimated helper presets |
| `voice.ts` | Legacy voice interface (may be dead) |
| `sound.ts` | Sound effect player |
| `share.ts` | Share sheet helpers |
| `quotes.ts` | Motivational quote catalog |

---

## 12. Theme System

All visual tokens live in `src/theme/` and are the ONLY allowed source of style values.

### `colors.ts` (partial — full palette is ~90 values)
```typescript
// Backgrounds
bg: "#000000",
surface: "rgba(0, 0, 0, 0.97)",
surfaceBorder: "rgba(255, 255, 255, 0.12)",

// Primary accent — HUD white (NOT cyan)
primary: "rgba(247, 250, 255, 0.96)",

// Text
text: "rgba(245, 248, 255, 0.92)",
textSecondary: "rgba(210, 216, 230, 0.62)",
textMuted: "rgba(210, 220, 242, 0.52)",

// Status
success: "#34d399",
warning: "#FBBF24",
danger: "#f87171",

// Engine colors
body:     "#00FF88",
mind:     "#A78BFA",
money:    "#FBBF24",
charisma: "#60A5FA",

// Rank colors
rankD: "#6B7280",    // gray
rankC: "#A78BFA",    // violet
rankB: "#60A5FA",    // blue
rankA: "#34D399",    // green
rankS: "#FBBF24",    // gold
rankSS: "#F97316",   // orange

// Panel chrome
panelBorder: "rgba(255, 255, 255, 0.12)",
glowLine: "rgba(242, 247, 255, 0.5)",
```

Plus `titanColors` (gold accents for Titan Mode).

### `typography.ts`
Primary font: **JetBrains Mono** (loaded via `@expo-google-fonts/jetbrains-mono`, falls back to Menlo on iOS, monospace on Android during load).

Variants: `hero`, `title`, `kicker`, `body`, `caption`, `small`, `mono`.

### `spacing.ts`
`xs: 4, sm: 8, md: 12, lg: 16, xl: 24, 2xl: 32, 3xl: 48`

### `radius.ts`
`sm: 4, md: 8, lg: 12, xl: 16, full: 999`

### `shadows.ts`
Platform-gated via `Platform.select`. Android caps at `elevation: 2` to prevent the render-node layer bomb (Phase 2.1D fix).

### Touch target
`TOUCH_MIN = 44` — minimum interactive element size (iOS HIG + Android Material guideline).

### Theme index (`src/theme/index.ts`)
Re-exports `colors`, `spacing`, `fonts`, `radius`, `shadows`, `TOUCH_MIN` for single-import convenience:
```typescript
import { colors, spacing, fonts, radius } from "@/theme";
```

---

## 13. Auth Flow

Powered by Supabase Auth with AsyncStorage session persistence.

### Routes
- `/(auth)/login` — 3-button chooser:
  - Google Sign-In (button shows "coming soon" alert until `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` is set)
  - Sign in with email → `/(auth)/email-login`
  - Create account → `/(auth)/signup`
- `/(auth)/email-login` — Email + password OR magic-link toggle
- `/(auth)/signup` — Email + password + confirm (8-char minimum)
- `/(auth)/verify` — Magic-link deep-link handler (scheme `titan-protocol://`)

### Verify flow
Handles three cases in order:
1. **PKCE flow** — `token_hash` + `type` params → `supabase.auth.verifyOtp`
2. **Implicit flow** — `access_token` + `refresh_token` params → `supabase.auth.setSession`
3. **Session check fallback** — `supabase.auth.getSession()` in case the session already hydrated
4. On failure → error message with "Request a new one" hint

### Deep link registration
- `app.json` scheme: `"titan-protocol"`
- `android/app/src/main/AndroidManifest.xml:25-30` has the intent filter
- Launch mode: `singleTask` (so the verify activity brings the existing app to front)

### Store (`src/stores/useAuthStore.ts`)
Minimal Zustand store. State: `{ user, session, isLoading, initialize, signOut }`. Subscribes to `onAuthStateChange` exactly once via a module-level `initialized` flag. `__resetAuthStoreForTests()` export for test cleanup.

### Route guarding (`app/_layout.tsx`)
Uses `useSegments()` + `<Redirect>` with two rules:
- If `!user && !inAuthGroup` → redirect to `/(auth)/login`
- If `user && inAuthGroup` → redirect to `/(tabs)`

### Profile creation
Supabase has a trigger on `auth.users INSERT` that auto-creates a `profiles` row. There's a tiny race window (~50ms) where the trigger hasn't fired yet — `OnboardingGate` handles this by returning children (not redirecting) while `profile === null`.

### Known deferrals
- Google OAuth flow — needs SHA-1 from keystore registered in Google Cloud Console
- Apple Sign-In — deferred until iOS launch

---

## 14. Boot Sequence

```
App launch
    │
    ▼
Expo splash (from app.json)
    │
    ▼
app/_layout.tsx loads
    │
    ├─── useFonts(JetBrainsMono_*) → render null until ready
    │
    ├─── useAuthStore.initialize()
    │         │
    │         ├─── supabase.auth.getSession() (from AsyncStorage)
    │         ├─── set { session, user, isLoading: false }
    │         └─── subscribe to onAuthStateChange
    │
    ▼
if (authLoading) → render null (splash stays)
    │
    ▼
if (!user && !inAuthGroup) → <Redirect href="/(auth)/login" />
if (user && inAuthGroup) → <Redirect href="/(tabs)" />
    │
    ├─── Unauthenticated path ─────► auth stack renders
    │                                 (no overlays, no Migration/Onboarding gates)
    │
    └─── Authenticated path
            │
            ▼
          QueryClientProvider
            │
            ▼
          GestureHandlerRootView + RootErrorBoundary
            │
            ▼
          SystemWindowProvider + SystemNotificationProvider
            │
            ▼
          MigrationGate
            │
            ├─── useEffect on userId change
            ├─── if (migration_to_supabase_completed:{userId}) → state='done'
            ├─── else → state='running' + show progress modal
            │     │
            │     ├─── maybeRunMigration() copies 7 domains MMKV → Supabase
            │     ├─── queryClient.invalidateQueries({ queryKey: profileQueryKey })
            │     └─── queryClient.invalidateQueries() (nuke all)
            │
            ▼
          OnboardingGate
            │
            ├─── useProfile() hook fires (enabled: Boolean(userId))
            ├─── if (profile === null) → return children (let app render)
            ├─── if (!profile.onboarding_completed && !inOnboardingFlow) → <Redirect href="/onboarding" />
            └─── else → return children
            │
            ▼
          AppResumeSyncMount + Stack + overlay layer
            │
            ▼
          Integrity check useEffect runs
            │
            ├─── loadIntegrity() → check for missed days
            ├─── if (severe) → trigger StreakBreakCinematic
            ├─── else if (comeback) → trigger ComebackCinematic
            └─── else if (warning) → trigger IntegrityWarningOverlay
            │
            ▼
          Day-N cinematic decision
            │
            ├─── first_active_date from MMKV → dayNumber
            ├─── if (day in DAY_CINEMATICS && !seen) → render Day{N}Cinematic
            └─── if (first launch && !firstLaunchSeen) → render FirstLaunchCinematic
            │
            ▼
          Daily briefing gate
            │
            └─── if (!briefing_seen_${todayKey}) → render DailyBriefing
            │
            ▼
          User-facing screen renders (whichever tab/route)
```

### Race conditions (verified safe)
- **MigrationGate vs auth** — root layout early-returns on `authLoading`, so migration never mounts until session is hydrated
- **OnboardingGate vs migration** — nested tree ensures sequential execution; invalidation fires before children render
- **Profile null after signup** — OnboardingGate returns children (lets legacy Zustand onboarding handle it) rather than redirecting to a broken state

### Known latent issues (from audit, not critical)
- Profile RLS 403 on first read → OnboardingGate silently returns children, user enters with `profile === undefined`. Low likelihood but worth a retry loop later.
- AsyncStorage (Supabase) vs MMKV (Zustand) hydration aren't synchronized on sign-out. Old user's MMKV state persists on account switch. Fix in Phase 3.9 — clear MMKV on sign-out.

---

## 15. Native Build Configuration

### `app.json` (Expo config)
```json
{
  "expo": {
    "name": "Titan Protocol",
    "slug": "titan-protocol",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "dark",
    "backgroundColor": "#000000",
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#000000"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.titan.protocol"
    },
    "android": {
      "package": "com.titan.protocol",
      "adaptiveIcon": {
        "backgroundColor": "#000000",
        "foregroundImage": "./assets/android-icon-foreground.png",
        "backgroundImage": "./assets/android-icon-background.png",
        "monochromeImage": "./assets/android-icon-monochrome.png"
      },
      "predictiveBackGestureEnabled": true
    },
    "scheme": "titan-protocol",
    "plugins": ["expo-router", "expo-font", "expo-sharing"]
  }
}
```

> **Note:** `android/` is tracked in git, so `expo prebuild` is never run in CI. The `app.json` `android` block is effectively dead config except as a backup — EAS Build ignores it when the native folder exists. Manual changes must go into `AndroidManifest.xml` / `build.gradle` directly.

### `babel.config.js` (Phase 3.7)
```javascript
module.exports = function (api) {
  api.cache(true);
  return { presets: ["babel-preset-expo"] };
};
```
`babel-preset-expo` auto-detects `react-native-worklets` and injects the worklets plugin.

### `metro.config.js` (Phase 3.7)
```javascript
const { getDefaultConfig } = require("expo/metro-config");
module.exports = getDefaultConfig(__dirname);
```

### `tsconfig.json`
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules", "babel.config.js", "metro.config.js", "titan-voice-lines", "legacy", "android"]
}
```

### `eas.json`
```json
{
  "cli": { "version": ">= 15.0.0", "appVersionSource": "remote" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview": { "distribution": "internal", "android": { "buildType": "apk" } },
    "production": {
      "android": { "buildType": "app-bundle" },
      "ios": { "autoIncrement": true }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

### Android native
- **Package:** `com.titan.protocol`
- **namespace:** `com.titan.protocol`
- **versionName:** `1.0.0` (from `TITAN_VERSION_NAME` gradle property, default in `gradle.properties`)
- **versionCode:** Read from `TITAN_VERSION_CODE` gradle property. Default `1`. CI injects `github.run_number` via `-PTITAN_VERSION_CODE=N`.
- **minSdkVersion:** `rootProject.ext.minSdkVersion` (Expo default)
- **compileSdk / targetSdk:** 36 (Expo default for SDK 55)
- **NDK:** 27.1.12297006
- **Kotlin:** 2.1.20
- **New Architecture:** `newArchEnabled=true`
- **Hermes:** `hermesEnabled=true`
- **R8 minify:** `android.enableMinifyInReleaseBuilds=true` (Phase 3.8)
- **Resource shrinking:** `android.enableShrinkResourcesInReleaseBuilds=true` (Phase 3.8)
- **Edge-to-edge:** `edgeToEdgeEnabled=true`
- **Image formats:** GIF + WebP enabled; animated WebP off (iOS compat)
- **Architectures built:** `armeabi-v7a,arm64-v8a,x86,x86_64`

### AndroidManifest.xml permissions
- `INTERNET`
- `MODIFY_AUDIO_SETTINGS` (voice playback)
- `POST_NOTIFICATIONS` (Android 13+, added Phase 3.7)
- `READ_EXTERNAL_STORAGE` (API ≤32)
- `RECORD_AUDIO`
- `SYSTEM_ALERT_WINDOW`
- `VIBRATE` (haptics)
- `WRITE_EXTERNAL_STORAGE` (API ≤32)

### Deep-link intent filter
```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW"/>
  <category android:name="android.intent.category.DEFAULT"/>
  <category android:name="android.intent.category.BROWSABLE"/>
  <data android:scheme="titan-protocol"/>
</intent-filter>
```

### ProGuard keep rules (`proguard-rules.pro`)
Added in commit `b7da4b54`:
```
# expo-modules-core DI — reflectively referenced
-keep class expo.modules.core.interfaces.services.** { *; }
-keep class expo.modules.core.interfaces.** { *; }

# expo-av — uses reflection for Fullscreen player
-keep class expo.modules.av.** { *; }
```

### MainActivity.kt / MainApplication.kt
Stock Expo SDK 55 templates with `ReactActivityDelegateWrapper`, `ExpoReactHostFactory.getDefaultReactHost()`, `DefaultNewArchitectureEntryPoint`, and `BuildConfig.IS_NEW_ARCHITECTURE_ENABLED`.

### Signing
Release keystore: `titan-release.jks` (gitignored, lives at repo root locally). CI:
- If `ANDROID_KEYSTORE_BASE64` secret is set → decodes to `android/app/release.keystore`, uses real production signing
- If not → generates a dev keystore at CI runtime (APK installable but not Play Store uploadable)

Signing config is injected into `android/app/build.gradle` via `sed` at CI runtime, guarded by `grep -q "TITAN_STORE_FILE"` so reruns don't double-inject.

---

## 16. Environment Variables

All env vars are `EXPO_PUBLIC_*` prefixed (Expo SDK 49+ convention — embeds at build time via babel inline).

### `.env.example` (committed)
```bash
# Supabase (Phase 3 — publishable RLS-gated values, safe to commit)
EXPO_PUBLIC_SUPABASE_URL=https://rmvodrpgaffxeultskst.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_Vuwd5-jaCnOWpbY3FP0D7w_3ZoVMMNX

# RevenueCat (Phase 4.1 — pending)
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=

# PostHog (Phase 4.4 — pending)
EXPO_PUBLIC_POSTHOG_KEY=
EXPO_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Sentry (Phase 4.4 — pending)
SENTRY_DSN=
SENTRY_AUTH_TOKEN=

# Google Sign-In (Phase 3.2 deferral)
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
```

### `.env` (gitignored)
Local copy of `.env.example` with actual Supabase values populated. The anon key is publishable because every table is RLS-gated.

### Runtime usage
Only `src/lib/supabase.ts` reads env vars directly:
```typescript
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
```

If either is missing at runtime, `src/lib/error-log.ts` captures the error but the app still launches — the user just can't make cloud requests.

---

## 17. CI/CD Pipeline

**File:** `.github/workflows/android.yml`
**Triggers:** `push` to `main`, `pull_request` to `main`, `workflow_dispatch`
**Concurrency:** `android-ci-${{ github.ref }}` with `cancel-in-progress: true`

### Job 1: `checks` (runs on every push + PR)
1. `actions/checkout@v4`
2. `actions/setup-node@v4` (Node 20 + npm cache)
3. `npm install`
4. `npx tsc --noEmit` with `NODE_OPTIONS=--max-old-space-size=8192`
5. `npm test` (67 Jest tests)

Typical runtime: ~55 seconds.

### Job 2: `build` (runs on push to main + workflow_dispatch only, skipped on PRs)
Dependencies: `needs: checks`. Only runs if `checks` passed.
1. Checkout + setup-node + npm install
2. `actions/setup-java@v4` (Temurin 17)
3. `android-actions/setup-android@v3`
4. **Provision `.env`** — from `secrets.EXPO_PUBLIC_SUPABASE_*` if set, else copy `.env.example`
5. **Setup signing** — decode `ANDROID_KEYSTORE_BASE64` secret, inject signing config into `build.gradle` via `sed` (idempotent grep guard)
6. **Compute versionCode** — `echo "code=${{ github.run_number }}" >> $GITHUB_OUTPUT`
7. **Build Release APK** — `./gradlew assembleRelease -PTITAN_VERSION_CODE=${{ steps.vc.outputs.code }} -PTITAN_VERSION_NAME=1.0.0`
8. Set version tag: `$(date +'%Y.%m.%d')-$(git rev-parse --short HEAD)`
9. `actions/upload-artifact@v4` — uploads APK as `titan-protocol-android-YYYY.MM.DD-<sha>`

Typical runtime: ~33 minutes.

### Required GitHub secrets (not yet set)
- `ANDROID_KEYSTORE_BASE64` — base64-encoded `titan-release.jks`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `EXPO_PUBLIC_SUPABASE_URL` (optional — falls back to `.env.example`)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` (optional — falls back to `.env.example`)

### Known CI facts
- `github.run_number` is monotonically increasing across ALL workflow runs forever → Play Store's versionCode constraint is satisfied automatically
- The CI workflow failed 3 times in a row before landing (gradle DSL precedence bug → R8 stripping DI classes → both fixed). The first successful run was `24090221033` on `b7da4b54`.

---

## 18. Testing

### Test runner
- `jest` ^29.7.0 + `jest-expo` ^55.0.13 preset
- Runs via `npm test` or `npm run test:watch`
- **Zero tests touch the RN runtime** — we only test pure-function logic. Device testing covers the rest.

### `jest.config.js`
```javascript
module.exports = {
  preset: "jest-expo",
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  testPathIgnorePatterns: ["/node_modules/", "/legacy/", "/.expo/", "/android/"],
  transformIgnorePatterns: ["node_modules/(?!(...RN pkgs...))"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  collectCoverageFrom: ["src/lib/**/*.ts", "!src/lib/**/*.d.ts"],
};
```

### Test suites (67 tests total)
| Suite | Tests | Covers |
|---|---|---|
| `src/__tests__/scoring.test.ts` | 27 | `scoring-v2.ts` — weighted Titan score, per-engine score, rank grades |
| `src/__tests__/date.test.ts` | 16 | `date.ts` — DST-safe arithmetic, `getTodayKey`, `addDays`, `formatDateShort` |
| `src/__tests__/schemas.test.ts` | 24 | `schemas.ts` — Zod validation + `parseOrFallback` |

### Not tested (intentional)
- Components (RN runtime required)
- Zustand stores (MMKV mock not worth it)
- Supabase services (integration tests require real DB)
- Reanimated worklets (native thread)
- Navigation

### Coverage policy
`collectCoverageFrom` is limited to `src/lib/**/*.ts` — we only measure coverage of the pure-function layer. Stores and components are tested via on-device smoke testing instead.

---

## 19. Assets

### Icons
| File | Size | Use |
|---|---|---|
| `assets/icon.png` | 671 KB | Main launcher icon |
| `assets/splash-icon.png` | 271 KB | Splash screen |
| `assets/android-icon-foreground.png` | 88 KB | Adaptive icon foreground |
| `assets/android-icon-background.png` | 1.7 KB | Adaptive icon background |
| `assets/android-icon-monochrome.png` | 804 B | Monochrome adaptive icon (Android 13+) |
| `assets/favicon.png` | 3.3 KB | Web favicon (unused currently) |

### Audio (138 voice-line MP3s)
Organized under `assets/audio/protocol/`:

| Folder | Count | Purpose |
|---|---|---|
| `archetypes/` | 8 | Per-archetype greeting voice lines |
| `bosses/` | 18 | Boss reveal + defeat voice lines |
| `cinematics/` | 39 | Day-by-day cinematic voice-overs (Day1-Day365) |
| `daily/` | 11 | Daily greeting voice lines (variants) |
| `failure/` | 15 | Streak break + integrity warning lines |
| `onboarding/` | 18 | Onboarding beat voice-overs (ONBO-001 through ONBO-018) |
| `operations/` | 9 | Daily operation announcement lines |
| `ranks/` | 8 | Rank promotion voice lines (one per rank) |
| `surprises/` | 12 | Surprise event voice lines |

Voice line IDs follow a convention: `ONBO-XXX`, `BOSS-XXX`, `DAY-XXX`, etc. The player lives in `src/lib/protocol-audio.ts`.

Raw source files live in `titan-voice-lines/` (gitignored, 26 files). Use `generate-onboarding-voices.js` (not tracked?) for regenerating them via ElevenLabs.

### Fonts
Loaded at runtime via `@expo-google-fonts/jetbrains-mono`:
- `JetBrainsMono_400Regular`
- `JetBrainsMono_600SemiBold`
- `JetBrainsMono_700Bold`
- `JetBrainsMono_800ExtraBold`

Render-blocked in `app/_layout.tsx` until `useFonts` resolves.

---

## 20. Phase History (Completed Work)

A condensed summary of every phase that's been shipped. See `ROADMAP.md` for the full change log.

### Part 1 — Repo Cleanup (2026-04-06)
- **1.0** Pre-flight safety — git tag `pre-restructure-2026-04-06`, 3 backup copies
- **1.1** Restructured repo — `apps/mobile/*` → repo root, `apps/web` → `legacy/web/`, `android/` now tracked in git
- **1.2** Verified configs post-move — npm install, tsc, expo config all pass
- **1.3** Rewrote CLAUDE.md for mobile-first layout
- **1.4** Baseline safety nets — `app/+not-found.tsx`, `RootErrorBoundary`, `.env.example`

### Part 2 — Bug Fix Phases
**2.1 Critical Stability (2026-04-06)**
- **2.1A** Animation cleanup pass — added `cancelAnimation` cleanup to 10 files (the original offenders: Panel, MissionRow, HabitChain, SkillTreeNode, TitanProgress, PulsingGlow, AnimatedBackground, FloatingActionButton, MissionBoard)
- **2.1B** Collapsed `addTask` double store update into single atomic `set()`
- **2.1C** Memoized `MissionRow` properly — `taskId` prop API, `useMemo` gesture, `useCallback` toggle
- **2.1D** Android shadow optimization — `Platform.select`, capped `elevation: 2`
- **2.1E** Rank-up refactor — `pendingRankUps` queue in `useProfileStore`, overlay moved to root layout
- **2.1F** Overlay priority state machine — documented render order (extraction deferred to 2.3)

**2.2 Data Integrity (2026-04-06)**
- **2.2A** Atomic protocol session writes via `protocol_write_pending` flag + shared `computeNewStreak`
- **2.2B** Kill silent catches — new `src/lib/error-log.ts` ring buffer, `storage.ts` logs via `logError`
- **2.2C** Zod schemas at read boundaries — `src/lib/schemas.ts` + `parseOrFallback`, fixes `(skillTreeData as any)` cast
- **2.2D** Central MMKV key registry at `src/db/keys.ts`, 4 stores migrated

**2.3 Architecture (2026-04-06, partial)**
- **2.3B** Track sub-tabs persistence via MMKV (partial — full route split deferred)
- **2.3C** Typed routes — 7 `router.push('...' as any)` casts removed via `Href`
- **2.3E** Removed orphaned `app/settings/index.tsx`
- **2.3F** Habit stats denormalization — ~1200 disk reads → ~30 via in-memory cache
- **2.3A/D** Overlay orchestrator + ScreenHeader — **deferred**

**2.4 Polish (2026-04-06)**
- **2.4-pre** Fixed 4 pre-existing TS errors in onboarding Beat components (first clean tsc baseline)
- **2.4A** FlashList audit — budgets converted, others audited
- **2.4B** Loading skeleton primitive
- **2.4D** JetBrains Mono via `@expo-google-fonts/jetbrains-mono`
- **2.4F** Jest framework — 67 tests across 3 suites

### Part 3 — Cloud Migration
**3.1 Supabase Setup + Schema (2026-04-07)**
- Created Supabase project `Titan Protocol` (ref `rmvodrpgaffxeultskst`, region `ap-south-1`)
- Applied 6 migrations: foundation → core → gamification → content → billing+RLS → hardening
- 27 tables, 0 security advisor lints
- Generated `src/types/supabase.ts` (1300 lines)

**3.2 Auth Flow (2026-04-07)**
- Installed `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `react-native-url-polyfill`
- `src/lib/supabase.ts` + `src/stores/useAuthStore.ts`
- Four auth screens under `app/(auth)/`
- Route guarding in `app/_layout.tsx`
- Google OAuth deferred

**3.3 Data Layer Refactor (2026-04-07)**
- React Query 5.96 + persist-client + NetInfo installed
- `src/lib/query-client.ts` with MMKV-backed persister + online manager bridge
- Built all 5 services (`src/services/{profile,tasks,habits,protocol,rank-ups}.ts`)
- Built all 5 query hook files (`src/hooks/queries/*.ts`)
- `OnboardingGate` component

**3.4 Offline-First Sync (2026-04-07)**
- `networkMode: 'offlineFirst'` on mutations
- NetInfo → `resumePausedMutations()` on reconnect
- `useIsOnline` hook
- `OfflineBanner` component
- `useAppResumeSync` + `AppResumeSyncMount`

**3.5 MMKV → Supabase Migration + Consumer Cutover (2026-04-07)**
First pass (morning):
- `src/lib/migrate-to-supabase.ts` one-time migration
- `src/components/MigrationGate.tsx`
- Engine detail screen migrated (`app/engine/[id].tsx`)
- Add-task modal migrated
- `RankUpOverlayMount` replaces inline overlay

Second pass (evening audit remediation):
- **Dashboard** (`app/(tabs)/index.tsx`) — full cutover, removed `handleToggleStr` bridge
- **Protocol screen** (`app/protocol.tsx`) — morning/evening via `useSaveMorningSession`/`useSaveEveningSession`
- **Track tab HabitsTab** — cloud reads+writes, journal XP
- **Profile tab** — XP/level/streak reads
- **Achievement popup** — cloud XP reward
- **Titan unlock modal** — cloud XP read
- **Hub/command** — full cutover (reads, toggles, XP)
- **Hub/focus** — focus session XP
- **Hub/workouts** — workout XP
- **Hub/settings** — profile display
- **`src/lib/skill-tree-evaluator.ts`** `checkHabitStreak()` — reads `profiles.streak_current` via `queryClient` singleton

**3.6 Animation Leak Sweep (2026-04-07)**
- Found and fixed 18 files with `withRepeat(..., -1, ...)` and no `cancelAnimation` cleanup — same bug family as Phase 2.1A, all crept in since that fix
- Files included dashboard, skill-tree, all 8 onboarding Beat components, 4 story cinematics, walkthrough summary, titan unlock celebration, title wall, integrity warning, daily briefing, rank promotion

**3.7 Native Config Blockers (2026-04-07)**
- Created `babel.config.js` + `metro.config.js` (didn't exist before)
- Hoisted `babel-preset-expo` to devDependencies
- Added `POST_NOTIFICATIONS` to AndroidManifest.xml
- Rewrote versionCode to read from `TITAN_VERSION_CODE` gradle property
- CI workflow passes `-PTITAN_VERSION_CODE=github.run_number`
- Enabled R8 minify + resource shrink for release builds

**3.8 Dependency Hygiene + Dead Code (2026-04-07)**
- `expo install --check` — 17 outdated packages resolved
- `react-native-worklets` downgraded `0.7.4 → 0.7.2` (SDK 55 pin)
- Deleted `src/components/v2/protocol/` (6 files, 1162 lines, zero consumers)
- Deleted `src/lib/protocol-completion.ts` (~550 lines, only used by dead v2/protocol)
- Deleted 3 stub hooks (`useProtocol`, `useMindExercise`, `useSkillProgress`)
- Total: ~1800 lines removed

**Post-audit fixes (2026-04-07)**
- `e9bb01e3` — Gradle DSL operator precedence bug in versionCode/versionName (CI run failure)
- `b7da4b54` — ProGuard keep rules for expo-av + expo-modules-core DI (R8 was stripping required classes)

---

## 21. Known Bugs & Tech Debt

### Blockers for launch — NONE
All the original blockers from CLAUDE.md are fixed:
- ✅ 15+ task crash (2.1A + 3.6)
- ✅ Rank-up overlay visibility (2.1E → 3.5d)
- ✅ Protocol dual-write race (2.2A → 3.1 schema fixes it fundamentally)
- ✅ Silent catches in storage (2.2B)
- ✅ Track tab sub-tab persistence (2.3B)
- ✅ Android elevation bomb (2.1D)
- ✅ Habit stats O(n²) (2.3F)
- ✅ Cross-device sync missing (3.5)
- ✅ Play Store versionCode stuck at 1 (3.7)
- ✅ Android 13+ notifications broken (3.7 — POST_NOTIFICATIONS)
- ✅ R8 minify stripping expo-av DI (post-audit fix)

### Medium tech debt
- **`app/_layout.tsx` is 593 lines** — the overlay orchestration is still in one monolithic file. Extract to `src/lib/overlay-orchestrator.ts` in Phase 4 (deferred since 2.1F).
- **Dashboard `handleToggle` closure staleness** — the "all tasks complete" celebration check reads `tasks` from closure which can be one render stale. Cosmetic only (celebration might fire on the wrong tap).
- **Non-core stores still MMKV** — ~28 stores (gym, sleep, money, etc.) haven't been migrated to cloud. Not a bug, but means those domains don't survive a phone wipe. Phase 3.9.
- **useAnalyticsData still MMKV** — 84-day historical sparklines + heatmap read from MMKV. Since cloud tasks/completions are a superset, analytics can show stale history for several days until the legacy store catches up. Phase 3.9.
- **HabitChain component hidden** — 14-day chain visualization was temporarily removed from the Track tab during Phase 3.5c because it reads from the legacy `useHabitStore.loadDateRange` path. Needs refactor to take logs as a prop. Post-launch.
- **MorningMissionPreviewPhase + EveningScoreRevealPhase** subcomponents in `app/protocol.tsx` still read `useEngineStore`. Read-only display paths, no data loss risk. Phase 3.9.
- **`app/(tabs)/engines.tsx` still on legacy store** — read-only list, cosmetic staleness only. Phase 3.9.
- **`expo-av` unmaintained warning** — expo-doctor flags `expo-av` as unmaintained. Migrate to `expo-audio` + `expo-video` before SDK 56. Currently muted in the doctor advisor.
- **`@types/jest 30.0.0` vs expected `29.5.14`** — cosmetic type mismatch, no runtime impact.
- **`@shopify/flash-list` minor version drift** — cosmetic.

### Low tech debt
- **40 `as any` / `as unknown` escapes** — mostly cosmetic RN style props (`fontWeight: "650" as any`, `Ionicons name={x as any}`). A few real lies in onboarding (`setIdentity(finalArchetype as any)`).
- **21 Day-N cinematic components loaded eagerly** — `app/_layout.tsx` imports Day2 through Day365 statically. Should be lazy-loaded post-launch.
- **`RootErrorBoundary` doesn't forward to Sentry yet** — TODO comment. Phase 4.4.
- **Google Sign-In** — button is a "coming soon" alert. Needs OAuth client registered against keystore SHA-1.

### Not bugs but worth knowing
- `node`/`npm` live in `/opt/homebrew/bin/` — if a Claude Code session can't find them, prepend to `PATH`
- Gradle local dry-runs fail with "Cannot start process 'node'" unless `PATH` includes the Homebrew prefix. CI provides Node via `setup-node` so it's fine there.
- The `android/` tracking means `expo prebuild` would OVERWRITE manual config changes. Never run prebuild.
- Do not commit `titan-release.jks` or `titan-release.jks.b64` — they're gitignored, keep them that way. Losing them means losing the ability to publish updates.

---

## 22. Remaining Work (Pre-Launch)

### Phase 3.9 — Follow-up cutover (estimated ~2 days)
Build service + hook layers for the ~28 non-core domains that have Supabase tables but no service layer:
- Gym (exercises, templates, sessions, sets)
- Sleep logs
- Weight logs
- Nutrition (profile, meal logs)
- Money (transactions, budgets)
- Deep work sessions
- Journal entries content
- Quests
- Achievements unlocked
- Skill tree progress
- Narrative entries
- Story state
- Field operations

Then migrate consumers. After this, delete all non-UI Zustand stores.

**Also in 3.9:**
- Migrate `useAnalyticsData` to React Query so historical sparklines + heatmap read cloud data
- Fix engines tab + HabitChain
- Clear MMKV on sign-out (account-switch pollution fix)

### Phase 4.1 — RevenueCat Integration
- Install `react-native-purchases` SDK
- Register products in Play Console + RevenueCat dashboard
- Wire up restore purchases flow
- Build webhook → Supabase `subscriptions` table
- Free trial logic (7 days on Annual)

### Phase 4.2 — Paywall UX
- Design paywall modal (`app/(modals)/paywall.tsx`)
- Trigger paywall after first task completion
- "Restore purchases" flow
- Entitlement gating (free users get onboarding + first task)

### Phase 4.3 — Play Store Assets + Listing
- Short description (80 chars)
- Full description (4000 chars)
- 2-8 phone screenshots
- Feature graphic (1024×500)
- Privacy policy URL
- Data safety form
- Content rating questionnaire

### Phase 4.4 — Pre-Launch Quality Gate
- Sentry integration (`@sentry/react-native`)
- PostHog analytics (`posthog-react-native`)
- Onboarding → paywall → first purchase funnel tracking
- Crash-free rate ≥ 99.5% on closed testing
- Closed testing with 10-20 beta users
- Pricing validation survey

### Phase 4.5 — Staged Rollout
- 10% → 50% → 100% over ~4 days
- Monitor: crash rate, ANR rate, rating, review sentiment, subscription conversion
- Hotfix pipeline ready

**Estimated total to launch:** ~2-3 weeks from now.

---

## 23. Pricing & Monetization

### Planned tiers (placeholder — validate in Phase 4.4 closed beta)

| Tier | Price | Equivalent Monthly | Positioning |
|---|---|---|---|
| **Monthly** | $6.99 | $6.99 | "Try it out" — discouraged in favor of annual |
| **Annual** | $49.99 | $4.17/mo | **BEST VALUE** — highlighted, ~40% discount vs monthly |
| **Lifetime** (optional) | $119.99 | — | Power users, funds early dev, ~2.4× annual |

### Paywall trigger
After the user completes their **first task**. Before that point, onboarding is fully free. The Phase 2.1 "15+ task crash" fix was partly motivated by keeping the paywall trigger reliable.

### Competitive benchmarks
- Finch: $4.99/mo, $39.99/yr
- Fabulous: $9.99/mo, $39.99/yr, $79.99 lifetime
- Habitica: free + donation
- Streaks: $4.99 one-time
- Todoist Pro: $4/mo, $36/yr

### Rationale
- 365-day narrative framing matches annual pricing
- Early paywall → lower conversion rate but self-selected serious users → premium pricing justified
- Cinematic production value (138 voice lines) signals premium

### Free trial
7-day free trial on Annual (not Monthly).

### Google Play fees
15% on first $1M/year, 30% after. Annual pricing was set with this in mind.

### Infrastructure
- **Billing:** RevenueCat (free up to $10k MRR)
- **Store:** Google Play Billing via RevenueCat
- **Webhook:** Supabase Edge Function writes to `subscriptions` table
- **Entitlement check:** Read from `subscriptions` table in React Query

---

## 24. Critical Invariants & Conventions

Follow these rules when touching the code.

### Imports
- Use the `@/` alias: `@/lib/scoring-v2` instead of relative paths when 3+ levels deep
- Resolved via `tsconfig.json` paths → `./src/*`

### Styling
- **`StyleSheet.create()` + theme tokens only.** No inline colors. No `NativeWind`, no `styled-components`, no runtime theme switching.
- Theme tokens come from `@/theme` (re-exports from colors.ts, typography.ts, spacing.ts, radius.ts, shadows.ts)

### Animations
- **Reanimated 4 only.** No `Animated` from `react-native`.
- **Every `withRepeat(..., -1, ...)` MUST have a `cancelAnimation()` in its useEffect cleanup.** This is the #1 source of crashes in this project. Added two batch sweeps (2.1A + 3.6) to fix 26 files between them.
- Prefer `useMemo` / `useCallback` on gestures and callbacks passed to worklets so React.memo isn't defeated.
- Declarative animation primitives (`FadeIn`, `FadeInDown`) don't need cleanup — they're one-shot.

### State management
- **One Zustand store per domain.** Selectors use `useStore(s => s.field)` pattern.
- **New persistent data MUST go into the Supabase schema**, not a new Zustand store.
- **Cloud domains read from React Query hooks, not stores.** If you see `useProfileStore((s) => s.profile.xp)` in new code, it's wrong — use `useProfile()` instead.
- `getState()` imperative reads are OK for one-shot reads in event handlers, but never in render bodies.

### Data writes
- **Never write to both MMKV AND Supabase for the same domain.** Pick one path per mutation. For cloud-migrated domains (profile/tasks/habits/protocol/rank-ups), use the mutation hooks.
- Optimistic updates roll back via `onError` context in the mutation hook. Never mutate cached objects in place.

### Haptics
- Use `src/lib/haptics.ts` helpers, never call `Haptics` from `expo-haptics` directly.

### Navigation
- Use `router.push()` / `router.replace()` from `useRouter()`.
- No `as any` casts on routes — typed routes are enforced (Phase 2.3C).

### Tasks & task IDs
- **Task IDs are Supabase UUIDs (strings) in all new code.** The legacy `useEngineStore` still uses `number` internally, but `MissionRow` and all cloud hooks use strings.

### Error handling
- Service functions throw on error. React Query hooks catch and log via `logError`. Consumer code handles user-facing feedback (Alert / haptics).
- Never silently `catch {}` — use `logError` from `src/lib/error-log.ts`.

### Dates
- Use `src/lib/date.ts` helpers — `getTodayKey`, `addDays`, `toLocalDateKey`, `formatDateShort`.
- Never do `new Date(); d.setDate(d.getDate() - i)` in a loop — it's DST-unsafe on year boundaries.
- Date keys are `YYYY-MM-DD` format in local timezone.

### MMKV
- Use the `K` registry in `src/db/keys.ts` for any key referenced in more than one place.
- Reads go through `getJSON<T>(key, fallback)` which logs parse errors.
- Writes go through `setJSON(key, value)`.

### What NOT to do
- Don't modify `legacy/` — it's the frozen web app, read-only reference
- Don't commit `titan-release.jks` or `.env`
- Don't reinvent `scoring-v2.ts`, `date.ts`, or `ranks-v2.ts`
- Don't add new Zustand stores for data that will live in Supabase
- Don't add new animation loops without `cancelAnimation` cleanup
- Don't run `expo prebuild` — it will overwrite the tracked `android/` folder
- Don't skip CI hooks on commits unless you have a damn good reason

---

## 25. Architectural Decisions Log

Key decisions that shaped the project. Referenced by ROADMAP.md.

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-06 | Mobile promoted to repo root, web → `legacy/` | Web shipped, product-market fit is on mobile. Simplest possible repo structure. |
| 2026-04-06 | `android/` tracked in git (not gitignored) | Reproducible Play Store builds. No dependence on `expo prebuild` state. |
| 2026-04-06 | Supabase chosen over Firebase | PostgreSQL + RLS, generous free tier, has MCP tools for management, open source. |
| 2026-04-06 | RevenueCat chosen over raw Google Play Billing | Handles receipts, webhooks, cross-platform future-proofing. Free up to $10k MRR. |
| 2026-04-06 | Android first, iOS deferred | Play Console already set up, keystore exists. iOS adds cost + review friction. |
| 2026-04-07 | React Query over plain Supabase calls | Cache persistence to MMKV, optimistic updates, offline queue, automatic refetch. Better than rolling our own. |
| 2026-04-07 | MMKV persister for React Query cache | Instant cold start (cache hydrates from disk). Works across force-quit. |
| 2026-04-07 | Single protocol_sessions row per (user, date) | Eliminates the 2.2A multi-key-write race fundamentally. Atomic upserts. |
| 2026-04-07 | Rank-up events in cloud table (not MMKV queue) | Cross-device visibility — level up on phone A, overlay fires on phone B next open. |
| 2026-04-07 | `github.run_number` as versionCode source | Monotonically increasing across all CI runs forever. Zero manual bookkeeping. Satisfies Play Store constraint automatically. |
| 2026-04-07 | R8 minify + resource shrink enabled | ~30% APK size reduction. Proguard keep rules added for expo-av + expo-modules-core DI after first CI failure. |
| 2026-04-07 | Google Sign-In deferred until keystore-registered OAuth client | Can't register the client until SHA-1 of the signing key is known. Email + magic link cover 90% of users. |
| 2026-04-07 | Email + password + magic link instead of password-only | Magic link removes password fatigue. Magic link deep-link handles 3 fallback paths (PKCE → implicit → session check). |
| 2026-04-07 | Non-core domains (gym/sleep/money/etc) deferred to Phase 3.9 | Scope control. Core loop (profile + tasks + habits + protocol + rank-ups) ships first. Non-core migrates as follow-up without blocking launch. |
| 2026-04-07 | Keep legacy Zustand stores as read paths during cutover | Consumer migration is per-screen. Keeping stores alive until their last consumer is migrated avoids half-broken states. Stores get deleted in Phase 3.9 cleanup. |

---

## 26. Glossary

**Archetype** — One of 8 identity types (titan, athlete, scholar, hustler, showman, warrior, founder, charmer). Each has a 4-engine weight distribution that determines how their weighted Titan Score is computed.

**Chapter** — A narrative grouping of days with a kicker name. The app has 4 chapters matching the progression phases.

**Combat Power** — UI label for the Titan Score on the HQ dashboard. Same number, different branding.

**Daily Protocol** — The morning + evening ritual. Morning sets an intention. Evening reveals today's Titan Score, asks for reflection, asks for an identity vote.

**Day-N Cinematic** — Scripted story beats at Day 2-14, 30, 45, 60, 90, 365. Triggered by `first_active_date` MMKV key + day count.

**Engine** — One of the 4 life dimensions (Body, Mind, Money, Charisma).

**Field Op** — A daily operational challenge. Generated by `src/lib/operation-engine.ts`.

**HUD** — The dashboard's visual aesthetic: black background, white accents (NOT cyan), thin borders, monospace fonts. Modeled on military/sci-fi heads-up displays.

**Identity Vote** — At the end of each evening protocol, the user "votes" for whether they were true to their archetype today. Aggregated into archetype strength over time.

**Integrity** — Streak health. Level 0 = perfect, Level 3 = critical. Tracked by `src/lib/protocol-integrity.ts`.

**Main task** — Worth 2 points in engine scoring. "Side quest" / "secondary" tasks are worth 1 point.

**Momentum** — Streak-based XP multiplier. Kicks in at 7-day streak, max at 30+ day streak.

**MMKV** — `react-native-mmkv`, the synchronous key-value store used for local data + React Query cache persistence.

**New Architecture** — React Native's Fabric + TurboModules runtime. Enabled via `newArchEnabled=true` in gradle.properties.

**Ops / Operation** — A daily mission with a codename shown on the dashboard banner. Generated by `src/lib/operation-engine.ts` based on archetype + day number.

**Phase** — Progression chapter: Foundation (days 1-30) → Building (31-90) → Intensify (91-180) → Sustain (181-365).

**R3F** — `@react-three/fiber`, the React renderer for Three.js. Used for rank-up scenes and chapter transitions.

**Rank** — Player rank from Initiate → Operative → Agent → Specialist → Commander → Vanguard → Sentinel → Titan. Gated by consecutive days + average score.

**Rank Grade** — Daily letter grade (D/C/B/A/S/SS) based on today's Titan Score.

**RLS** — Row Level Security. Every Supabase table has `user_id = auth.uid()` policies.

**Side quest** — Secondary task, worth 1 point. Main tasks worth 2.

**Skill Tree** — Per-engine node tree with unlockable passive buffs. Triggered by completion milestones.

**Streak** — Consecutive days of activity. Lives on `profiles.streak_current`. Best streak on `profiles.streak_best`. Breaks if a day is missed.

**Titan Mode** — The unlockable "endgame" mode — requires 30 days at 85%+ average score. Unlocks a special cinematic and a gold color scheme.

**Titan Score** — The weighted daily score. Computed as the average of per-engine scores, weighted by the user's archetype. Shown as "Combat Power" on the dashboard.

**TurboModule** — React Native New Architecture native module system. Enabled project-wide.

**Walkthrough** — The post-onboarding guided tour that teaches the user about engines, tasks, habits, and tools.

**Worklet** — A JS function marked to run on the Reanimated UI thread. Needs the worklets babel plugin (auto-applied via `babel-preset-expo`).

---

**End of Titan Protocol reference.**

Last commit on this doc: see `git log TITAN_PROTOCOL.md`.
Canonical roadmap: [ROADMAP.md](./ROADMAP.md).
Claude Code session rules: [CLAUDE.md](./CLAUDE.md).
