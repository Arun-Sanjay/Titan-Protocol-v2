import React, { useRef } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, spacing, TOUCH_MIN, fonts } from "../../theme";
import { formatDateDisplay, addDays, getTodayKey } from "../../lib/date";

type Props = {
  dateKey: string;
  onChange: (dateKey: string) => void;
};

export function DateNavigator({ dateKey, onChange }: Props) {
  const isToday = dateKey === getTodayKey();
  const busyRef = useRef(false);

  const go = (delta: number) => {
    // Debounce: prevent double-fire from Pressable re-render race
    if (busyRef.current) return;
    busyRef.current = true;
    Haptics.selectionAsync();
    const newDate = addDays(dateKey, delta);
    onChange(newDate);
    // Release after a short delay to allow React to settle
    setTimeout(() => { busyRef.current = false; }, 300);
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={() => go(-1)} style={styles.arrow}>
        <Text style={styles.arrowText}>◀</Text>
      </Pressable>

      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          onChange(getTodayKey());
        }}
        style={styles.dateWrap}
      >
        <Text style={styles.date}>{formatDateDisplay(dateKey)}</Text>
        {isToday && <Text style={styles.todayBadge}>TODAY</Text>}
      </Pressable>

      <Pressable onPress={() => go(1)} style={styles.arrow}>
        <Text style={styles.arrowText}>▶</Text>
      </Pressable>
    </View>
  );
}

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
    color: colors.text,
    marginTop: 2,
  },
});
