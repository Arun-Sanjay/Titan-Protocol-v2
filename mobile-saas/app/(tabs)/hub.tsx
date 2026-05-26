import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { Panel } from "../../src/components/ui/Panel";
import { PageHeader } from "../../src/components/ui/PageHeader";

import { colors, fonts, radius, spacing } from "../../src/theme";

type RowConfig = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  href?: string;
  comingIn?: string;
};

const ROWS: readonly RowConfig[] = [
  {
    icon: "repeat-outline",
    title: "Habits",
    subtitle: "Build a chain. Don't break it.",
    href: "/habits",
  },
  {
    icon: "stopwatch-outline",
    title: "Focus",
    subtitle: "Pomodoro sessions with deep work tracking.",
    href: "/focus",
  },
  {
    icon: "book-outline",
    title: "Journal",
    subtitle: "End-of-day reflections.",
    href: "/journal",
  },
  {
    icon: "flag-outline",
    title: "Goals",
    subtitle: "Long-horizon targets the missions ladder up to.",
    href: "/goals",
  },
  {
    icon: "stats-chart-outline",
    title: "Analytics",
    subtitle: "Week summary, engine trends, task reliability.",
    href: "/analytics",
  },
];

export default function HubScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <PageHeader
          kicker="DEEP UTILITIES"
          title="Hub"
          subtitle="Sub-tools, history, and configuration."
        />

        <View style={styles.list}>
          {ROWS.map((row) => {
            const enabled = Boolean(row.href);
            const onPress = enabled
              ? () => {
                  Haptics.selectionAsync();
                  router.push(row.href!);
                }
              : undefined;

            return (
              <Pressable
                key={row.title}
                onPress={onPress}
                disabled={!enabled}
                style={({ pressed }) => [
                  pressed && enabled && styles.pressed,
                ]}
              >
                <Panel style={styles.row}>
                  <View
                    style={[
                      styles.iconBox,
                      !enabled && styles.iconBoxDisabled,
                    ]}
                  >
                    <Ionicons
                      name={row.icon}
                      size={18}
                      color={enabled ? colors.text : colors.textMuted}
                    />
                  </View>
                  <View style={styles.rowText}>
                    <View style={styles.rowTitleRow}>
                      <Text
                        style={[
                          styles.rowTitle,
                          !enabled && styles.rowTitleDisabled,
                        ]}
                      >
                        {row.title}
                      </Text>
                      {row.comingIn && (
                        <Text style={styles.comingPill}>{row.comingIn}</Text>
                      )}
                    </View>
                    <Text style={styles.rowSubtitle}>{row.subtitle}</Text>
                  </View>
                  {enabled && (
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.textMuted}
                    />
                  )}
                </Panel>
              </Pressable>
            );
          })}
        </View>

        <View style={{ height: spacing["2xl"] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, gap: spacing.lg },
  list: { gap: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxDisabled: { opacity: 0.5 },
  rowText: { flex: 1, gap: spacing.xs },
  rowTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  rowTitle: {
    ...fonts.body,
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  rowTitleDisabled: { color: colors.textMuted },
  rowSubtitle: {
    ...fonts.body,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  comingPill: {
    ...fonts.kicker,
    color: colors.textMuted,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  pressed: { opacity: 0.6 },
});
