import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, fonts } from "../../theme";

type Props = {
  title: string;
  right?: string;
};

export const SectionHeader = React.memo(function SectionHeader({ title, right }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {right && <Text style={styles.right}>{right}</Text>}
    </View>
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
  title: {
    ...fonts.kicker,
    color: colors.textMuted,
  },
  right: {
    ...fonts.mono,
    fontSize: 13,
    color: colors.textMuted,
  },
});
