import "react-native-url-polyfill/auto";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  useFonts,
  JetBrainsMono_400Regular,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from "@expo-google-fonts/jetbrains-mono";

import { queryClient } from "../src/lib/query-client";
import { useAuthStore } from "../src/stores/useAuthStore";
import { useOnboardingStore } from "../src/stores/useOnboardingStore";
import { runMigrations } from "../src/db/sqlite/migrator";
import { RealtimeProvider } from "../src/components/RealtimeProvider";
import { FirstRunPullGate } from "../src/components/FirstRunPullGate";
import { getProfile } from "../src/services/profile";
import { setupNotificationHandler } from "../src/lib/notifications";
import { logError } from "../src/lib/error-log";
import { colors } from "../src/theme";

/**
 * Root layout — fonts, auth bootstrap, query provider, and segment-based
 * routing between (auth) and (tabs). Returns null until fonts + auth
 * hydration finish so the user never sees a flash of the wrong tree.
 */
export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    JetBrainsMono_400Regular,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
  });

  const initialize = useAuthStore((s) => s.initialize);
  const isLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  const onboardingComplete = useOnboardingStore((s) => s.completed);

  const [dbReady, setDbReady] = useState(false);
  // True once the first-run pull has settled for the current user AND the
  // device-local onboarding flag has been hydrated from the synced
  // profile row. The onboarding redirect below must wait for this: the
  // MMKV flag alone is blind to accounts that onboarded on another
  // device, and routing them into onboarding used to overwrite their
  // cloud profile with defaults.
  const [profileSynced, setProfileSynced] = useState(false);
  const userId = user?.id ?? null;

  const segments = useSegments();
  const router = useRouter();

  // Re-arm the hydration latch whenever the signed-in account changes.
  useEffect(() => {
    setProfileSynced(false);
  }, [userId]);

  const hydrateOnboardingFromProfile = useCallback(async () => {
    try {
      const profile = await getProfile();
      if (profile?.onboarding_completed) {
        // Account already onboarded (here or on another device) — adopt
        // it locally so the redirect below goes straight to the tabs.
        useOnboardingStore.getState().finish();
      }
    } catch (e) {
      logError("rootLayout.hydrateOnboarding", e);
    } finally {
      setProfileSynced(true);
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    runMigrations()
      .then(() => setDbReady(true))
      .catch((err) => {
        logError("rootLayout.runMigrations", err);
      });
  }, []);

  // Wire the notification-tap handler so a tap on a local notif lands the
  // user on the right screen. Permission requests happen later (after
  // first task create) — this only registers the listener.
  useEffect(() => {
    const subscription = setupNotificationHandler((route) => {
      router.push(route as never);
    });
    return () => {
      subscription.remove();
    };
  }, [router]);

  useEffect(() => {
    if (!fontsLoaded || isLoading || !dbReady) return;
    const inAuthGroup = segments[0] === "(auth)";
    const inOnboardingGroup = segments[0] === "(onboarding)";

    if (!user) {
      if (!inAuthGroup) router.replace("/(auth)/login");
      return;
    }

    // Authenticated. Hold all onboarding/tab routing until the first-run
    // pull + profile hydration settle (the FirstRunPullGate splash is
    // showing meanwhile) — the synced profile row, not the device flag,
    // decides whether this account still needs onboarding.
    if (!profileSynced) return;

    if (!onboardingComplete && !inOnboardingGroup) {
      router.replace("/(onboarding)/step-1");
      return;
    }

    if (onboardingComplete && (inAuthGroup || inOnboardingGroup)) {
      router.replace("/(tabs)");
    }
  }, [
    fontsLoaded,
    isLoading,
    dbReady,
    user,
    profileSynced,
    onboardingComplete,
    segments,
    router,
  ]);

  if (!fontsLoaded || isLoading || !dbReady) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  const stack = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <RealtimeProvider>
            {/* The pull gate sits ABOVE the route tree so a fresh device
                restores its cloud snapshot before ANY authenticated
                screen — including onboarding — can render or write. It
                previously lived inside (tabs), which let onboarding run
                against an empty cache and push a defaulted profile over
                the user's real one. */}
            {user ? (
              <FirstRunPullGate
                userId={user.id}
                onReady={hydrateOnboardingFromProfile}
              >
                {stack}
              </FirstRunPullGate>
            ) : (
              stack
            )}
          </RealtimeProvider>
          <StatusBar style="light" />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
