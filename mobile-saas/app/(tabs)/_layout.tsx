import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../src/theme";
import { useAuthStore } from "../../src/stores/useAuthStore";
import { CelebrationProvider } from "../../src/components/CelebrationProvider";
import { StreakSettlementGate } from "../../src/components/StreakSettlementGate";
import { RankUpWatcher } from "../../src/components/RankUpWatcher";
import { AccessGate } from "../../src/components/AccessGate";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

function TabIcon({ name, color }: { name: IoniconName; color: string }) {
  return <Ionicons name={name} size={20} color={color} />;
}

export default function TabsLayout() {
  const userId = useAuthStore((s) => s.user?.id);
  // Defensive: the root layout already redirects unauthenticated users
  // to /(auth)/login. If we somehow render without a userId, render
  // nothing instead of crashing FirstRunPullGate.
  if (!userId) return null;

  return (
    <CelebrationProvider>
      {/* Settle streaks once per open + watch the rank-up queue for the
          celebration. The FirstRunPullGate now lives in the ROOT layout
          (above onboarding), so SQLite is guaranteed populated before
          these mount. Mirrors web's OSLayout. */}
      <StreakSettlementGate />
      <RankUpWatcher />
      {/* Trial invite + paywall overlay across all tabs. Renders nothing
          while the user is Pro (trial active or subscribed). Mirrors web's
          AccessGate mounted in OSLayout. */}
      <AccessGate />
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: colors.tabBar,
              borderTopColor: colors.tabBarBorder,
              borderTopWidth: 1,
            },
            tabBarActiveTintColor: colors.text,
            tabBarInactiveTintColor: colors.textMuted,
            tabBarLabelStyle: {
              ...fonts.kicker,
              fontSize: 9,
              letterSpacing: 1.5,
              marginBottom: 2,
            },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: "HQ",
              tabBarIcon: ({ color }) => (
                <TabIcon name="grid-outline" color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="engines"
            options={{
              title: "ENGINES",
              tabBarIcon: ({ color }) => (
                <TabIcon name="cube-outline" color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="track"
            options={{
              title: "TRACK",
              tabBarIcon: ({ color }) => (
                <TabIcon name="pulse-outline" color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="hub"
            options={{
              title: "HUB",
              tabBarIcon: ({ color }) => (
                <TabIcon name="layers-outline" color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: "PROFILE",
              tabBarIcon: ({ color }) => (
                <TabIcon name="person-outline" color={color} />
              ),
            }}
          />
        </Tabs>
    </CelebrationProvider>
  );
}
