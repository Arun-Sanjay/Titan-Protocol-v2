import React from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius } from "../../src/theme";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { Card } from "../../src/components/ui/Card";

export default function BudgetsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Budgets</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        <SectionHeader title="Monthly Budgets" />
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyTitle}>Set up your first budget</Text>
          <Text style={styles.emptySubtext}>
            Create budget categories to track your spending and stay on target each month.
          </Text>
          <Pressable
            style={styles.actionBtn}
            onPress={() => Alert.alert("Coming Soon", "Budget management will be available in a future update.")}
          >
            <Text style={styles.actionBtnText}>Create Budget</Text>
          </Pressable>
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
  emptyCard: { alignItems: "center", paddingVertical: spacing["3xl"], paddingHorizontal: spacing.xl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.lg },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  emptySubtext: { fontSize: 14, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm, lineHeight: 20 },
  actionBtn: {
    backgroundColor: colors.money,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing["3xl"],
    marginTop: spacing.xl,
  },
  actionBtnText: { fontSize: 16, fontWeight: "700", color: "#000" },
});
