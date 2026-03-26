import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius, TOUCH_MIN, fonts } from "../../theme";
import { formatDateDisplay, addDays, getTodayKey } from "../../lib/date";

type Props = {
  dateKey: string;
  onChange: (dateKey: string) => void;
};

export const DateNavigator = React.memo(function DateNavigator({ dateKey, onChange }: Props) {
  const isToday = dateKey === getTodayKey();

  const go = (delta: number) => {
    Haptics.selectionAsync();
    onChange(addDays(dateKey, delta));
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={() => go(-1)} style={styles.arrow}>
        <Text style={styles.arrowText}>◀</Text>
      </Pressable>

      <Pressable onPress={() => onChange(getTodayKey())} style={styles.dateWrap}>
        <Text style={styles.date}>{formatDateDisplay(dateKey)}</Text>
        {isToday && <Text style={styles.todayBadge}>TODAY</Text>}
      </Pressable>

      <Pressable onPress={() => go(1)} style={styles.arrow}>
        <Text style={styles.arrowText}>▶</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    paddingVertical: spacing.sm,
  },
  arrow: {
    width: TOUCH_MIN,
    height: TOUCH_MIN,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  dateWrap: {
    alignItems: "center",
  },
  date: {
    ...fonts.mono,
    fontSize: 14,
    color: colors.text,
  },
  todayBadge: {
    ...fonts.kicker,
    fontSize: 9,
    color: colors.primary,
    marginTop: 2,
  },
});
