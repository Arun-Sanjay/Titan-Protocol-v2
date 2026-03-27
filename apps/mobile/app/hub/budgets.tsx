import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius, fonts } from "../../src/theme";
import { Panel } from "../../src/components/ui/Panel";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { useBudgetStore } from "../../src/stores/useBudgetStore";
import {
  useMoneyStore,
  computeMonthTotals,
  EXPENSE_CATEGORIES,
} from "../../src/stores/useMoneyStore";
import { getMonthKey, getMonthLabel } from "../../src/lib/date";
import { formatCurrency } from "../../src/lib/format";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBarColor(pct: number): string {
  if (pct > 1) return colors.danger;
  if (pct >= 0.8) return colors.warning;
  return colors.success;
}

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Food: "fast-food-outline",
  Transport: "car-outline",
  Shopping: "bag-outline",
  Bills: "receipt-outline",
  Health: "heart-outline",
  Entertainment: "game-controller-outline",
  Education: "school-outline",
  Other: "ellipsis-horizontal-circle-outline",
};

// ─── Budget Card ─────────────────────────────────────────────────────────────

function BudgetCard({
  category,
  limit,
  spent,
  onDelete,
}: {
  category: string;
  limit: number;
  spent: number;
  onDelete: () => void;
}) {
  const pct = limit > 0 ? spent / limit : 0;
  const barColor = getBarColor(pct);
  const remaining = limit - spent;
  const icon = CATEGORY_ICONS[category] ?? "ellipsis-horizontal-circle-outline";

  return (
    <Panel style={styles.budgetCard}>
      <View style={styles.budgetHeader}>
        <View style={styles.budgetLeft}>
          <View style={[styles.budgetIcon, { backgroundColor: barColor + "18" }]}>
            <Ionicons name={icon} size={18} color={barColor} />
          </View>
          <View>
            <Text style={styles.budgetCategory}>{category}</Text>
            <Text style={styles.budgetMeta}>
              {formatCurrency(spent)} of {formatCurrency(limit)}
            </Text>
          </View>
        </View>
        <Pressable onPress={onDelete} hitSlop={12}>
          <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Progress Bar */}
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            {
              width: `${Math.min(pct * 100, 100)}%`,
              backgroundColor: barColor,
            },
          ]}
        />
      </View>

      {/* Footer */}
      <View style={styles.budgetFooter}>
        <Text style={[styles.budgetPct, { color: barColor }]}>
          {Math.round(pct * 100)}%
        </Text>
        <Text
          style={[
            styles.budgetRemaining,
            { color: remaining >= 0 ? colors.textSecondary : colors.danger },
          ]}
        >
          {remaining >= 0
            ? `${formatCurrency(remaining)} remaining`
            : `${formatCurrency(Math.abs(remaining))} over budget`}
        </Text>
      </View>
    </Panel>
  );
}

// ─── Add Budget Form ─────────────────────────────────────────────────────────

