import React from "react";
import { View, Text, TextInput, StyleSheet, type TextInputProps } from "react-native";
import { colors, fonts, radius, spacing } from "../../theme";

type Props = TextInputProps & { label: string };

/** Labelled text field matching web's `.body-input` / `.body-label`. */
export function FieldInput({ label, style, multiline, ...rest }: Props) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline, style]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { ...fonts.kicker, fontSize: 10, color: colors.textMuted, letterSpacing: 1.5 },
  input: {
    ...fonts.body,
    color: colors.text,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
  },
  multiline: {
    minHeight: 120,
    textAlignVertical: "top",
  },
});
