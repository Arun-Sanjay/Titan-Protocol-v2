import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet } from "react-native";
import * as SystemUI from "expo-system-ui";
import { colors } from "../src/theme";
import { SystemNotificationProvider } from "../src/components/ui/SystemNotification";
import { MotivationalSplash } from "../src/components/ui/MotivationalSplash";
import { CinematicOnboarding } from "../src/components/v2/onboarding/CinematicOnboarding";
import { useOnboardingStore } from "../src/stores/useOnboardingStore";
import { useWalkthroughStore } from "../src/stores/useWalkthroughStore";
import {
  FirstLaunchCinematic,
  isFirstLaunchSeen,
} from "../src/components/v2/story/FirstLaunchCinematic";
import {
  DailyBriefing,
  isBriefingSeenToday,
  markBriefingSeen,
} from "../src/components/v2/story/DailyBriefing";
import { Day2Cinematic } from "../src/components/v2/story/Day2Cinematic";
import { Day3Cinematic } from "../src/components/v2/story/Day3Cinematic";
import { Day4Cinematic } from "../src/components/v2/story/Day4Cinematic";
import { Day5Cinematic } from "../src/components/v2/story/Day5Cinematic";
import { Day6Cinematic } from "../src/components/v2/story/Day6Cinematic";
import { Day7Cinematic } from "../src/components/v2/story/Day7Cinematic";
import { Day8Cinematic } from "../src/components/v2/story/Day8Cinematic";
import { Day9Cinematic } from "../src/components/v2/story/Day9Cinematic";
import { Day10Cinematic } from "../src/components/v2/story/Day10Cinematic";
import { Day11Cinematic } from "../src/components/v2/story/Day11Cinematic";
import { Day12Cinematic } from "../src/components/v2/story/Day12Cinematic";
import { Day13Cinematic } from "../src/components/v2/story/Day13Cinematic";
import { Day14Cinematic } from "../src/components/v2/story/Day14Cinematic";
import { Day30Cinematic } from "../src/components/v2/story/Day30Cinematic";
import { Day45Cinematic } from "../src/components/v2/story/Day45Cinematic";
import { Day60Cinematic } from "../src/components/v2/story/Day60Cinematic";
import { Day90Cinematic } from "../src/components/v2/story/Day90Cinematic";
import { Day365Cinematic } from "../src/components/v2/story/Day365Cinematic";
import { getStoryForDay, addEntry } from "../src/lib/narrative-engine";
import { useIdentityStore } from "../src/stores/useIdentityStore";
import { useStoryStore } from "../src/stores/useStoryStore";
import { useProtocolStore } from "../src/stores/useProtocolStore";
import { getJSON, setJSON } from "../src/db/storage";
import { getDayNumber } from "../src/data/chapters";
import { getTodayKey } from "../src/lib/date";
import { AchievementToast } from "../src/components/ui/AchievementToast";
import { SystemWindowProvider } from "../src/components/ui/SystemWindowProvider";
import { RootErrorBoundary } from "../src/components/ui/RootErrorBoundary";
import { LevelUpOverlay } from "../src/components/ui/LevelUpOverlay";
import { useProfileStore } from "../src/stores/useProfileStore";
import { SurpriseOverlay } from "../src/components/v2/story/SurpriseOverlay";
import { StreakBreakCinematic } from "../src/components/v2/story/StreakBreakCinematic";
import { BossDefeatCinematic } from "../src/components/v2/story/BossDefeatCinematic";
import { BossFailCinematic } from "../src/components/v2/story/BossFailCinematic";
import { useQuestStore, type BossChallenge } from "../src/stores/useQuestStore";
import { ComebackCinematic } from "../src/components/v2/story/ComebackCinematic";
import { IntegrityWarningOverlay } from "../src/components/v2/story/IntegrityWarningOverlay";
import { useSurpriseStore } from "../src/stores/useSurpriseStore";
import { calculateConsistency } from "../src/lib/operation-engine";
import { checkIntegrityStatus, loadIntegrity, type IntegrityStatus } from "../src/lib/protocol-integrity";
import type { TransmissionContext } from "../src/lib/transmissions";

import "../src/db/database";