function AddBudgetForm({
  onClose,
  existingCategories,
}: {
  onClose: () => void;
  existingCategories: Set<string>;
}) {
  const addBudget = useBudgetStore((s) => s.addBudget);

  const availableCategories = useMemo(
    () => EXPENSE_CATEGORIES.filter((c) => !existingCategories.has(c)),
    [existingCategories]
  );

  const [category, setCategory] = useState(availableCategories[0] ?? "");
  const [limitStr, setLimitStr] = useState("");

  const handleLimitChange = useCallback((text: string) => {
    // Reject multiple decimal points
    if (text.includes(".") && text.indexOf(".") !== text.lastIndexOf(".")) return;
    setLimitStr(text);
  }, []);

  const handleSave = () => {
    const parsed = parseFloat(limitStr);
    if (!category || !Number.isFinite(parsed) || parsed <= 0 || parsed > 999999.99) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addBudget(category, Math.round(parsed * 100) / 100);
    onClose();
  };

  if (availableCategories.length === 0) {
    return (
      <Panel style={styles.formPanel}>
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>Add Budget</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>
        </View>
        <Text style={styles.emptyFormText}>
          All categories already have budgets.
        </Text>
      </Panel>
    );
  }

  return (
    <Panel style={styles.formPanel}>
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>Add Budget</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={22} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Category Chips */}
      <Text style={styles.fieldLabel}>Category</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {availableCategories.map((cat) => {
          const active = category === cat;
          return (
            <Pressable
              key={cat}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => {
                setCategory(cat);
                Haptics.selectionAsync();
              }}
            >
              <Ionicons
                name={CATEGORY_ICONS[cat] ?? "ellipsis-horizontal-circle-outline"}
                size={14}
                color={active ? "#000" : colors.textSecondary}
              />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {cat}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Monthly Limit */}
      <Text style={styles.fieldLabel}>Monthly Limit</Text>
      <View style={styles.limitRow}>
        <Text style={styles.limitCurrency}>$</Text>
        <TextInput
          style={styles.limitInput}
          placeholder="0.00"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          value={limitStr}
          onChangeText={handleLimitChange}
          autoFocus
        />
      </View>

      {/* Save */}
      <Pressable style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveBtnText}>Create Budget</Text>
      </Pressable>
    </Panel>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function BudgetsScreen() {
  const router = useRouter();
  const budgets = useBudgetStore((s) => s.budgets);
  const loadBudgets = useBudgetStore((s) => s.load);
  const deleteBudget = useBudgetStore((s) => s.deleteBudget);
  const transactions = useMoneyStore((s) => s.transactions);
  const loadTxs = useMoneyStore((s) => s.load);
  const [showForm, setShowForm] = useState(false);

  // Month navigation
  const [monthOffset, setMonthOffset] = useState(0);
  const currentMonth = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return getMonthKey(d);
  }, [monthOffset]);
  const monthLabel = useMemo(() => getMonthLabel(currentMonth), [currentMonth]);

  useEffect(() => {
    loadBudgets();
    loadTxs();
  }, [loadBudgets, loadTxs]);

  const monthTotals = useMemo(
    () => computeMonthTotals(transactions, currentMonth),
    [transactions, currentMonth]
  );

  const existingCategories = useMemo(
    () => new Set(budgets.map((b) => b.category)),
    [budgets]
  );

  // Total budget vs total spent
  const totalBudget = useMemo(
    () => budgets.reduce((sum, b) => sum + b.monthlyLimit, 0),
    [budgets]
  );
  const totalBudgeted = useMemo(
    () =>
      budgets.reduce(
        (sum, b) => sum + (monthTotals.byCategory[b.category] ?? 0),
        0
      ),
    [budgets, monthTotals.byCategory]
  );

  const totalPct = totalBudget > 0 ? totalBudgeted / totalBudget : 0;

  const handleDelete = useCallback(
    (id: number) => {
      Alert.alert("Delete Budget", "Are you sure you want to delete this budget?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            deleteBudget(id);
          },
        },
      ]);
    },
    [deleteBudget]
  );

  const handleOpenForm = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowForm(true);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Budgets</Text>
        <View style={{ width: 48 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Month Navigation */}
          <View style={styles.monthNav}>
            <Pressable onPress={() => setMonthOffset((o) => o - 1)}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
            <Text style={styles.monthLabelText}>{monthLabel}</Text>
            <Pressable
              onPress={() => {
                if (monthOffset < 0) setMonthOffset((o) => o + 1);
              }}
              disabled={monthOffset >= 0}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={monthOffset >= 0 ? colors.textMuted : colors.text}
              />
            </Pressable>
          </View>

          {/* Total Summary */}
          {budgets.length > 0 && (
            <Panel style={styles.totalPanel}>
              <View style={styles.totalRow}>
                <View style={styles.totalStat}>
                  <Text style={[styles.totalValue, { color: colors.danger }]}>
                    {formatCurrency(totalBudgeted)}
                  </Text>
                  <Text style={styles.totalLabel}>Spent</Text>
                </View>
                <View style={styles.totalDivider} />
                <View style={styles.totalStat}>
                  <Text style={[styles.totalValue, { color: colors.money }]}>
                    {formatCurrency(totalBudget)}
                  </Text>
                  <Text style={styles.totalLabel}>Budget</Text>
                </View>
              </View>
              <View style={styles.totalBarTrack}>
                <View
                  style={[
                    styles.totalBarFill,
                    {
                      width: `${Math.min(totalPct * 100, 100)}%`,
                      backgroundColor: getBarColor(totalPct),
                    },
                  ]}
                />
              </View>
              <Text
                style={[styles.totalPct, { color: getBarColor(totalPct) }]}
              >
                {Math.round(totalPct * 100)}% of total budget used
              </Text>
            </Panel>
          )}

          {/* Budget Cards */}
          <SectionHeader
            title="Monthly Budgets"
            right={`${budgets.length} active`}
          />

          {budgets.length === 0 ? (
            <Panel style={styles.emptyPanel}>
              <Ionicons
                name="pie-chart-outline"
                size={32}
                color={colors.textMuted}
              />
              <Text style={styles.emptyText}>No budgets set</Text>
              <Text style={styles.emptySubtext}>
                Create category budgets to track your spending limits
              </Text>
            </Panel>
          ) : (
            <View style={styles.cardList}>
              {budgets.map((budget) => (
                <BudgetCard
                  key={budget.id}
                  category={budget.category}
                  limit={budget.monthlyLimit}
                  spent={monthTotals.byCategory[budget.category] ?? 0}
                  onDelete={() => handleDelete(budget.id)}
                />
              ))}
            </View>
          )}

          {/* Add Budget */}
          {showForm ? (
            <AddBudgetForm
              onClose={() => setShowForm(false)}
              existingCategories={existingCategories}
            />
          ) : (
            <Pressable style={styles.addBtn} onPress={handleOpenForm}>
              <Ionicons name="add" size={20} color="#000" />
              <Text style={styles.addBtnText}>Add Budget</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  body: { flex: 1, paddingHorizontal: spacing.lg },
  bodyContent: { paddingBottom: spacing["5xl"] },

  // ── Month Navigation ──
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  monthLabelText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    minWidth: 160,
    textAlign: "center",
  },

  // ── Total Summary ──
  totalPanel: {
    alignItems: "center",
    paddingVertical: spacing["2xl"],
    marginTop: spacing.sm,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xl,
  },
  totalStat: { alignItems: "center" },
  totalValue: {
    ...fonts.mono,
    fontSize: 22,
    fontWeight: "700",
  },
  totalLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  totalDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.surfaceBorder,
  },
  totalBarTrack: {
    width: "100%",
    height: 8,
    backgroundColor: colors.inputBg,
    borderRadius: radius.full,
    overflow: "hidden",
    marginTop: spacing.lg,
  },
  totalBarFill: {
    height: 8,
    borderRadius: radius.full,
  },
  totalPct: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: spacing.sm,
  },

  // ── Budget Cards ──
  cardList: { gap: spacing.md },
  budgetCard: {
    gap: spacing.md,
  },
  budgetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  budgetLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  budgetIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  budgetCategory: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  budgetMeta: {
    ...fonts.mono,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  barTrack: {
    height: 6,
    backgroundColor: colors.inputBg,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  barFill: {
    height: 6,
    borderRadius: radius.full,
  },
  budgetFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  budgetPct: {
    ...fonts.mono,
    fontSize: 13,
    fontWeight: "700",
  },
  budgetRemaining: {
    fontSize: 12,
  },

  // ── Add Button ──
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.money,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  addBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
  },

  // ── Add Form ──
  formPanel: {
    marginTop: spacing.xl,
    gap: spacing.lg,
  },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  formTitle: {
    ...fonts.heading,
    fontSize: 17,
  },
  emptyFormText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
  fieldLabel: {
    ...fonts.kicker,
    color: colors.textMuted,
    marginBottom: -spacing.sm,
  },
  chipRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  chipActive: {
    backgroundColor: colors.money,
    borderColor: colors.money,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: "#000",
  },
  limitRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: spacing.lg,
  },
  limitCurrency: {
    ...fonts.monoValue,
    fontSize: 24,
    color: colors.textMuted,
  },
  limitInput: {
    flex: 1,
    ...fonts.monoValue,
    fontSize: 24,
    color: colors.text,
    paddingVertical: spacing.md,
    marginLeft: spacing.sm,
  },
  saveBtn: {
    backgroundColor: colors.money,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
  },

  // ── Empty State ──
  emptyPanel: {
    alignItems: "center",
    paddingVertical: spacing["3xl"],
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
  },
});
