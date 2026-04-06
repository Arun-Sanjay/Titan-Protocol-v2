# Titan Protocol — Android App Architecture

## Overview

Local-first personal performance OS for Android. Tracks 4 life dimensions (Body, Mind, Money, General) with gamified scoring, analytics, and HUD-style dark UI. All data on-device via MMKV. No backend.

---

## Tech Stack

| Layer | Tech | Version |
|-------|------|---------|
| Framework | Expo | 55.0.8 |
| Runtime | React Native | 0.83.2 |
| Language | TypeScript | 5.9.2 |
| Navigation | Expo Router | 55.0.7 |
| State | Zustand | latest |
| Storage | MMKV (react-native-mmkv) | 4.3.0 |
| Animations | React Native Reanimated | 4.2.1 |
| Gestures | React Native Gesture Handler | 2.30.0 |
| Lists | @shopify/flash-list | latest |
| Graphics | React Native SVG | 15.15.3 |
| Icons | @expo/vector-icons (Ionicons) | 15.0.2 |
| Haptics | expo-haptics | 55.0.9 |

---

## File Structure

```
apps/mobile/
├── app/                          # Expo Router file-based routes
│   ├── _layout.tsx               # Root: GestureHandler + StatusBar + MotivationalSplash
│   ├── (tabs)/
│   │   ├── _layout.tsx           # 5-tab bar (HQ/Engines/Track/Hub/Profile)
│   │   ├── index.tsx             # HQ Dashboard
│   │   ├── engines.tsx           # Engine overview
│   │   ├── track.tsx             # Habits/Journal/Goals sub-tabs
│   │   ├── hub.tsx               # Tools grid (9 items)
│   │   └── profile.tsx           # XP, rank, streak
│   ├── engine/[id].tsx           # Engine detail (per-engine tasks)
│   ├── hub/
│   │   ├── focus.tsx             # Pomodoro timer
│   │   ├── analytics.tsx         # Charts + breakdown
│   │   ├── command.tsx           # Cross-engine task view
│   │   ├── nutrition.tsx         # Macro tracking
│   │   ├── sleep.tsx             # Sleep logging
│   │   ├── weight.tsx            # Weight tracking
│   │   ├── workouts.tsx          # Exercise templates
│   │   ├── cashflow.tsx          # Income/expense
│   │   ├── budgets.tsx           # Monthly limits
│   │   └── deep-work.tsx         # Task tracking + earnings
│   ├── settings/index.tsx        # Backup/restore, clear data
│   └── (modals)/add-task.tsx     # Modal: add mission/side quest
├── src/
│   ├── components/ui/            # 22 reusable components
│   ├── stores/                   # 7 Zustand stores
│   ├── hooks/useAnalyticsData.ts # Computed analytics
│   ├── db/                       # MMKV storage layer + types
│   ├── lib/                      # Date utils + quotes
│   └── theme/                    # Colors, typography, spacing, shadows
```

---

## Navigation

### Tab Bar (5 tabs)
- `animation: "fade"`, `freezeOnBlur: true`
- Tabs: HQ, Engines, Track, Hub, Profile
- Bar: `#080809` bg, `rgba(255,255,255,0.06)` border, 72px height

### Routes
```
/                    → HQ Dashboard
/engines             → Engine overview
/track               → Habits/Journal/Goals
/hub                 → Tools grid
/profile             → Gamification profile
/engine/[id]         → Engine detail (stack push, slide_from_right)
/hub/*               → Tool screens (stack push)
/settings            → Settings (stack push)
/(modals)/add-task   → Add task (modal, slide_from_bottom)
```

---

## State Management (Zustand)

### useEngineStore
```
State: tasks (per engine), completions (per engine:date), scores (per engine:date)
Actions: loadEngine, loadAllEngines, loadDateRange, addTask, deleteTask, toggleTask
Selectors: selectTotalScore(scores, dateKey), selectAllTasksForDate(tasks, completions, dateKey)
```

