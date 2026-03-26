import React from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius } from "../../src/theme";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { Card } from "../../src/components/ui/Card";

export default function CashflowScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Finance Tracker</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        <SectionHeader title="Balance" />
        <Card style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceValue}>$0.00</Text>
          <View style={styles.balanceRow}>
            <View style={styles.balanceStat}>
              <Text style={[styles.balanceStatValue, { color: colors.success }]}>$0.00</Text>
              <Text style={styles.balanceStatLabel}>Income</Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceStat}>
              <Text style={[styles.balanceStatValue, { color: colors.danger }]}>$0.00</Text>
              <Text style={styles.balanceStatLabel}>Expenses</Text>
            </View>
          </View>
        </Card>

        <SectionHeader title="Recent Transactions" />
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>No transactions yet</Text>
          <Text style={styles.emptySubtext}>Add your first transaction to start tracking</Text>
        </Card>

        <Pressable
          style={styles.actionBtn}
          onPress={() => Alert.alert("Coming Soon", "Transaction tracking will be available in a future update.")}
        >
          <Text style={styles.actionBtnText}>+ Add Transaction</Text>
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
  balanceCard: { alignItems: "center", paddingVertical: spacing["2xl"] },
  balanceLabel: { fontSize: 13, fontWeight: "700", color: colors.textSecondary, letterSpacing: 1, textTransform: "uppercase" },
  balanceValue: { fontSize: 40, fontWeight: "200", color: colors.text, marginTop: spacing.sm, fontVariant: ["tabular-nums"] },
  balanceRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.xl, gap: spacing.xl },
  balanceStat: { alignItems: "center" },
  balanceStatValue: { fontSize: 18, fontWeight: "700" },
  balanceStatLabel: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs },
  balanceDivider: { width: 1, height: 32, backgroundColor: colors.surfaceBorder },
  emptyCard: { alignItems: "center", paddingVertical: spacing["2xl"] },
  emptyText: { fontSize: 16, fontWeight: "600", color: colors.textSecondary },
  emptySubtext: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
  actionBtn: {
    backgroundColor: colors.money,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.xl,
  },
  actionBtnText: { fontSize: 16, fontWeight: "700", color: "#000" },
});
