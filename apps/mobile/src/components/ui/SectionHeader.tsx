import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing } from "../../theme";

type Props = {
  title: string;
  right?: string;
};

export function SectionHeader({ title, right }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {right && <Text style={styles.right}>{right}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
    marginTop: spacing.xl,
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  right: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
  },
});
