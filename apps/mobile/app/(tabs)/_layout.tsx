import { Tabs } from "expo-router";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

import { useModeStore, type AppMode } from "../../src/stores/useModeStore";
import { colors } from "../../src/theme";

// ---------------------------------------------------------------------------
// Tab definitions — game mode uses different icons/labels
// ---------------------------------------------------------------------------

type TabDef = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
  label: string;
  // Game mode overrides
  gameIcon?: keyof typeof Ionicons.glyphMap;
  gameIconFocused?: keyof typeof Ionicons.glyphMap;
  gameLabel?: string;
};

const TABS: TabDef[] = [
  {
    key: "index",
    icon: "home-outline", iconFocused: "home", label: "HQ",
    gameIcon: "game-controller-outline", gameIconFocused: "game-controller", gameLabel: "Command",
  },
  {
    key: "engines",
    icon: "flash-outline", iconFocused: "flash", label: "Engines",
    gameIcon: "flame-outline", gameIconFocused: "flame", gameLabel: "Engines",
  },
  {
    key: "track",
    icon: "checkbox-outline", iconFocused: "checkbox", label: "Track",
    gameIcon: "checkbox-outline", gameIconFocused: "checkbox", gameLabel: "Track",
  },
  {
    key: "hub",
    icon: "grid-outline", iconFocused: "grid", label: "Hub",
    gameIcon: "apps-outline", gameIconFocused: "apps", gameLabel: "Hub",
  },
  {
    key: "profile",
    icon: "person-outline", iconFocused: "person", label: "Profile",
    gameIcon: "shield-outline", gameIconFocused: "shield", gameLabel: "Profile",
  },
];

const TAB_BAR_HEIGHT = 56;

// ---------------------------------------------------------------------------
// Game modes that use the command bar style
// ---------------------------------------------------------------------------

const GAME_MODES: Set<AppMode> = new Set([
  "full_protocol",
  "structured",
  "titan",
]);

// ---------------------------------------------------------------------------
// Command Bar (Game Mode) — slim, dark, glow dot
// ---------------------------------------------------------------------------

function CommandBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        cmdStyles.bar,
        { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
      ]}
    >
      {state.routes.map((route, index) => {
        const tab = TABS.find((t) => t.key === route.name);
        if (!tab) return null;

        const focused = state.index === index;
        const { options } = descriptors[route.key];

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={cmdStyles.item}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? tab.gameLabel ?? tab.label}
            hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
          >
            {/* Glow dot above active icon */}
            <View style={[cmdStyles.glowDot, focused && cmdStyles.glowDotActive]} />

            <Ionicons
              name={focused ? (tab.gameIconFocused ?? tab.iconFocused) : (tab.gameIcon ?? tab.icon)}
              size={22}
              color={focused ? "#FFFFFF" : "rgba(255,255,255,0.35)"}
            />

            <Text
              style={[
                cmdStyles.label,
                { color: focused ? "#FFFFFF" : "rgba(255,255,255,0.35)" },
              ]}
              numberOfLines={1}
            >
              {tab.gameLabel ?? tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const cmdStyles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: "#050607",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingTop: 4,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  glowDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: "transparent",
    marginBottom: 2,
  },
  glowDotActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  label: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});

// ---------------------------------------------------------------------------
// Standard Tab Bar (Tracker / Zen modes)
// ---------------------------------------------------------------------------

function TitanTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.tabBar,
        { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
      ]}
    >
      {state.routes.map((route, index) => {
        const tab = TABS.find((t) => t.key === route.name);
        if (!tab) return null;

        const { options } = descriptors[route.key];
        const focused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? tab.label}
            onPress={onPress}
            style={styles.tabPressable}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <View style={styles.tabItem}>
              {focused && <View style={styles.indicator} />}
              <Ionicons
                name={focused ? tab.iconFocused : tab.icon}
                size={21}
                color={focused ? "rgba(245,248,255,0.92)" : "rgba(210,220,242,0.42)"}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  { color: focused ? "rgba(245,248,255,0.92)" : "rgba(210,220,242,0.42)" },
                ]}
              >
                {tab.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tab Layout
// ---------------------------------------------------------------------------

export default function TabLayout() {
  const mode = useModeStore((s) => s.mode);
  const isGameMode = GAME_MODES.has(mode);

  return (
    <Tabs
      tabBar={(props) => (isGameMode ? <CommandBar {...props} /> : <TitanTabBar {...props} />)}
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

// ---------------------------------------------------------------------------
// Standard Tab Bar Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#050607",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 6,
    shadowColor: "rgba(255,255,255,0.06)",
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 0,
  },
  tabPressable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 2,
  },
  indicator: {
    width: 24, height: 2, borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.8)",
    marginBottom: 4,
    shadowColor: "rgba(242,247,255,0.9)",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
  },
  label: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
});
