# Screenshot Capture Spec — Mobile SaaS

> 8 screenshots per platform, captured from a real-device dev build with seed data already in place. This file specifies *what to capture* and *what state the app should be in for each shot*. Apple and Google both convert better with story-driven sequences than identical screenshots in different states.

---

## Required sizes

### iOS (App Store Connect)

- **6.7" iPhone:** 1290 × 2796 (required)
- **6.5" iPhone:** 1284 × 2778 OR 1242 × 2688 (required if 6.7" not provided)
- **5.5" iPhone (iPhone 8 Plus):** 1242 × 2208 (optional but accepted)
- **iPad Pro 12.9":** skip — `supportsTablet: false` in app.json

### Android (Play Console)

- **Phone:** minimum 1080 × 1920, max 7680 × 7680, 16:9 or 9:16 (required, minimum 2, up to 8)
- **7" tablet:** skip
- **10" tablet:** skip
- **Feature graphic:** 1024 × 500 PNG/JPG (required, separate from screenshots)

---

## Seed data — set this up before capturing

To make screenshots look impressive, run through this on your test account first:

- [ ] Create 6-8 tasks across all 4 engines (Body, Mind, Money, Charisma) with realistic titles (e.g., "Morning workout", "Read 1h", "Deep work block", "Voice rep"). Mix `main` (★★) and `secondary` (★) kinds.
- [ ] Mark 3-4 of today's tasks complete so the Dashboard score reads 60-90.
- [ ] Create 4-5 habits with varied frequencies (`5×/wk`, `daily`, etc.) and tick a few days back so chains are visible.
- [ ] Log 2-3 deep-work focus sessions today so the Focus "Today" stat reads non-zero.
- [ ] Log 3-4 journal entries on different dates (today, yesterday, day before yesterday) with realistic 1-2 sentence content.
- [ ] Create 3 goals — 2 active, 1 completed — with varied titles.
- [ ] Profile streak ≥ 5 days (manually update if needed via dev tools).
- [ ] Profile XP ≥ ~1000 so the XPBar shows a partial fill at level 3+.

---

## Shot list (in display order)

Order matters: the first 1-2 screenshots are what users actually see in the App Store carousel. Lead with the most striking visual.

### 1. Dashboard (HQ) — the hero

**Screen:** `/(tabs)/index.tsx` after sign-in.

**State:**
- Score gauge reads 80+ (S grade)
- All 4 engines populated with non-zero scores
- 4-5 missions visible in the "Today's Missions" list, 2-3 ticked
- XP bar showing partial fill

**Caption / overlay text (Play Store accepts captions on screenshots):**

```
Your day, scored.
```

---

### 2. Engine detail — Body — the consistency story

**Screen:** `/engine/body`

**State:**
- Today's score 75+
- 30-day heatmap row populated with at least 20 days of activity (color gradient visible)
- 3-4 body tasks with ticks

**Caption:**

```
Every engine, 30 days deep.
```

---

### 3. Tasks (Track tab) — the daily surface

**Screen:** `/(tabs)/track`

**State:**
- Filter pill set to "ALL"
- 8-10 tasks visible across all engines
- FAB visible in bottom-right corner

**Caption:**

```
Plan, execute, track. Cross-device.
```

---

### 4. Habits — the streak proof

**Screen:** `/habits`

**State:**
- 4-5 habits each with a populated 30-day chain
- At least one habit with current_chain ≥ 10

**Caption:**

```
Don't break the chain.
```

---

### 5. Focus timer — mid-session

**Screen:** `/focus` with timer running at ~17:34 remaining (25:00 session started)

**State:**
- Engine picker locked on "MIND"
- Today's stat reads "3 sessions · 1h 30m total"

**Caption:**

```
Deep work, measured.
```

---

### 6. Analytics — the trends

**Screen:** `/analytics`

**State:**
- This-week summary shows avg, best, worst day
- 4 engine sparklines visible
- Top-3 task reliability bars

**Caption:**

```
What's working, what's not.
```

---

### 7. Settings — the cloud-sync hero

**Screen:** `/(tabs)/profile` scrolled to the Account section

**State:**
- "Cloud sync active" status pill visible (green dot)
- Theme picker showing Black Metallic selected
- Push notification toggle ON

**Caption:**

```
Synced. Always.
```

---

### 8. Onboarding step 2 — engine intro (closer)

**Screen:** `/(onboarding)/step-2`

**State:** out-of-the-box (no per-user state)

**Caption:**

```
Four engines. One you.
```

---

## Capture method

### iOS

1. Real iPhone or iOS Simulator (Xcode → Hardware → Device → iPhone 15 Pro Max for 6.7").
2. Dev build via `npx expo run:ios --device` (real device gives crisper screenshots).
3. Cmd+S in Simulator saves to Desktop; or use the side button + volume up on a real device.

### Android

1. Real Android phone (Pixel 7+ or equivalent for clean shots) OR Android Studio emulator (Pixel 7 Pro for 1080×2400).
2. Dev build via `npx expo run:android`.
3. Volume down + power on a real device; emulator has a camera icon in the right-side bar.

### Frame overlays (optional)

iOS App Store traditionally shows screenshots in phone frames; Play Store accepts bare. Don't waste time on frames unless you have a designer eye — bare crisp screenshots convert just as well.

Tools if you want frames:
- **Screenshots.pro** (paid, web-based, fast)
- **Picsew** (iOS-native, free)
- **Rotato** (paid Mac, 3D phone frames)
- **Figma** with a phone-frame template (free if you have a Figma file already)

---

## Storage

Save into `mobile-saas/store-assets/screenshots/{ios,android}/01-dashboard.png` etc. **Don't commit to git** — these are heavy PNGs. Add the directory to `.gitignore` or store via Git LFS.

Sources:

```
mobile-saas/store-assets/screenshots/
├── ios/
│   ├── 01-dashboard.png    (1290×2796)
│   ├── 02-engine-body.png
│   ├── 03-tasks.png
│   ├── 04-habits.png
│   ├── 05-focus.png
│   ├── 06-analytics.png
│   ├── 07-settings.png
│   └── 08-onboarding.png
└── android/
    ├── 01-dashboard.png    (1080×2400)
    ├── ...same 8 shots...
    └── feature-graphic.png (1024×500)
```

---

## Feature graphic (Android only)

1024 × 500 PNG. This is the wide banner at the top of the Play Store listing. Required.

Spec:
- Black background (matches the app)
- App icon on the left at ~250px
- "Titan Protocol" wordmark + "Your personal OS for execution" tagline on the right
- The four engine accent colors as small dots beneath the tagline
- Match the dashboard's HUD aesthetic

If you have a designer, brief them. Otherwise: a simple Figma export works.
