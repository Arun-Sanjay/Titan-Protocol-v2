import React, { useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, spacing } from "../../../theme";
import type { SkillNodeStatus } from "../../../stores/useSkillTreeStore";

type Props = {
  status: SkillNodeStatus;
  name: string;
  level: number;
  engineColor: string;
  progress?: number; // 0-100 for locked state progress bar
  progressText?: string; // e.g., "7 / 10 workouts"
  onClaim?: () => void;
};

const NODE_SIZE = 40;

export function SkillNode({
  status,
  name,
  level,
  engineColor,
  progress = 0,
  progressText,
  onClaim,
}: Props) {
  const glowOpacity = useSharedValue(0.3);
  const pulseTextOpacity = useSharedValue(0.6);

  useEffect(() => {
    if (status === "ready") {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
      pulseTextOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.6, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    }
  }, [status]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: status === "ready" ? glowOpacity.value : 0,
  }));

  const pulseTextStyle = useAnimatedStyle(() => ({
    opacity: status === "ready" ? pulseTextOpacity.value : 1,
  }));

  const handlePress = () => {
    if (status === "ready" && onClaim) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClaim();
    }
  };

  const Wrapper = status === "ready" ? Pressable : View;
  const wrapperProps = status === "ready" ? { onPress: handlePress } : {};

  return (
    <View style={styles.container}>
      {/* @ts-ignore — Pressable/View swap */}
      <Wrapper {...wrapperProps} style={styles.nodeWrapper}>
        {/* Glow layer (ready state only) */}
        {status === "ready" && (
          <Animated.View
            style={[
              styles.glow,
              { backgroundColor: engineColor },
              glowStyle,
            ]}
          />
        )}

        {/* Node circle */}
        <View
          style={[
            styles.node,
            status === "locked" && styles.nodeLocked,
            status === "ready" && {
              borderColor: engineColor,
              borderWidth: 2,
              backgroundColor: "rgba(255,255,255,0.04)",
            },
            status === "claimed" && {
              backgroundColor: engineColor + "4D",
              borderColor: engineColor,
              borderWidth: 2,
              shadowColor: engineColor,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.3,
              shadowRadius: 6,
              elevation: 4,
            },
          ]}
        >
          {status === "locked" && (
            <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
          )}
          {status === "ready" && (
            <Ionicons name="star" size={16} color={engineColor} />
          )}
          {status === "claimed" && (
            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
          )}
        </View>

        {/* CLAIM badge (ready state only) */}
        {status === "ready" && (
          <View style={[styles.claimBadge, { backgroundColor: engineColor }]}>
            <Text style={styles.claimBadgeText}>CLAIM</Text>
          </View>
        )}
      </Wrapper>

      {/* Name */}
      <Text
        style={[
          styles.name,
          status === "locked" && { color: colors.textMuted },
          status === "ready" && { color: engineColor },
          status === "claimed" && { color: "#FFFFFF" },
        ]}
        numberOfLines={1}
      >
        {name}
      </Text>

      {/* Status-specific text below name */}
      {status === "locked" && (
        <>
          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: engineColor,
                  width: `${Math.min(progress, 100)}%`,
                },
              ]}
            />
          </View>
          {progressText && (
            <Text style={styles.progressText}>{progressText}</Text>
          )}
        </>
      )}

      {status === "ready" && (
        <Animated.Text
          style={[styles.tapToClaim, { color: engineColor }, pulseTextStyle]}
        >
          TAP TO CLAIM
        </Animated.Text>
      )}

      {status === "claimed" && (
        <Text style={[styles.claimedText, { color: engineColor }]}>
          {"\u2713"} Claimed
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 3,
    width: 64,
  },
  nodeWrapper: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: NODE_SIZE + 8,
    height: NODE_SIZE + 8,
    borderRadius: (NODE_SIZE + 8) / 2,
  },
  node: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  nodeLocked: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  claimBadge: {
    position: "absolute",
    bottom: -4,
    right: -6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
  },
  claimBadgeText: {
    fontSize: 8,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  name: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    maxWidth: 64,
    textAlign: "center",
  },
  progressTrack: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    overflow: "hidden",
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: "center",
  },
  tapToClaim: {
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  claimedText: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },
});
