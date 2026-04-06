# CLAUDE.md

Guidance for Claude Code (and any other Claude session) working in this repo.

> **📋 ACTIVE ROADMAP: [ROADMAP.md](./ROADMAP.md) is the source of truth for current work and phase status. Read it at the start of every session.**

---

## What this project is

**Titan Protocol** — a gamified 365-day personal performance operating system for mobile. Tracks four "engines" (Body, Mind, Money, Charisma), layered with a narrative/cinematic story system (day-based cinematics at Day 1-14, 30, 45, 60, 90, 365), boss challenges, skill trees, archetypes, and a 4-phase progression system (Foundation → Building → Intensify → Sustain).

**Platform:** Android first, iOS deferred. Shipping to Google Play with a freemium subscription model (paywall triggers after the first task is completed).

## Current repo state (as of 2026-04-06)

The repo was restructured in Phase 1.1 to promote the mobile app to the root. The frozen web/Tauri app is preserved under `legacy/` for historical reference only.

```
titan-protocol/                  ← repo root = mobile app
├── app/                         # expo-router file-based routes
├── src/                         # application source (see breakdown below)
├── assets/                      # icons, audio, fonts (144 tracked files)
├── android/                     # native Android project (tracked, build artifacts gitignored)
├── titan-voice-lines/           # 26 raw voice MP3s (gitignored, pre-processing source)
├── titan-release.jks            # Play Store signing keystore (gitignored, DO NOT COMMIT)
├── package.json, app.json, eas.json, tsconfig.json
├── CLAUDE.md                    # this file
├── ROADMAP.md                   # canonical implementation plan
├── ARCHITECTURE.md              # older architecture doc (still relevant for feature context)
└── legacy/                      # web/Tauri app, FastAPI archive, design notes — READ-ONLY
```

## Tech stack

- **Runtime:** Expo SDK 55, React Native 0.83, New Architecture (Fabric + TurboModules) enabled, Hermes
- **Routing:** expo-router ~55.0.7 (file-based, `app/` directory)
- **State:** Zustand ^5.0.12 (~30 stores in `src/stores/` — will shrink to ~8 after Phase 3.3)
- **Storage:** react-native-mmkv ^4.3.0 (local-first — migrating to Supabase + MMKV offline cache in Phase 3)
- **Animation:** react-native-reanimated 4.2.1 (shared values, worklets, springs)
- **Graphics:** @shopify/react-native-skia 2.4.18, react-three-fiber 9.5.0, three ^0.183.2 (rank-up scenes, chapter transitions)
- **Lists:** @shopify/flash-list ^2.3.1 (installed, audit pending in Phase 2.4)
- **TypeScript:** 5.9 strict mode
- **Upcoming:** Supabase (Phase 3), RevenueCat (Phase 4), Sentry + PostHog (Phase 4.4)

## Key files to know

### State management (src/stores/)
~30 Zustand stores. The important ones:
- `useProfileStore.ts` — XP, level, streaks, `awardXP()` (rank-up detection needs refactor per Phase 2.1E)
- `useEngineStore.ts` — tasks + completions per engine (body/mind/money/charisma)
- `useProtocolStore.ts` — morning/evening protocol sessions (has a known dual-write race, fix in 2.2A)
- `useIdentityStore.ts` — archetype + engine weights
- `useModeStore.ts` — app mode (full_protocol, tracker, focus, zen, titan)
- `useAchievementStore.ts` — `pendingCelebration` queue pattern (**reference implementation for rank-up queue refactor**)
- `useQuestStore.ts`, `useSkillTreeStore.ts`, `useProgressionStore.ts` — gamification loops
- `useHabitStore.ts` — has O(n²) stats bug, fix in 2.3F

### Data layer (src/db/)
- `storage.ts` — MMKV wrapper with `getJSON`/`setJSON`. Has silent catch bugs, fix in 2.2B. Will become React Query persister adapter in Phase 3.4.
- `engine.ts` — scoring per engine

### Business logic (src/lib/)
- `scoring-v2.ts` — weighted Titan score, rank grades (D/C/B/A/S/SS)
- `date.ts` — ISO date helpers, DST-safe arithmetic
- `narrative-engine.ts` — story/cinematic gating
- `protocol-integrity.ts` — streak break detection
- `migration.ts` — schema migrations (archetype renames, etc.)
- `safety.ts` — corruption recovery for MMKV reads

### UI components (src/components/)
- `ui/` — 45+ UI primitives (Panel, ScoreGauge, ProgressRing, RadarChart, SparklineChart, HeatmapGrid, SystemWindow, RadialMenu, AchievementToast, LevelUpOverlay, Celebration, PageTransition, etc.)
- `3d/` — React Three Fiber scenes (RankUpScene, ChapterTransition, ParticleField)
- `v2/` — feature-specific components (quests, achievements, habits, narrative, identity, walkthrough)
- `os/` — OS-style chrome (HudCard, HudSectionTitle)

