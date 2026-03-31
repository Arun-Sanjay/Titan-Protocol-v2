import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet } from "react-native";
import * as SystemUI from "expo-system-ui";
import { colors } from "../src/theme";
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

import "../src/db/database";

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const [showCinematic, setShowCinematic] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const onboardingCompleted = useOnboardingStore((s) => s.completed);
  const walkthroughCompleted = useWalkthroughStore((s) => s.completed);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg);
  }, []);

  // After splash dismissal, determine what to show
  useEffect(() => {
    if (!showSplash && onboardingCompleted && walkthroughCompleted) {
      if (!isFirstLaunchSeen()) {
        setShowCinematic(true);
      } else if (!isBriefingSeenToday()) {
        setShowBriefing(true);
      }
    }
  }, [showSplash, onboardingCompleted, walkthroughCompleted]);

  const handleCinematicComplete = () => {
    setShowCinematic(false);
    // After cinematic, show the daily briefing
    if (!isBriefingSeenToday()) {
      setShowBriefing(true);
    }
  };

  const handleBriefingEnter = () => {
    setShowBriefing(false);
  };

  return (
    <GestureHandlerRootView style={styles.root}>
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
      {showBriefing && <DailyBriefing onEnter={handleBriefingEnter} />}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