### useProfileStore
```
State: profile { xp, level, streak, best_streak, last_active_date }
Actions: load, awardXP(dateKey, source, amount), updateStreak(dateKey)
```

### useHabitStore
```
State: habits[], completedIds per dateKey
Actions: load, addHabit, deleteHabit, toggleHabit
```

### useJournalStore
```
State: entries per dateKey
Actions: loadEntry, saveEntry
```

### useGoalStore
```
State: goals[], goalTasks per goalId
Actions: load, addGoal, deleteGoal, loadGoalTasks, addGoalTask, toggleGoalTask
```

### useFocusStore
```
State: settings (focus/break/longBreak minutes, target), daily sessions per dateKey
Actions: loadSettings, updateSettings, loadDaily, completeSession
```

---

## MMKV Storage Keys

```
tasks:{engine}                    → Task[]
completions:{engine}:{dateKey}    → number[] (task IDs)
user_profile                      → UserProfile
id_counter                        → number
habits                            → Habit[]
habit_logs:{dateKey}              → number[] (habit IDs)
journal:{dateKey}                 → JournalEntry
goals                             → Goal[]
goal_tasks:{goalId}               → GoalTask[]
focus_settings                    → FocusSettings
focus_daily:{dateKey}             → FocusDaily
```

---

## Scoring System

### Points
- Main task (Mission): 2 pts
- Secondary task (Side Quest): 1 pt

### Engine Score
`(earnedPoints / totalPoints) × 100`

### Titan Score
Average of all 4 engine scores.

### Daily Ranks
| Range | Letter | Color |
|-------|--------|-------|
| 0-29 | D | Gray #6B7280 |
| 30-49 | C | Purple #A78BFA |
| 50-69 | B | Blue #60A5FA |
| 70-84 | A | Green #34D399 |
| 85-94 | S | Gold #FBBF24 |
| 95-100 | SS | Orange #F97316 |

### XP
| Action | XP |
|--------|-----|
| Main task | +20 |
| Side quest | +10 |
| Habit | +5 |
| Journal | +15 |
| 7-day streak | +50 |
| 30-day streak | +200 |
| Perfect day | +100 |

### Levels
500 XP per level. Ranks: Recruit(1) → Soldier(5) → Captain(10) → Commander(20) → Titan(35) → Legend(50)

---

## UI Design System (HUD Theme)

### Color Palette
```
Background:           #000000
Surface:              rgba(0, 0, 0, 0.97)
Surface Hero:         rgba(0, 0, 0, 0.985)
Surface Light:        rgba(0, 0, 0, 0.95)

Border:               rgba(255, 255, 255, 0.11)
Border Strong:        rgba(255, 255, 255, 0.24)
Border Hover:         rgba(255, 255, 255, 0.26)
Panel Inner Border:   rgba(255, 255, 255, 0.03)
Glow Line:            rgba(242, 247, 255, 0.5)
Glow Soft:            rgba(188, 202, 247, 0.14)

Text:                 rgba(247, 250, 255, 0.96)
Text Secondary:       rgba(233, 240, 255, 0.72)
Text Muted:           rgba(210, 220, 242, 0.52)

Success:              #5cc9a0
Danger:               #de6b7d
Warning:              #FBBF24

Engine Body:          #00FF88
Engine Mind:          #A78BFA
Engine Money:         #FBBF24
Engine General:       #60A5FA

Tab Bar:              #080809
Tab Bar Border:       rgba(255, 255, 255, 0.06)
```

### Typography
```
Title:      28px, weight 700, letter-spacing 1
Kicker:     10px, weight 700, uppercase, letter-spacing 3 (section headers)
Caption:    13px, weight 500, uppercase, letter-spacing 1.5
Body:       16px, weight 400, line-height 24
Mono:       14px, weight 600, monospace
MonoLarge:  48px, weight 300, monospace (timer)
MonoValue:  24px, weight 800, monospace (stats)
XPValue:    14px, weight 700, monospace
```

