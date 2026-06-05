import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { PageHeader } from "../../src/components/ui/PageHeader";
import { ListRow } from "../../src/components/ui/ListRow";

import { colors, spacing } from "../../src/theme";

type RowConfig = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  href: string;
};

const ROWS: readonly RowConfig[] = [
  { icon: "repeat-outline", title: "Habits", subtitle: "Build a chain. Don't break it.", href: "/habits" },
  { icon: "stopwatch-outline", title: "Focus", subtitle: "Pomodoro sessions with deep work tracking.", href: "/focus" },
  { icon: "book-outline", title: "Journal", subtitle: "End-of-day reflections.", href: "/journal" },
  { icon: "flag-outline", title: "Goals", subtitle: "Long-horizon targets the missions ladder up to.", href: "/goals" },
  { icon: "stats-chart-outline", title: "Analytics", subtitle: "Trends, engine momentum, task reliability.", href: "/analytics" },
];

export default function HubScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <PageHeader kicker="Deep Utilities" title="Hub" subtitle="Sub-tools, history, and configuration." />

        <View style={styles.list}>
          {ROWS.map((row) => (
            <ListRow
              key={row.title}
              icon={row.icon}
              title={row.title}
              subtitle={row.subtitle}
              onPress={() => {
                Haptics.selectionAsync();
                router.push(row.href as never);
              }}
            />
          ))}
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
});
