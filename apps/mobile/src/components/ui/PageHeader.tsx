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
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  title: {
    ...fonts.title,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
