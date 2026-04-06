import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  interpolate,
  SharedValue,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useModeStore, type AppMode } from "../../stores/useModeStore";
import {
  useEngineStore,
  selectTotalScore,
} from "../../stores/useEngineStore";
import {
  useIdentityStore,
  IDENTITIES,
} from "../../stores/useIdentityStore";
import { colors } from "../../theme/colors";
import { getTodayKey } from "../../lib/date";

// ---------------------------------------------------------------------------
// Menu items
// ---------------------------------------------------------------------------

type MenuItem = {
  label: string;
  icon: string;
  route: string;
};

const MENU_ITEMS: MenuItem[] = [
  { label: "Command", icon: "\uD83C\uDFAE", route: "/(tabs)" },
  { label: "War Room", icon: "\u2694\uFE0F", route: "/war-room" },
  { label: "Engines", icon: "\uD83D\uDD25", route: "/(tabs)/engines" },
  { label: "Skills", icon: "\uD83C\uDF33", route: "/skill-tree" },
  { label: "Profile", icon: "\uD83D\uDC64", route: "/(tabs)/profile" },
];

const BUTTON_SIZE = 56;
const ITEM_SIZE = 44;
const RADIUS = 100;

const SPRING_CONFIG = { damping: 15, stiffness: 150 };

// Modes that show the radial menu (game modes)
const GAME_MODES: Set<AppMode> = new Set([
  "full_protocol",
  "structured",
  "titan",
]);

// ---------------------------------------------------------------------------
// Radial menu item
// ---------------------------------------------------------------------------

type RadialItemProps = {
  item: MenuItem;
  index: number;
  total: number;
  isOpen: SharedValue<number>;
  onPress: (route: string) => void;
};

function RadialItem({ item, index, total, isOpen, onPress }: RadialItemProps) {
  const angle = (Math.PI / (total - 1)) * index + Math.PI;

  const animStyle = useAnimatedStyle(() => {
    const x = Math.cos(angle) * RADIUS * isOpen.value;
    const y = Math.sin(angle) * RADIUS * isOpen.value;
    const scale = interpolate(isOpen.value, [0, 0.5, 1], [0, 0.3, 1]);
    const opacity = interpolate(isOpen.value, [0, 0.4, 1], [0, 0, 1]);

    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { scale },
      ],
      opacity,
    };
  });

  return (
    <Animated.View style={[styles.menuItemContainer, animStyle]}>
      <Pressable
        style={styles.menuItemButton}
        onPress={() => onPress(item.route)}
        hitSlop={8}
      >
        <Text style={styles.menuItemIcon}>{item.icon}</Text>
      </Pressable>
      <Animated.Text style={styles.menuItemLabel}>{item.label}</Animated.Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Radial Menu
// ---------------------------------------------------------------------------

export default function RadialMenu() {
  const mode = useModeStore((s) => s.mode);
  const scores = useEngineStore((s) => s.scores);
  const archetype = useIdentityStore((s) => s.archetype);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const isOpen = useSharedValue(0);
  const [menuVisible, setMenuVisible] = useState(false);
  const dateKey = getTodayKey();
  const totalScore = useMemo(
    () => selectTotalScore(scores, dateKey),
    [scores, dateKey],
  );

  // Determine glow color from primary engine
  const glowColor = useMemo(() => {
    if (mode === "titan") return "#FFD700";
    if (!archetype) return colors.primary;
    const meta = IDENTITIES.find((i) => i.id === archetype);
    if (!meta || meta.primaryEngine === "all") return colors.primary;
    return (colors as Record<string, string>)[meta.primaryEngine] ?? colors.primary;
  }, [mode, archetype]);

  // Don't render for non-game modes
  if (!GAME_MODES.has(mode)) return null;

  const toggleMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const opening = isOpen.value < 0.5;
    if (opening) {
      setMenuVisible(true);
      isOpen.value = withSpring(1, SPRING_CONFIG);
    } else {
      isOpen.value = withSpring(0, SPRING_CONFIG);
      setTimeout(() => setMenuVisible(false), 300);
    }
  };

  const closeMenu = () => {
    isOpen.value = withSpring(0, SPRING_CONFIG);
    setTimeout(() => setMenuVisible(false), 300);
  };

  const handleNavigate = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    closeMenu();
    // Small delay so the close animation starts before navigation
    setTimeout(() => {
      router.push(route as any);
    }, 150);
  };

  // Animated styles
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(isOpen.value, [0, 1], [0, 1]),
  }));

  const buttonRotation = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(isOpen.value, [0, 1], [0, 45])}deg` },
    ],
  }));

  const pulseGlow = useAnimatedStyle(() => ({
    shadowColor: glowColor,
    shadowOpacity: interpolate(isOpen.value, [0, 1], [0.6, 1]),
    shadowRadius: interpolate(isOpen.value, [0, 1], [8, 16]),
  }));

  return (
    <View
      style={[
        styles.container,
        { bottom: insets.bottom + 8 },
      ]}
      pointerEvents="box-none"
    >
      {/* Dimmed overlay */}
      <Animated.View
        style={[styles.overlay, overlayStyle]}
        pointerEvents={menuVisible ? "auto" : "none"}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} />
      </Animated.View>

      {/* Menu items (positioned relative to center button) */}
      <View style={styles.menuAnchor}>
        {MENU_ITEMS.map((item, index) => (
          <RadialItem
            key={item.label}
            item={item}
            index={index}
            total={MENU_ITEMS.length}
            isOpen={isOpen}
            onPress={handleNavigate}
          />
        ))}

        {/* Center floating button */}
        <Animated.View style={[styles.centerButtonOuter, pulseGlow, { borderColor: glowColor }]}>
          <Pressable onPress={toggleMenu} style={styles.centerButton}>
            <Animated.View style={buttonRotation}>
              <Text style={styles.centerIcon}>{"\u26A1"}</Text>
            </Animated.View>
            <Text style={styles.scoreText}>{totalScore}%</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    zIndex: 999,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    top: -Dimensions.get("window").height,
  },
  menuAnchor: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  centerButtonOuter: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    borderWidth: 2,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  centerButton: {
    width: "100%",
    height: "100%",
    borderRadius: BUTTON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  centerIcon: {
    fontSize: 18,
    marginTop: -2,
  },
  scoreText: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: 0.5,
    marginTop: -2,
  },
  menuItemContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  menuItemButton: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: ITEM_SIZE / 2,
    backgroundColor: "rgba(255, 255, 255, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuItemIcon: {
    fontSize: 18,
  },
  menuItemLabel: {
    fontSize: 8,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 4,
    textAlign: "center",
  },
});