### Theme (src/theme/)
- `colors.ts` — full color palette (bg, surface, success, error, rank colors, engine colors)
- `typography.ts` — text styles (hero, title, mono, kicker — Menlo on iOS, monospace on Android; JetBrains Mono loading in 2.4D)
- `spacing.ts`, `radius.ts`, `shadows.ts` (shadows has Android elevation bomb, fix in 2.1D)

### Routes (app/)
- `(tabs)/` — 5-tab bottom nav: `index.tsx` (HQ), `engines.tsx`, `track.tsx` (has broken sub-tabs, fix in 2.3B), `hub.tsx`, `profile.tsx`
- `(modals)/` — 6 modals: add-task, achievement-popup, boss-challenge, perfect-day, phase-transition, titan-unlock
- `engine/[id].tsx` — engine detail with mission list
- `hub/*.tsx` — 11 hub sub-screens (focus, analytics, command, cashflow, workouts, sleep, weight, nutrition, budgets, deep-work, settings)
- `skill-tree/` — skill tree viewer with dynamic `[engine].tsx`
- `_layout.tsx` — **447-line root layout with overlay orchestration (extract in 2.1F)**
- Single-screen routes: protocol, onboarding, walkthrough, tutorial, war-room, narrative, quests, achievements, field-ops, titles, mind-training, status

## Common commands

```bash
# Dev
npm start                    # expo start (Metro bundler)
npx expo start --android     # start bundler + open on Android device
npx expo run:android         # build+install dev client on connected Android device

# Build
eas build --profile development --platform android   # dev client build
eas build --profile preview --platform android       # APK for internal testing
eas build --profile production --platform android    # AAB for Play Store

# Submit
eas submit --platform android    # upload to Play Console

# Type check
npx tsc --noEmit

# Native project (after changes to app.json plugins)
npx expo prebuild

# Android native build (local)
cd android && ./gradlew assembleDebug
```

Note: `node`/`npm` live in `/opt/homebrew/bin/` — if a session can't find them, `export PATH="/opt/homebrew/bin:$PATH"`.

## Known bugs being fixed (see ROADMAP.md Phase 2.1)

1. **15+ task crash** — infinite `withRepeat(-1)` Reanimated loops in `src/components/ui/Panel.tsx` (GlowLine), `PulsingGlow.tsx`, `SkillTreeNode.tsx`, `TitanProgress.tsx`, `AnimatedBackground.tsx`, `FloatingActionButton.tsx`, `MissionBoard.tsx`, and `MissionRow.tsx` never call `cancelAnimation()` on unmount. Combined with `addTask` double store update and Android shadow layer bomb from `shadows.card`, this OOMs on mid-range devices.

2. **Rank-up overlays don't appear** — `LevelUpOverlay` is mounted only in `app/(tabs)/index.tsx:625-629` (dashboard screen), not in root layout. When the user levels up on any other screen (engine detail, protocol completion, habits), the event fires but the overlay component isn't mounted. Fix: move detection into `useProfileStore.awardXP()`, add `pendingRankUps` queue, mount overlay in `app/_layout.tsx`.

## Coding conventions

- **Absolute imports:** `@/lib/scoring-v2` → `src/lib/scoring-v2.ts` (via tsconfig `paths`)
- **Styling:** `StyleSheet.create()` + theme tokens. No inline colors. No NativeWind/styled-components.
- **Animations:** Reanimated 4 only. Always `cancelAnimation()` in cleanup for infinite loops. Prefer `useMemo`/`useCallback` on gestures and callbacks passed to worklets.
- **Stores:** One Zustand store per domain. Selectors use `useStore(s => s.field)` pattern. Will migrate to React Query hooks in Phase 3.3.
- **Haptics:** Use `src/lib/haptics.ts` helpers, never call `Haptics` directly.
- **Navigation:** `router.push()` / `router.replace()` via expo-router. No `as any` casts (enforced after 2.3C enables typed routes).

## Memory banks (persisted across sessions)

These live in `~/.claude/projects/-Users-arunsanjay-Documents-Projects-Titan/memory/`:
- `implementation_roadmap.md` — pointer to ROADMAP.md, read first
- `project_focus.md` — project is mobile-first, web is frozen, don't modify `legacy/`
- `design_system.md` — visual design reference (colors, typography, component patterns)
- `v2.2_backup.md` — git tag restore point before game-feel overhaul

## What NOT to do

- **Do not modify anything in `legacy/`** — it's the frozen web/Tauri app. Only touch it if the user explicitly asks.
- **Do not commit `titan-release.jks` or `titan-release.jks.b64`** — they're gitignored, keep them that way. Losing them means losing the ability to publish updates.
- **Do not reinvent scoring, rank logic, or date utilities** — they already exist in `src/lib/scoring-v2.ts` and `src/lib/date.ts`.
- **Do not add new Zustand stores for data that will live in Supabase** — Phase 3.3 shrinks the store layer dramatically. New persistent data should go into the Supabase schema defined in ROADMAP.md Phase 3.1.
- **Do not add new animation loops without `cancelAnimation` cleanup** — that's exactly the bug we're fixing.
