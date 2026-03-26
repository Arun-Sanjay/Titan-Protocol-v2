import React from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius } from "../../src/theme";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { Card } from "../../src/components/ui/Card";

export default function DeepWorkScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Deep Work</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        <SectionHeader title="Earnings" />
        <Card style={styles.earningsCard}>
          <View style={styles.earningsRow}>
            <View style={styles.earningStat}>
              <Text style={styles.earningValue}>$0.00</Text>
              <Text style={styles.earningLabel}>Today</Text>
            </View>
            <View style={styles.earningDivider} />
            <View style={styles.earningStat}>
              <Text style={styles.earningValue}>$0.00</Text>
              <Text style={styles.earningLabel}>This Week</Text>
            </View>
            <View style={styles.earningDivider} />
            <View style={styles.earningStat}>
              <Text style={styles.earningValue}>$0.00</Text>
              <Text style={styles.earningLabel}>This Month</Text>
            </View>
          </View>
        </Card>

        <SectionHeader title="Today's Tasks" />
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>No tasks for today</Text>
          <Text style={styles.emptySubtext}>Add deep work tasks to track focused productivity</Text>
        </Card>

        <Pressable
          style={styles.actionBtn}
          onPress={() => Alert.alert("Coming Soon", "Deep work tracking will be available in a future update.")}
        >
          <Text style={styles.actionBtnText}>+ Add Task</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 24, color: colors.text },
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  body: { flex: 1, paddingHorizontal: spacing.lg },
  bodyContent: { paddingBottom: spacing["5xl"] },
  earningsCard: { paddingVertical: spacing["2xl"] },
  earningsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  earningStat: { alignItems: "center" },
  earningValue: { fontSize: 20, fontWeight: "800", color: colors.money, fontVariant: ["tabular-nums"] },
  earningLabel: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs },
  earningDivider: { width: 1, height: 32, backgroundColor: colors.surfaceBorder },
  emptyCard: { alignItems: "center", paddingVertical: spacing["2xl"] },
  emptyText: { fontSize: 16, fontWeight: "600", color: colors.textSecondary },
  emptySubtext: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
  actionBtn: {
    backgroundColor: colors.mind,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.xl,
  },
  actionBtnText: { fontSize: 16, fontWeight: "700", color: "#000" },
});
