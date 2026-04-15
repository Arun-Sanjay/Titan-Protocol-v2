import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../theme";

type OpsBannerProps = {
  opName: string;
  currentDay: number;
  totalDays: number;
  dailyResults: boolean[];
  onPress: () => void;
};

export function OpsBanner({
  opName,
  currentDay,
  totalDays,
  dailyResults,
  onPress,
}: OpsBannerProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Animated.View entering={FadeInDown.duration(400)}>
      <Pressable onPress={handlePress} style={styles.container}>
        <View style={styles.topRow}>
          <Text style={styles.kicker}>{"\u2694\uFE0F"} FIELD OP ACTIVE</Text>
          <Text style={styles.name} numberOfLines={1}>
            {opName}
          </Text>
          <Text style={styles.dayCount}>
            Day {currentDay}/{totalDays}
          </Text>
        </View>

        <View style={styles.dotsRow}>
          {Array.from({ length: totalDays }).map((_, i) => {
            const passed = dailyResults[i] === true;
            const isPending = i >= dailyResults.length;
            return (
              <View
                key={i}
                style={[
                  styles.dot,
                  passed
                    ? styles.dotPassed
                    : isPending
                      ? styles.dotPending
                      : styles.dotFailed,
                ]}
              />
            );
          })}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  kicker: {
    ...fonts.mono,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  } as any,
  name: {
    flex: 1,
    ...fonts.title,
    fontSize: 14,
    color: colors.text,
  } as any,
  dayCount: {
    ...fonts.mono,
    fontSize: 12,
    color: colors.textSecondary,
  } as any,
  dotsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotPassed: {
    backgroundColor: "#34d399",
  },
  dotPending: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  dotFailed: {
    backgroundColor: "rgba(239,68,68,0.5)",
  },
});
