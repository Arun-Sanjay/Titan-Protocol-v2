import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { colors, spacing, fonts } from "../../../theme";
import { useIdentityStore, selectIdentityMeta } from "../../../stores/useIdentityStore";

type Props = {
  /** Override vote count (defaults to store value) */
  votes?: number;
  /** Override identity name (defaults to store value) */
  identity?: string | null;
  /** Animate the counter on mount/change */
  animate?: boolean;
};

export function VoteCounter({ votes: votesProp, identity: identityProp, animate = false }: Props) {
  const storeVotes = useIdentityStore((s) => s.totalVotes);
  const storeArchetype = useIdentityStore((s) => s.archetype);

  const votes = votesProp ?? storeVotes;
  const meta = selectIdentityMeta(storeArchetype);
  const identityName = identityProp ?? meta?.name ?? "";

  // Display value tracks the animated number
  const [displayNumber, setDisplayNumber] = React.useState(animate ? Math.max(0, votes - 1) : votes);
  const scale = useSharedValue(1);
  const prevVotes = useRef(votes);

  useEffect(() => {
    if (!animate) {
      setDisplayNumber(votes);
      return;
    }

    if (votes > prevVotes.current) {
      // Animate: show previous value, then update after a delay with scale pulse
      const startVal = prevVotes.current;
      const endVal = votes;
      const duration = 600;
      const steps = endVal - startVal;
      const stepDuration = Math.max(50, duration / steps);

      let current = startVal;
      const interval = setInterval(() => {
        current++;
        setDisplayNumber(current);
        if (current >= endVal) {
          clearInterval(interval);
          // Scale pulse when done
          scale.value = withSequence(
            withTiming(1.15, { duration: 150 }),
            withTiming(1, { duration: 200 }),
          );
        }
      }, stepDuration);

      prevVotes.current = votes;
      return () => clearInterval(interval);
    } else {
      setDisplayNumber(votes);
      prevVotes.current = votes;
    }
  }, [votes, animate]);

  const numberStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>VOTE</Text>
        <Animated.View style={numberStyle}>
          <Text style={styles.number}>{displayNumber}</Text>
        </Animated.View>
      </View>
      {identityName ? (
        <Text style={styles.identity}>as {identityName}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
  },
  label: {
    ...fonts.kicker,
    color: colors.textMuted,
  },
  number: {
    ...fonts.mono,
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  identity: {
    fontSize: 10,
    fontWeight: "400",
    color: colors.textMuted,
  },
});
