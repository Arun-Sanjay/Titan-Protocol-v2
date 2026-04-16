import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, fonts } from "../../theme";

type Props = {
  kicker?: string;
  title: string;
  subtitle?: string;
};

export const PageHeader = React.memo(function PageHeader({ kicker, title, subtitle }: Props) {
  return (
    <View style={styles.container}>
      {kicker && <Text style={styles.kicker}>{kicker}</Text>}
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  kicker: {
    ...fonts.kicker,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  title: {
    ...fonts.title,
    textTransform: "uppercase",
    letterSpacing: -0.5,
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 6,
    letterSpacing: 0.3,
    lineHeight: 20,
  },
});
