import React from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius } from "../../src/theme";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { Card } from "../../src/components/ui/Card";

const TARGETS = [
  { label: "Calories", current: 0, goal: 2000, unit: "cal", color: colors.warning },
  { label: "Protein", current: 0, goal: 150, unit: "g", color: colors.danger },
  { label: "Carbs", current: 0, goal: 250, unit: "g", color: colors.primary },
  { label: "Fat", current: 0, goal: 65, unit: "g", color: colors.money },
];

export default function NutritionScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Nutrition</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        <SectionHeader title="Daily Targets" />
        {TARGETS.map((t) => {
          const pct = t.goal > 0 ? Math.min(t.current / t.goal, 1) : 0;
          return (
            <Card key={t.label} style={styles.targetCard}>
              <View style={styles.targetRow}>
                <Text style={styles.targetLabel}>{t.label}</Text>
                <Text style={styles.targetValue}>
                  {t.current}
                  <Text style={styles.targetUnit}> / {t.goal}{t.unit}</Text>
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: t.color }]} />
              </View>
            </Card>
          );
        })}

        <SectionHeader title="Meals" />
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>No meals logged today</Text>
          <Text style={styles.emptySubtext}>Tap below to add your first meal</Text>
        </Card>

        <Pressable
          style={styles.actionBtn}
          onPress={() => Alert.alert("Coming Soon", "Meal logging will be available in a future update.")}
        >
          <Text style={styles.actionBtnText}>+ Add Meal</Text>
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
  targetCard: { marginBottom: spacing.md },
  targetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  targetLabel: { fontSize: 16, fontWeight: "600", color: colors.text },
  targetValue: { fontSize: 16, fontWeight: "700", color: colors.text },
  targetUnit: { fontSize: 13, fontWeight: "400", color: colors.textSecondary },
  progressTrack: {
    height: 8,
    backgroundColor: colors.surfaceBorder,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    borderRadius: radius.full,
    minWidth: 0,
  },
  emptyCard: { alignItems: "center", paddingVertical: spacing["2xl"] },
  emptyText: { fontSize: 16, fontWeight: "600", color: colors.textSecondary },
  emptySubtext: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
  actionBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  actionBtnText: { fontSize: 16, fontWeight: "700", color: "#000" },
});
