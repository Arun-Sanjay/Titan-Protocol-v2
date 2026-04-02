import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet } from "react-native";
import * as SystemUI from "expo-system-ui";
import { colors } from "../src/theme";
import { SystemNotificationProvider } from "../src/components/ui/SystemNotification";
import { MotivationalSplash } from "../src/components/ui/MotivationalSplash";
import { OnboardingShell } from "../src/components/v2/onboarding/OnboardingShell";
import { useOnboardingStore } from "../src/stores/useOnboardingStore";
import { useWalkthroughStore } from "../src/stores/useWalkthroughStore";
import {
  FirstLaunchCinematic,
  isFirstLaunchSeen,
} from "../src/components/v2/story/FirstLaunchCinematic";
import {
  DailyBriefing,
  isBriefingSeenToday,
} from "../src/components/v2/story/DailyBriefing";
import { Day2Cinematic } from "../src/components/v2/story/Day2Cinematic";
import { Day3Cinematic } from "../src/components/v2/story/Day3Cinematic";
import { Day4Cinematic } from "../src/components/v2/story/Day4Cinematic";
import { Day5Cinematic } from "../src/components/v2/story/Day5Cinematic";
import { Day6Cinematic } from "../src/components/v2/story/Day6Cinematic";
import { Day7Cinematic } from "../src/components/v2/story/Day7Cinematic";
import { Day14Cinematic } from "../src/components/v2/story/Day14Cinematic";
import { Day30Cinematic } from "../src/components/v2/story/Day30Cinematic";
import { Day45Cinematic } from "../src/components/v2/story/Day45Cinematic";
import { Day60Cinematic } from "../src/components/v2/story/Day60Cinematic";
import { Day90Cinematic } from "../src/components/v2/story/Day90Cinematic";
import { Day365Cinematic } from "../src/components/v2/story/Day365Cinematic";
import { getStoryForDay, addEntry } from "../src/lib/narrative-engine";
import { useIdentityStore } from "../src/stores/useIdentityStore";
import { useStoryStore } from "../src/stores/useStoryStore";
import { getJSON } from "../src/db/storage";
import { getDayNumber } from "../src/data/chapters";
import { getTodayKey } from "../src/lib/date";

import "../src/db/database";

// Map day numbers to cinematic components
const DAY_CINEMATICS: Record<number, React.ComponentType<{ onComplete: () => void }>> = {
  2: Day2Cinematic,
  3: Day3Cinematic,
  4: Day4Cinematic,
  5: Day5Cinematic,
  6: Day6Cinematic,
  7: Day7Cinematic,
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
  const onboardingCompleted = useOnboardingStore((s) => s.completed);
  const walkthroughCompleted = useWalkthroughStore((s) => s.completed);
  const archetype = useIdentityStore((s) => s.archetype);
  const getCinematicForDay = useStoryStore((s) => s.getCinematicForDay);
  const storyFlags = useStoryStore((s) => s.storyFlags);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg);
  }, []);

  // After splash dismissal, determine what to show
  useEffect(() => {
    if (!showSplash && onboardingCompleted && walkthroughCompleted) {
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
    }
  };

  const handleDayCinematicComplete = () => {
    setShowDayCinematic(null);
    // After day cinematic, show briefing
    if (!isBriefingSeenToday()) {
      const firstActiveDate = getJSON<string | null>("first_active_date", null);
      const dayNum = getDayNumber(firstActiveDate);
      const story = getStoryForDay(archetype, dayNum);
      if (story) {
        addEntry({ date: getTodayKey(), text: story.text, type: "story" });
      }
      setShowBriefing(true);
    }
  };

  const handleBriefingEnter = () => {
    setShowBriefing(false);
  };

  // Resolve the day cinematic component
  const DayCinematicComponent = showDayCinematic ? DAY_CINEMATICS[showDayCinematic] : null;

  return (
    <GestureHandlerRootView style={styles.root}>
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
          options={{
            animation: "slide_from_right",
          }}
        />
      </Stack>

      {/* Overlays — order matters (last = on top) */}
      {showSplash && <MotivationalSplash onDismiss={() => setShowSplash(false)} />}
      {!showSplash && !onboardingCompleted && <OnboardingShell />}
      {showCinematic && <FirstLaunchCinematic onComplete={handleCinematicComplete} />}
      {DayCinematicComponent && <DayCinematicComponent onComplete={handleDayCinematicComplete} />}
      {showBriefing && <DailyBriefing onEnter={handleBriefingEnter} />}
      </SystemNotificationProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
