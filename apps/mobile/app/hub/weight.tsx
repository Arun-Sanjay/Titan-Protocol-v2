import React from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius } from "../../src/theme";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { Card } from "../../src/components/ui/Card";

export default function WeightScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Weight Tracker</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        <SectionHeader title="Current Weight" />
        <Card style={styles.weightCard}>
          <Text style={styles.weightValue}>--.-</Text>
          <Text style={styles.weightUnit}>lbs</Text>
          <Text style={styles.weightHint}>No weight logged yet</Text>
        </Card>

        <Pressable
          style={styles.actionBtn}
          onPress={() => Alert.alert("Coming Soon", "Weight logging will be available in a future update.")}
        >
          <Text style={styles.actionBtnText}>Log Weight</Text>
        </Pressable>

        <SectionHeader title="Recent Entries" />
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>No entries yet</Text>
          <Text style={styles.emptySubtext}>Log your first weight to start tracking progress</Text>
        </Card>
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
  weightCard: { alignItems: "center", paddingVertical: spacing["3xl"] },
  weightValue: { fontSize: 56, fontWeight: "200", color: colors.text, fontVariant: ["tabular-nums"] },
  weightUnit: { fontSize: 16, fontWeight: "600", color: colors.textSecondary, marginTop: spacing.xs },
  weightHint: { fontSize: 13, color: colors.textMuted, marginTop: spacing.md },
  actionBtn: {
    backgroundColor: colors.success,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.xl,
  },
  actionBtnText: { fontSize: 16, fontWeight: "700", color: "#000" },
  emptyCard: { alignItems: "center", paddingVertical: spacing["2xl"] },
  emptyText: { fontSize: 16, fontWeight: "600", color: colors.textSecondary },
  emptySubtext: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
});
