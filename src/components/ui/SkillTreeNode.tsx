import React, { useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  cancelAnimation,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius } from "../../theme";

/* ─── Types ───────────────────────────────────────────────────────── */

type NodeStatus = "locked" | "ready" | "claimed";

type SkillNodeData = {
  id: string;
  name: string;
  description: string;
  level: number;
  status: NodeStatus;
  iconName: string;
};

type Props = {
  node: SkillNodeData;
  branchColor: string;
  onClaim?: () => void;
  isConnected?: boolean;
};

/* ─── Constants ───────────────────────────────────────────────────── */

const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });
const NODE_SIZE = 64;
const GLOW_SIZE = NODE_SIZE + 12;
const CONNECTION_LINE_HEIGHT = 20;

/* ─── Component ───────────────────────────────────────────────────── */

export const SkillTreeNode = React.memo(function SkillTreeNode({
  node,
  branchColor,
  onClaim,
  isConnected = false,
}: Props) {
  const { status, name, level, iconName } = node;

  // Shared animation values
  const glowOpacity = useSharedValue(status === "ready" ? 0.4 : 0);
  const glowScale = useSharedValue(1);
  const nodeScale = useSharedValue(1);
  const fillProgress = useSharedValue(status === "claimed" ? 1 : 0);
  const checkOpacity = useSharedValue(status === "claimed" ? 1 : 0);

  // Pulse animation for "ready" state
  useEffect(() => {
    if (status === "ready") {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.85, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
      glowScale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    } else {
      glowOpacity.value = withTiming(0, { duration: 300 });
      glowScale.value = withTiming(1, { duration: 300 });
    }
    return () => {
      // Phase 2.1A: cancel infinite pulse animations on unmount to prevent
      // memory leak accumulating across skill tree navigations.
      cancelAnimation(glowOpacity);
      cancelAnimation(glowScale);
    };
  }, [status]);

  // Set initial fill state for claimed nodes
  useEffect(() => {
    if (status === "claimed") {
      fillProgress.value = 1;
      checkOpacity.value = 1;
    }
  }, [status]);

  // Claim handler with haptics and animation
  const handleClaim = useCallback(() => {
    if (status !== "ready" || !onClaim) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Scale burst animation
    nodeScale.value = withSequence(
      withSpring(1.2, { damping: 8, stiffness: 300 }),
      withSpring(1.0, { damping: 10, stiffness: 200 }),
    );

    // Fill animation
    fillProgress.value = withTiming(1, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });

    // Show checkmark after fill
    checkOpacity.value = withTiming(1, { duration: 300 });

    // Stop glow
    glowOpacity.value = withTiming(0, { duration: 400 });

    onClaim();
  }, [status, onClaim]);

  /* ─── Animated Styles ─────────────────────────────────────────── */

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const nodeAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: nodeScale.value }],
  }));

  const fillOverlayStyle = useAnimatedStyle(() => ({
    opacity: fillProgress.value,
  }));

  const checkOverlayStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    transform: [{ scale: checkOpacity.value }],
  }));

  /* ─── Derived state ───────────────────────────────────────────── */

  const isLocked = status === "locked";
  const isClaimed = status === "claimed";
  const isReady = status === "ready";

  const nodeOpacity = isLocked ? 0.3 : 1;
  const borderColor = isLocked
    ? "rgba(255, 255, 255, 0.12)"
    : isReady
      ? branchColor
      : branchColor;
  const bgColor = isLocked
    ? "rgba(255, 255, 255, 0.04)"
    : "rgba(0, 0, 0, 0.8)";

  // Resolve icon name to valid Ionicons name
  const resolvedIcon = (iconName || "ellipse") as keyof typeof Ionicons.glyphMap;

  return (
    <View style={styles.wrapper}>
      {/* Connection line going up */}
      {isConnected && (
        <View
          style={[
            styles.connectionLine,
            { backgroundColor: isLocked ? "rgba(255,255,255,0.08)" : branchColor + "40" },
          ]}
        />
      )}

      {/* Outer glow ring (ready state) */}
      <Animated.View
        style={[
          styles.glowRing,
          { borderColor: branchColor },
          glowStyle,
        ]}
        pointerEvents="none"
      />

      {/* Main node */}
      <Animated.View style={[{ opacity: nodeOpacity }, nodeAnimStyle]}>
        <Pressable
          onPress={handleClaim}
          disabled={status !== "ready"}
          style={[
            styles.nodeCircle,
            {
              borderColor,
              backgroundColor: bgColor,
            },
          ]}
        >
          {/* Filled background overlay (claimed state) */}
          <Animated.View
            style={[
              styles.fillOverlay,
              { backgroundColor: branchColor },
              fillOverlayStyle,
            ]}
            pointerEvents="none"
          />

          {/* Icon */}
          {isLocked ? (
            <Ionicons name="lock-closed" size={20} color="rgba(255,255,255,0.25)" />
          ) : (
            <Ionicons
              name={resolvedIcon}
              size={22}
              color={isClaimed ? "#000" : branchColor}
            />
          )}

          {/* Checkmark overlay (claimed) */}
          <Animated.View style={[styles.checkOverlay, checkOverlayStyle]} pointerEvents="none">
            <Ionicons name="checkmark" size={16} color="#000" />
          </Animated.View>

          {/* Level badge */}
          <View style={[styles.levelBadge, { backgroundColor: isLocked ? "rgba(255,255,255,0.08)" : branchColor }]}>
            <Text style={[styles.levelText, { color: isLocked ? "rgba(255,255,255,0.3)" : "#000" }]}>
              {level}
            </Text>
          </View>
        </Pressable>
      </Animated.View>

      {/* Name label */}
      <Text
        style={[
          styles.nameLabel,
          isLocked && styles.nameLocked,
        ]}
        numberOfLines={2}
      >
        {name}
      </Text>
    </View>
  );
});

/* ─── Styles ──────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    width: 88,
    gap: spacing.xs,
  },

  // Connection line
  connectionLine: {
    width: 2,
    height: CONNECTION_LINE_HEIGHT,
    borderRadius: 1,
    marginBottom: spacing.xs,
  },

  // Glow ring
  glowRing: {
    position: "absolute",
    top: CONNECTION_LINE_HEIGHT + spacing.xs,
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
    borderWidth: 2,
  },

  // Node
  nodeCircle: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  // Fill overlay
  fillOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: NODE_SIZE / 2,
  },

  // Checkmark overlay
  checkOverlay: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Level badge
  levelBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#000",
  },
  levelText: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: "800",
  },

  // Name
  nameLabel: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "center",
    letterSpacing: 0.3,
    lineHeight: 14,
    marginTop: spacing.xs,
  },
  nameLocked: {
    color: colors.textMuted,
    opacity: 0.5,
  },
});