// Map day numbers to cinematic components
const DAY_CINEMATICS: Record<number, React.ComponentType<{ onComplete: () => void }>> = {
  2: Day2Cinematic,
  3: Day3Cinematic,
  4: Day4Cinematic,
  5: Day5Cinematic,
  6: Day6Cinematic,
  7: Day7Cinematic,
  8: Day8Cinematic,
  9: Day9Cinematic,
  10: Day10Cinematic,
  11: Day11Cinematic,
  12: Day12Cinematic,
  13: Day13Cinematic,
  14: Day14Cinematic,
  30: Day30Cinematic,
  45: Day45Cinematic,
  60: Day60Cinematic,
  90: Day90Cinematic,
  365: Day365Cinematic,
};

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const [showCinematic, setShowCinematic] = useState(false);
  const [showDayCinematic, setShowDayCinematic] = useState<number | null>(null);
  const [showBriefing, setShowBriefing] = useState(false);
  // Integrity overlays
  const [showStreakBreak, setShowStreakBreak] = useState<{
    status: "BREACH" | "RESET";
    oldStreak: number;
    newStreak: number;
    missedDays: number;
  } | null>(null);
  const [showComeback, setShowComeback] = useState<{
    preBreakStreak: number;
    currentStreak: number;
    restoredStreak: number;
  } | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [integrityChecked, setIntegrityChecked] = useState(false);
  // Boss cinematics
  const [showBossDefeat, setShowBossDefeat] = useState<{
    title: string;
    daysRequired: number;
    dayResults: boolean[];
    xpReward: number;
  } | null>(null);
  const [showBossFail, setShowBossFail] = useState<{
    title: string;
    dayNumber: number;
    dayResults: boolean[];
  } | null>(null);

  const onboardingCompleted = useOnboardingStore((s) => s.completed);
  const walkthroughCompleted = useWalkthroughStore((s) => s.completed);
  const archetype = useIdentityStore((s) => s.archetype);
  const getCinematicForDay = useStoryStore((s) => s.getCinematicForDay);
  const storyFlags = useStoryStore((s) => s.storyFlags);
  const userName = useStoryStore((s) => s.userName);
  const streakCurrent = useProtocolStore((s) => s.streakCurrent);

  // Phase 2.1E: Rank-up queue — head of queue is the currently-showing
  // rank-up. On dismiss we dequeue. Subscribing to just the head means
  // the layout only re-renders when the queue transitions empty<->non-empty
  // or when a new rank-up becomes the head.
  const pendingRankUp = useProfileStore((s) => s.pendingRankUps[0]);
  const dequeueRankUp = useProfileStore((s) => s.dequeueRankUp);

  // Build context for transmission splash
  const transmissionCtx: TransmissionContext = {
    name: userName || undefined,
    dayNumber: getDayNumber(getJSON<string | null>("first_active_date", null)),
    streak: streakCurrent,
  };

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg);
  }, []);

  // After splash dismissal, determine what to show
  useEffect(() => {
    if (!showSplash && onboardingCompleted && walkthroughCompleted) {
      // ─── Step 1: Integrity check (runs BEFORE cinematics/briefing) ───
      const integrityCheckKey = `integrity_cinematic_${getTodayKey()}`;
      const alreadyShownToday = getJSON<boolean>(integrityCheckKey, false);

      if (!alreadyShownToday && isFirstLaunchSeen()) {
        const integrity = checkIntegrityStatus();
        const integrityState = loadIntegrity();

        if (integrity.status === "BREACH" || integrity.status === "RESET") {
          const oldStreak = integrityState.streak;
          const newStreak = integrity.status === "BREACH"
            ? Math.max(1, Math.floor(oldStreak * 0.5))
            : 0;
          setShowStreakBreak({
            status: integrity.status,
            oldStreak,
            newStreak,
            missedDays: integrity.missedDays,
          });
          setIntegrityChecked(true);
          return; // Block everything else until acknowledged
        }

        if (integrity.status === "WARNING") {
          setShowWarning(true);
          // Don't return — warning is non-blocking, continues to normal flow
        }

        // Check for comeback: user in RECOVERING state and just hit 3 recovery days
        if (integrityState.status === "RECOVERING" && integrityState.recoveryDays >= 3) {
          const comebackShownKey = `comeback_shown_${getTodayKey()}`;
          if (!getJSON<boolean>(comebackShownKey, false)) {
            setShowComeback({
              preBreakStreak: integrityState.preBreakStreak,
              currentStreak: integrityState.streak,
              restoredStreak: Math.floor(integrityState.preBreakStreak * 0.75),
            });
            setIntegrityChecked(true);
            return; // Block until acknowledged
          }
        }
      }

      setIntegrityChecked(true);

      // ─── Step 1b: Boss defeat/fail check ─────────────────────────────
      const bossState = useQuestStore.getState().bossChallenge;
      const bossShownKey = `boss_cinematic_${getTodayKey()}`;
      if (bossState && !getJSON<boolean>(bossShownKey, false)) {
        if (bossState.completed) {
          setShowBossDefeat({
            title: bossState.title,
            daysRequired: bossState.daysRequired,
            dayResults: bossState.dayResults,
            xpReward: bossState.xpReward,
          });
          setJSON(bossShownKey, true);
          return; // Block until claimed
        }
        if (bossState.failed) {
          setShowBossFail({
            title: bossState.title,
            dayNumber: bossState.dayResults.length,
            dayResults: bossState.dayResults,
          });
          setJSON(bossShownKey, true);
          // Don't return — fail cinematic leads to normal flow after
        }
      }

      // ─── Step 2: Normal cinematic/briefing flow ──────────────────────
      if (!isFirstLaunchSeen()) {
        // Day 1 cinematic
        setShowCinematic(true);
      } else {
        // Check if there's a day-specific cinematic to show
        const firstActiveDate = getJSON<string | null>("first_active_date", null);
        const dayNum = getDayNumber(firstActiveDate);

        // Check for Day 2-7 (and future day cinematics)
        const cinematicKey = getCinematicForDay(dayNum);
        if (cinematicKey && DAY_CINEMATICS[dayNum]) {
          setShowDayCinematic(dayNum);
        } else if (!isBriefingSeenToday()) {
          // No cinematic for today — show daily briefing
          const story = getStoryForDay(archetype, dayNum);
          if (story) {
            addEntry({ date: getTodayKey(), text: story.text, type: "story" });
          }
          setShowBriefing(true);
        }
      }
    }
  }, [showSplash, onboardingCompleted, walkthroughCompleted, archetype, storyFlags]);

  const handleCinematicComplete = () => {
    setShowCinematic(false);
    // After Day 1 cinematic, show daily briefing if needed
    if (!isBriefingSeenToday()) {
      setShowBriefing(true);
    } else {
      triggerSurpriseCheck();
    }
  };

  const handleDayCinematicComplete = () => {
    setShowDayCinematic(null);
    // Day cinematics already show the OperationBriefing with tasks,
    // so mark briefing as seen to prevent showing it again
    markBriefingSeen();
    // Add story entry for today if available
    const firstActiveDate = getJSON<string | null>("first_active_date", null);
    const dayNum = getDayNumber(firstActiveDate);
    const story = getStoryForDay(archetype, dayNum);
    if (story) {
      addEntry({ date: getTodayKey(), text: story.text, type: "story" });
    }
    triggerSurpriseCheck();
  };

  // ─── Integrity cinematic handlers ────────────────────────────────────────
  const handleStreakBreakContinue = () => {
    // Mark as shown today so it doesn't repeat
    setJSON(`integrity_cinematic_${getTodayKey()}`, true);
    setShowStreakBreak(null);

    // Now proceed to normal cinematic/briefing flow
    const firstActiveDate = getJSON<string | null>("first_active_date", null);
    const dayNum = getDayNumber(firstActiveDate);
    const cinematicKey = getCinematicForDay(dayNum);
    if (cinematicKey && DAY_CINEMATICS[dayNum]) {
      setShowDayCinematic(dayNum);
    } else if (!isBriefingSeenToday()) {
      const story = getStoryForDay(archetype, dayNum);
      if (story) {
        addEntry({ date: getTodayKey(), text: story.text, type: "story" });
      }
      setShowBriefing(true);
    }
  };

  const handleComebackContinue = () => {
    setJSON(`comeback_shown_${getTodayKey()}`, true);
    setShowComeback(null);

    // Proceed to normal flow
    const firstActiveDate = getJSON<string | null>("first_active_date", null);
    const dayNum = getDayNumber(firstActiveDate);
    const cinematicKey = getCinematicForDay(dayNum);
    if (cinematicKey && DAY_CINEMATICS[dayNum]) {
      setShowDayCinematic(dayNum);
    } else if (!isBriefingSeenToday()) {
      const story = getStoryForDay(archetype, dayNum);
      if (story) {
        addEntry({ date: getTodayKey(), text: story.text, type: "story" });
      }
      setShowBriefing(true);
    }
  };

  const handleWarningDismiss = () => {
    setShowWarning(false);
  };

  const handleBossDefeatClaim = () => {
    setShowBossDefeat(null);
    // Proceed to normal flow
    const firstActiveDate = getJSON<string | null>("first_active_date", null);
    const dayNum = getDayNumber(firstActiveDate);
    if (!isBriefingSeenToday()) {
      const story = getStoryForDay(archetype, dayNum);
      if (story) {
        addEntry({ date: getTodayKey(), text: story.text, type: "story" });
      }
      setShowBriefing(true);
    }
  };

  const handleBossFailContinue = () => {
    setShowBossFail(null);
  };

  // ─── Surprise system ────────────────────────────────────────────────────
  const activeSurprise = useSurpriseStore((s) => s.activeSurprise);
  const checkSurprise = useSurpriseStore((s) => s.check);
  const acceptSurprise = useSurpriseStore((s) => s.accept);
  const dismissSurprise = useSurpriseStore((s) => s.dismiss);

  const triggerSurpriseCheck = () => {
    // Check for surprise after all overlays are dismissed
    const consistency = calculateConsistency();
    checkSurprise(streakCurrent, consistency.rate);
  };

  const handleBriefingEnter = () => {
    setShowBriefing(false);
    // After briefing closes, check for surprise
    triggerSurpriseCheck();
  };

  // Resolve the day cinematic component
  const DayCinematicComponent = showDayCinematic ? DAY_CINEMATICS[showDayCinematic] : null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <RootErrorBoundary>
      <SystemWindowProvider>
      <SystemNotificationProvider>
      <StatusBar style="light" backgroundColor={colors.bg} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ animation: "none" }} />
        <Stack.Screen
          name="(modals)/add-task"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="protocol"
          options={{
            presentation: "fullScreenModal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="skill-tree/[engine]"
          options={{ animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="status"
          options={{ animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="field-ops"
          options={{ animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="titles"
          options={{ animation: "slide_from_right" }}
        />
      </Stack>

      {/*
        Phase 2.1F — Overlay priority (bottom of list = highest z-index).
        When adding a new overlay, slot it into the priority order below.
        Full orchestrator extraction is deferred to Phase 2.3; for now
        render order enforces priority.

        Priority order (lowest → highest):
          1. AchievementToast (non-blocking, always mounted, toasts auto-dismiss)
          2. MotivationalSplash (app-open splash)
          3. CinematicOnboarding (new users only)
          4. Rank-up overlay (can fire any time, lower priority than story beats)
          5. Boss cinematics (victory/defeat, significant moments)
          6. Daily story cinematics (Day-N, first launch, daily briefing)
          7. Surprise overlay
          8. Comeback cinematic (streak recovery)
          9. Streak break cinematic
          10. Integrity warning (highest — always visible on top)
      */}
      <AchievementToast />
      {showSplash && <MotivationalSplash onDismiss={() => setShowSplash(false)} context={transmissionCtx} />}
      {!showSplash && !onboardingCompleted && (
        <CinematicOnboarding onComplete={() => {
          useOnboardingStore.getState().finish();
        }} />
      )}
      {/* Phase 2.1E: Rank-up. Subscribes to persistent queue in useProfileStore
          so it fires regardless of which screen the user was on when they
          crossed a level boundary. Dismiss -> dequeue -> next (if any). */}
      {pendingRankUp && (
        <LevelUpOverlay
          key={pendingRankUp.id}
          newLevel={pendingRankUp.to}
          onDismiss={dequeueRankUp}
        />
      )}
      {/* Boss cinematics */}
      {showBossDefeat && (
        <BossDefeatCinematic
          bossTitle={showBossDefeat.title}
          daysRequired={showBossDefeat.daysRequired}
          dayResults={showBossDefeat.dayResults}
          xpReward={showBossDefeat.xpReward}
          onClaim={handleBossDefeatClaim}
        />
      )}
      {showBossFail && (
        <BossFailCinematic
          bossTitle={showBossFail.title}
          dayNumber={showBossFail.dayNumber}
          dayResults={showBossFail.dayResults}
          onContinue={handleBossFailContinue}
        />
      )}
      {/* Story cinematics */}
      {showCinematic && <FirstLaunchCinematic onComplete={handleCinematicComplete} />}
      {DayCinematicComponent && <DayCinematicComponent onComplete={handleDayCinematicComplete} />}
      {showBriefing && <DailyBriefing onEnter={handleBriefingEnter} />}
      {activeSurprise && (
        <SurpriseOverlay
          surprise={activeSurprise}
          onAccept={acceptSurprise}
          onDismiss={dismissSurprise}
        />
      )}
      {/* Integrity overlays — highest priority, render on top of everything */}
      {showComeback && (
        <ComebackCinematic
          preBreakStreak={showComeback.preBreakStreak}
          currentStreak={showComeback.currentStreak}
          restoredStreak={showComeback.restoredStreak}
          onContinue={handleComebackContinue}
        />
      )}
      {showStreakBreak && (
        <StreakBreakCinematic
          status={showStreakBreak.status}
          oldStreak={showStreakBreak.oldStreak}
          newStreak={showStreakBreak.newStreak}
          missedDays={showStreakBreak.missedDays}
          onContinue={handleStreakBreakContinue}
        />
      )}
      {showWarning && <IntegrityWarningOverlay onDismiss={handleWarningDismiss} />}
      </SystemNotificationProvider>
      </SystemWindowProvider>
      </RootErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
