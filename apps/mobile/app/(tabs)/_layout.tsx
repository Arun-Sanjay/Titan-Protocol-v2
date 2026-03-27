import { Tabs } from "expo-router";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
} from "react-native-reanimated";
import { useEffect } from "react";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type TabDef = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
  label: string;
};

const TABS: TabDef[] = [
  { key: "index", icon: "home-outline", iconFocused: "home", label: "HQ" },
  { key: "engines", icon: "flash-outline", iconFocused: "flash", label: "Engines" },
  { key: "track", icon: "checkbox-outline", iconFocused: "checkbox", label: "Track" },
  { key: "hub", icon: "grid-outline", iconFocused: "grid", label: "Hub" },
  { key: "profile", icon: "person-outline", iconFocused: "person", label: "Profile" },
];

const TAB_BAR_HEIGHT = 64;
const INDICATOR_WIDTH = 24;
const INDICATOR_HEIGHT = 2;

// ---------------------------------------------------------------------------
// AnimatedTabIcon — icon with scale + glow bar + label opacity transitions
// ---------------------------------------------------------------------------

type AnimatedTabIconProps = {
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
  label: string;
  focused: boolean;
};

function AnimatedTabIcon({ icon, iconFocused, label, focused }: AnimatedTabIconProps) {
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(focused ? 1 : 0, {
      damping: 18,
      stiffness: 180,
      mass: 0.8,
    });
  }, [focused, progress]);

  // Glow indicator bar — fades + scales in
  const indicatorStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(progress.value, [0, 1], [0, 1]),
      transform: [
        { scaleX: interpolate(progress.value, [0, 1], [0.3, 1]) },
      ],
    };
  });

  // Icon scale: 1.0 → 1.1
  const iconContainerStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: interpolate(progress.value, [0, 1], [1.0, 1.1]) },
      ],
    };
  });

  // Label opacity: dim → bright
  const labelStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(progress.value, [0, 1], [0.42, 0.92]),
    };
  });

  return (
    <View style={styles.tabItem}>
      {/* Active glow indicator bar */}
      <Animated.View style={[styles.indicator, indicatorStyle]} />

      {/* Icon */}
      <Animated.View style={iconContainerStyle}>
        <Ionicons
          name={focused ? iconFocused : icon}
          size={21}
          color={focused ? "rgba(245, 248, 255, 0.92)" : "rgba(210, 220, 242, 0.42)"}
        />
      </Animated.View>

      {/* Label */}
      <Animated.View style={labelStyle}>
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            {
              color: focused
                ? "rgba(245, 248, 255, 0.92)"
                : "rgba(210, 220, 242, 0.42)",
            },
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Custom Tab Bar
// ---------------------------------------------------------------------------

function TitanTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.tabBar,
        {
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
        },
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

        const onLongPress = () => {
          navigation.emit({
            type: "tabLongPress",
            target: route.key,
          });
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? tab.label}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tabPressable}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <AnimatedTabIcon
              icon={tab.icon}
              iconFocused={tab.iconFocused}
              label={tab.label}
              focused={focused}
            />
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
  return (
    <Tabs
      tabBar={(props) => <TitanTabBar {...props} />}
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
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#050607",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    paddingTop: 6,
    // Subtle top glow
    shadowColor: "rgba(255, 255, 255, 0.06)",
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
    width: INDICATOR_WIDTH,
    height: INDICATOR_HEIGHT,
    borderRadius: INDICATOR_HEIGHT / 2,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    marginBottom: 4,
    // Glow effect
    shadowColor: "rgba(242, 247, 255, 0.9)",
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
