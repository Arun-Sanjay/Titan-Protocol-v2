import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, fonts, radius, spacing } from "../../theme";
import type { EngineKey } from "../../db/schema";

export type EngineFilter = "all" | EngineKey;

const FILTERS: { key: EngineFilter; label: string; color?: string }[] = [
  { key: "all", label: "ALL" },
  { key: "body", label: "BODY", color: colors.body },
  { key: "mind", label: "MIND", color: colors.mind },
  { key: "money", label: "MONEY", color: colors.money },
  { key: "charisma", label: "GENERAL", color: colors.charisma },
];

type Props = {
  value: EngineFilter;
  onChange: (next: EngineFilter) => void;
};

export const EngineFilterTabs = React.memo(function EngineFilterTabs({
  value,
  onChange,
}: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {FILTERS.map((f) => {
        const active = f.key === value;
        return (
          <Pressable
            key={f.key}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(f.key);
            }}
            style={({ pressed }) => [
              styles.pill,
              active && styles.pillActive,
              active && f.color
                ? { borderColor: f.color }
                : null,
              pressed && styles.pillPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={f.label}
          >
            <Text
              style={[
                styles.pillText,
                active && { color: f.color ?? colors.text },
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    backgroundColor: colors.surface,
  },
  pillActive: {
    backgroundColor: colors.surfaceBorderStrong,
  },
  pillPressed: { opacity: 0.7 },
  pillText: {
    ...fonts.kicker,
    color: colors.textMuted,
    letterSpacing: 1.5,
    fontSize: 11,
  },
});
