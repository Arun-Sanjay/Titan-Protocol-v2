import { Tabs } from "expo-router";

// ---------------------------------------------------------------------------
// Tab Layout — tab bar hidden, navigation via dashboard buttons
// ---------------------------------------------------------------------------

export default function TabLayout() {
  return (
    <Tabs
      tabBar={() => null}
      screenOptions={{
        headerShown: false,
        animation: "fade",
        freezeOnBlur: true,
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="engines" />
      <Tabs.Screen name="track" />
      <Tabs.Screen name="hub" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
