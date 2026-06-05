import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, fonts } from "../../theme";

type Props = {
  kicker?: string;
  title: string;
  subtitle?: string;
  /** Optional right-aligned content (stat, action button) on the title row. */
  rightSlot?: React.ReactNode;
};

export const PageHeader = React.memo(function PageHeader({ kicker, title, subtitle, rightSlot }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.textCol}>
          {kicker && <Text style={styles.kicker}>{kicker}</Text>}
          <Text style={styles.title}>{title}</Text>
        </View>
        {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
      </View>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  rightSlot: {
    flexShrink: 0,
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
