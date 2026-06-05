import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, fonts, spacing, radius } from "../../theme";

export type PlanningRow = {
  id: string;
  title: string;
  sub?: string;
  actionLabel?: string;
  onAction?: () => void;
};

type Props = {
  rows: PlanningRow[];
  emptyText: string;
};

/** A list of planner rows (engines-at-risk, top incomplete tasks). Each row
 *  is tappable when it carries an action. Mirrors web's .tx-planning-list. */
export const PlanningList = React.memo(function PlanningList({ rows, emptyText }: Props) {
  if (rows.length === 0) {
    return <Text style={styles.empty}>{emptyText}</Text>;
  }
  return (
    <View style={styles.list}>
      {rows.map((r) => {
        const inner = (
          <>
            <View style={styles.textCol}>
              <Text style={styles.title} numberOfLines={1}>
                {r.title}
              </Text>
              {r.sub ? (
                <Text style={styles.sub} numberOfLines={1}>
                  {r.sub}
                </Text>
              ) : null}
            </View>
            {r.actionLabel ? <Text style={styles.action}>{r.actionLabel}</Text> : null}
          </>
        );
        return r.onAction ? (
          <Pressable
            key={r.id}
            onPress={r.onAction}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            {inner}
          </Pressable>
        ) : (
          <View key={r.id} style={styles.row}>
            {inner}
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    backgroundColor: "rgba(0,0,0,0.84)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  rowPressed: { opacity: 0.65 },
  textCol: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...fonts.body, fontSize: 13, color: colors.text },
  sub: { ...fonts.small, fontSize: 11, color: colors.textMuted },
  action: {
    ...fonts.kicker,
    fontSize: 10,
    color: colors.textSecondary,
  },
  empty: {
    ...fonts.body,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
  },
});