### Spacing
```
xs:4  sm:8  md:12  lg:16  xl:20  2xl:24  3xl:32  4xl:40  5xl:48
```

### Border Radius
```
sm:8  md:12  lg:16  xl:22 (panels)  full:999 (pills)
```

### Shadows
```
Panel:  shadowColor #000, offset 0/12, opacity 0.66, radius 27, elevation 8
Card:   shadowColor #000, offset 0/8, opacity 0.5, radius 16, elevation 4
Glow:   shadowColor rgba(188,202,247), offset 0/0, opacity 0.14, radius 16
Ring:   shadowColor rgba(188,202,247), offset 0/0, opacity 0.2, radius 20
```

---

## Component Reference

### Panel (base container)
- 22px radius, 1px border rgba(255,255,255,0.11)
- Top edge: 1px glow line at 58% opacity (metallic sheen)
- Inner border: 1px rgba(255,255,255,0.03) overlay
- Press: scale 0.97 → 1, haptic Light
- Hero variant: slightly brighter bg, stronger top edge

### PowerRing (circular gauge)
- SVG Circle with animated strokeDashoffset (Reanimated)
- LinearGradient stroke (60-95% white opacity)
- Track: 6% white
- Center: rank letter + score % + "POWER"
- Glow shadow halo
- Animation guard: ref tracks last score, skips if unchanged

### RadarChart (4-axis radar)
- Pure SVG, no libraries
- Grid rings at 25/50/75/100%, axis lines, data polygon
- Labels as SVG <Text> (no clipping)
- Chart radius: 32% of container, labels at +22px

### SparklineChart (mini line)
- SVG Polyline (1.8px stroke) + Polygon area fill with gradient
- 7 data points, 140×36px

### HeatmapGrid (12-week activity)
- 84 cells, 11px with 3px gap
- 5-level white intensity by Titan Score
- Day labels + "Less/More" legend

### HabitGrid (per-habit 12-week)
- Binary: green (#34d399) at 60% or empty (3% white)
- Day labels M/W/F/S

### MissionRow (task item)
- Swipe gestures: right >80px = complete, left >80px = delete
- Checkbox: 18×18px, animates scale on toggle
- XP badge: monospace "+20" or "✓"

### MotivationalSplash (launch overlay)
- Full-screen black, centered italic quote + author
- Fade in at 300ms, fade out at 2500ms, auto-dismiss
- 32 quotes, daily rotation by dayOfYear

---

## Analytics Data (useAnalyticsData hook)

Computes from engine store:
- `titanScore` — today's average
- `engineScores` — per-engine today
- `activeEngines` — count with tasks
- `sparklineData` — 7-day arrays per engine
- `thisWeek` — avg, tasks completed, best day
- `lastWeek` — per-engine averages (for comparison arrows)
- `heatmapData` — 84 days of { dateKey, score }

---

## HQ Dashboard Layout

```
1. PageHeader: "TITAN PROTOCOL" / "TITAN OS"
2. XPBar (level + rank + progress)
3. StreakBadge (fire emoji)
4. ┌─────────────────┬──────────────┐
   │ TITAN SCORE     │ ENGINE       │
   │   44.0%         │ OVERVIEW     │
   │ 3/4 active      │ [RadarChart] │
   │ ████ Body 100%  │              │
   │ ███░ Mind  33%  │              │
   └─────────────────┴──────────────┘
5. VS LAST WEEK (4 engine columns with ↑/↓ arrows)
6. Engine sparkline cards (2×2 grid with 7-day charts)
7. THIS WEEK (Avg Score / Tasks / Best Day)
8. ACTIVITY (12-week heatmap)
9. TODAY'S MISSIONS (task list)
```

---

## Build

```bash
# Dev
cd apps/mobile && npx expo start

# APK via GitHub Actions
# Triggers on push to main when apps/mobile/** changes
# Output: titan-protocol-android artifact
```
