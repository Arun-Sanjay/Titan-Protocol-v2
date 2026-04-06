import React, { useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  cancelAnimation,
  interpolate,
  FadeInUp,
  FadeOutDown,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter, type Href } from "expo-router";
import { colors, spacing, radius, shadows } from "../../theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MenuItem = {
  label: string;
  icon: string;
  route: Href;
  color: string;
};

type Props = Record<string, never>;

// ---------------------------------------------------------------------------
// Menu items
// ---------------------------------------------------------------------------

const MENU_ITEMS: MenuItem[] = [
  { label: "Add Task", icon: "\u2713", route: "/(modals)/add-task", color: colors.charisma },
  { label: "Log Workout", icon: "\u26A1", route: "/hub/workouts", color: colors.body },
  { label: "Log Sleep", icon: "\u263E", route: "/hub/sleep", color: colors.mind },
  { label: "Log Weight", icon: "\u2696", route: "/hub/weight", color: colors.body },
];

// ---------------------------------------------------------------------------
// Animated components
// ---------------------------------------------------------------------------

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

// ---------------------------------------------------------------------------
// Menu Item Row
// ---------------------------------------------------------------------------

const MenuItemRow = React.memo(function MenuItemRow({
  item,
  index,
  onPress,
}: {
  item: MenuItem;
  index: number;
  onPress: (item: MenuItem) => void;
}) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.96, { duration: 80 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 50)
        .duration(250)
        .easing(Easing.out(Easing.cubic))}
    >
      <AnimatedPressable
        onPress={() => onPress(item)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.menuItem, animStyle]}
      >
        <View style={[styles.menuIcon, { backgroundColor: item.color + "18" }]}>
          <Text style={[styles.menuIconText, { color: item.color }]}>
            {item.icon}
          </Text>
        </View>
        <Text style={styles.menuLabel}>{item.label}</Text>
        <Text style={styles.menuChevron}>{"\u203A"}</Text>
      </AnimatedPressable>
    </Animated.View>
  );
});

// ---------------------------------------------------------------------------
// FloatingActionButton
// ---------------------------------------------------------------------------

export const FloatingActionButton = React.memo(function FloatingActionButton(_props: Props) {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();

  // FAB animation values
  const fabScale = useSharedValue(1);
  const fabRotation = useSharedValue(0);
  const glowOpacity = useSharedValue(0.3);

  // Menu state
  const [menuOpen, setMenuOpen] = React.useState(false);
  const backdropOpacity = useSharedValue(0);

  // Subtle glow pulse
  useEffect(() => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    return () => {
      // Phase 2.1A: cancel infinite pulse on unmount
      cancelAnimation(glowOpacity);
    };
  }, [glowOpacity]);

  // FAB animated styles
  const fabAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: fabScale.value },
      { rotate: `${fabRotation.value}deg` },
    ],
  }));

  const glowAnimStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  // Open menu
  const openMenu = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    fabScale.value = withSequence(
      withTiming(0.9, { duration: 80 }),
      withSpring(1, { damping: 12, stiffness: 200 }),
    );
    fabRotation.value = withSpring(45, { damping: 14, stiffness: 180 });
    backdropOpacity.value = withTiming(1, { duration: 200 });
    setMenuOpen(true);
  }, [fabScale, fabRotation, backdropOpacity]);

  // Close menu
  const closeMenu = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fabRotation.value = withSpring(0, { damping: 14, stiffness: 180 });
    backdropOpacity.value = withTiming(0, { duration: 150 });
    setMenuOpen(false);
  }, [fabRotation, backdropOpacity]);

  // Toggle
  const handleFABPress = useCallback(() => {
    if (menuOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }, [menuOpen, openMenu, closeMenu]);

  // Menu item press
  const handleMenuItemPress = useCallback(
    (item: MenuItem) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      closeMenu();
      router.push(item.route);
    },
    [closeMenu, router],
  );

  return (
    <>
      {/* Backdrop overlay — dismiss on tap */}
      {menuOpen && (
        <AnimatedPressable
          onPress={closeMenu}
          style={[
            styles.backdrop,
            { height: windowHeight },
            backdropAnimStyle,
          ]}
        />
      )}

      {/* Quick Menu */}
      {menuOpen && (
        <Animated.View
          entering={FadeInUp.duration(200).easing(Easing.out(Easing.cubic))}
          exiting={FadeOutDown.duration(150)}
          style={styles.menuContainer}
        >
          <View style={styles.menuPanel}>
            {/* Inner border for premium feel */}
            <View style={styles.menuInnerBorder} pointerEvents="none" />
            <LinearGradient
              colors={["rgba(255,255,255,0.06)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.menuGradientOverlay}
              pointerEvents="none"
            />
            <Text style={styles.menuTitle}>QUICK ACTIONS</Text>
            {MENU_ITEMS.map((item, index) => (
              <MenuItemRow
                key={item.label}
                item={item}
                index={index}
                onPress={handleMenuItemPress}
              />
            ))}
          </View>
        </Animated.View>
      )}

      {/* FAB button */}
      <AnimatedPressable onPress={handleFABPress} style={[styles.fabOuter, fabAnimStyle]}>
        {/* Glow pulse behind the button */}
        <Animated.View style={[styles.fabGlow, glowAnimStyle]} />
        <LinearGradient
          colors={[
            "rgba(255,255,255,0.12)",
            "rgba(255,255,255,0.03)",
          ]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.fabGradient}
        >
          <Text style={styles.fabIcon}>+</Text>
        </LinearGradient>
      </AnimatedPressable>
    </>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const FAB_SIZE = 56;
const FAB_BORDER_RADIUS = FAB_SIZE / 2;

const styles = StyleSheet.create({
  // Backdrop
  backdrop: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.60)",
    zIndex: 90,
  },

  // Menu
  menuContainer: {
    position: "absolute",
    bottom: 90 + FAB_SIZE + 12,
    right: 20,
    zIndex: 95,
    width: 220,
  },
  menuPanel: {
    backgroundColor: "rgba(0, 0, 0, 0.97)",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.20)",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    overflow: "hidden",
    ...shadows.panel,
  },
  menuInnerBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
  },
  menuGradientOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  menuTitle: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.6,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
    paddingLeft: 2,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  menuIconText: {
    fontSize: 16,
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    letterSpacing: 0.2,
  },
  menuChevron: {
    fontSize: 20,
    color: colors.textMuted,
    fontWeight: "300",
  },

  // FAB
  fabOuter: {
    position: "absolute",
    bottom: 90,
    right: 20,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_BORDER_RADIUS,
    zIndex: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  fabGlow: {
    position: "absolute",
    width: FAB_SIZE + 16,
    height: FAB_SIZE + 16,
    borderRadius: (FAB_SIZE + 16) / 2,
    backgroundColor: "rgba(188, 202, 247, 0.14)",
  },
  fabGradient: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_BORDER_RADIUS,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.20)",
    alignItems: "center",
    justifyContent: "center",
    // Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 32,
    elevation: 12,
  },
  fabIcon: {
    fontSize: 28,
    fontWeight: "300",
    color: "#FFFFFF",
    marginTop: -1,
  },
});
