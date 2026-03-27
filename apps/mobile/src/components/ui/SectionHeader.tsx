import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { FadeInRight, Easing } from "react-native-reanimated";
import { colors, spacing, fonts } from "../../theme";

type Props = {
  title: string;
  right?: string;
  /** Accent line color. Defaults to white at 0.3 opacity. */
  accentColor?: string;
  /** Entrance animation delay in ms. Omit to skip entrance anim. */
  delay?: number;
};

export const SectionHeader = React.memo(function SectionHeader({
  title,
  right,
  accentColor,
  delay,
}: Props) {
  const entering =
    delay != null
      ? FadeInRight.delay(delay).duration(400).easing(Easing.out(Easing.cubic))
      : undefined;

  return (
    <Animated.View entering={entering} style={styles.container}>
      <View style={styles.titleRow}>
        {/* Left accent line */}
        <View
          style={[
            styles.accentLine,
            accentColor
              ? { backgroundColor: accentColor }
              : undefined,
          ]}
        />
        <Text style={styles.title}>{title}</Text>
      </View>
      {right != null && <Text style={styles.right}>{right}</Text>}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
    marginTop: spacing.xl,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  accentLine: {
    width: 2,
    height: 12,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.30)",
  },
  title: {
    fontSize: 10,
    fontWeight: "620" as any,
    color: "rgba(233,240,255,0.72)",
    textTransform: "uppercase",
    letterSpacing: 3.0, // 0.24em at ~10px
  },
  right: {
    ...fonts.mono,
    fontSize: 13,
    color: colors.textMuted,
  },
});
