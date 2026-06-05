import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, fonts, radius, spacing } from "../../theme";

export type SelectOption = { value: string; label: string; color?: string };

type Props = {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
};

/** Labelled segmented pill selector — matches web's `.body-select` look. */
export function FieldSelectRow({ label, options, value, onChange }: Props) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                Haptics.selectionAsync();
                onChange(opt.value);
              }}
              style={({ pressed }) => [
                styles.pill,
                active && styles.pillActive,
                active && opt.color ? { borderColor: opt.color } : null,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  active && { color: opt.color ?? colors.text },
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { ...fonts.kicker, fontSize: 10, color: colors.textMuted, letterSpacing: 1.5 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  pill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  pillActive: {
    backgroundColor: colors.surfaceBorderStrong,
    borderColor: colors.cardBorderActive,
  },
  pillText: { ...fonts.kicker, color: colors.textMuted, fontSize: 11, letterSpacing: 1.5 },
  pressed: { opacity: 0.6 },
});
