import React, { useCallback, useMemo, useState } from "react";
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
import { FlashList } from "@shopify/flash-list";
import Animated, {
  FadeInDown,
  Easing,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius, fonts } from "../../src/theme";
import { Panel } from "../../src/components/ui/Panel";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { PageHeader } from "../../src/components/ui/PageHeader";
import { TitanProgress } from "../../src/components/ui/TitanProgress";
import { MetricValue } from "../../src/components/ui/MetricValue";
// Phase 4.1: pure helpers from barrel — no store import.
import {
  getBudgetStatus,
  getBudgetStatusColor,
  getDailyRemaining,
  type BudgetStatus,
} from "../../src/lib/budget-helpers";
import {
  EXPENSE_CATEGORIES,
  CATEGORY_ICONS,
  CATEGORY_COLORS,
} from "../../src/lib/money-helpers";
import { useBudgets, useCreateBudget, useDeleteBudget } from "../../src/hooks/queries/useBudgets";
import { useTransactions } from "../../src/hooks/queries/useMoney";
import type { Budget } from "../../src/services/budgets";
import type { MoneyTransaction } from "../../src/services/money";
import { getMonthKey, getMonthLabel } from "../../src/lib/date";
import { formatCurrency } from "../../src/lib/format";

// ─── Cloud-compatible month totals (uses date_key instead of dateISO) ───────

function computeCloudMonthTotals(
  txs: MoneyTransaction[],
  monthKey: string,
): {
  spent: number;
  earned: number;
  net: number;
  byCategory: Record<string, number>;
} {
  let spent = 0;
  let earned = 0;
  const byCategory: Record<string, number> = {};

  for (const tx of txs) {
    if (!tx.date_key.startsWith(monthKey)) continue;
    if (tx.type === "expense") {
      spent += tx.amount;
      byCategory[tx.category] = (byCategory[tx.category] ?? 0) + tx.amount;
    } else {
      earned += tx.amount;
    }
  }

  const r2 = (n: number) => Math.round(n * 100) / 100;
  for (const key of Object.keys(byCategory)) {
    byCategory[key] = r2(byCategory[key]);
  }

  return { spent: r2(spent), earned: r2(earned), net: r2(earned - spent), byCategory };
}

// ─── Month Navigation Component ─────────────────────────────────────────────

const MonthNav = React.memo(function MonthNav({
  label,
  onPrev,
  onNext,
  canGoNext,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  canGoNext: boolean;
}) {
  return (
    <View style={styles.monthNav}>
      <Pressable
        onPress={() => { onPrev(); Haptics.selectionAsync(); }}
        hitSlop={12}
      >
        <Ionicons name="chevron-back" size={22} color={colors.money} />
      </Pressable>
      <Text style={styles.monthLabelText}>{label}</Text>
      <Pressable
        onPress={() => { if (canGoNext) { onNext(); Haptics.selectionAsync(); } }}
        disabled={!canGoNext}
        hitSlop={12}
      >
        <Ionicons
          name="chevron-forward"
          size={22}
          color={canGoNext ? colors.money : colors.textMuted}
        />
      </Pressable>
    </View>
  );
});

// ─── Total Budget Overview ──────────────────────────────────────────────────

const TotalBudgetOverview = React.memo(function TotalBudgetOverview({
  totalSpent,
  totalBudget,
}: {
  totalSpent: number;
  totalBudget: number;
}) {
  const pct = totalBudget > 0 ? totalSpent / totalBudget : 0;
  const pctClamped = Math.min(pct, 1);
  const status = getBudgetStatus(totalBudget, totalSpent);
  const statusColor = getBudgetStatusColor(status);
  const remaining = totalBudget - totalSpent;

  return (
    <Panel style={styles.totalPanel} delay={50} tone="hero">
      <View style={styles.totalTopRow}>
        <MetricValue
          label="SPENT"
          value={formatCurrency(totalSpent)}
          size="md"
          color={statusColor}
        />
        <Text style={styles.totalOf}>of</Text>
        <MetricValue
          label="BUDGET"
          value={formatCurrency(totalBudget)}
          size="md"
          color={colors.money}
        />
      </View>

      <View style={styles.totalBarContainer}>
        <TitanProgress
          value={pctClamped * 100}
          color={statusColor}
          height={8}
        />
      </View>

      <View style={styles.totalFooter}>
        <Text style={[styles.totalPctText, { color: statusColor }]}>
          {Math.round(pct * 100)}% used
        </Text>
        <Text
          style={[
            styles.totalRemainingText,
            { color: remaining >= 0 ? colors.textSecondary : "#F87171" },
          ]}
        >
          {remaining >= 0
            ? `${formatCurrency(remaining)} remaining`
            : `${formatCurrency(Math.abs(remaining))} over budget`}
        </Text>
      </View>
    </Panel>
  );
});

// ─── Budget Card ────────────────────────────────────────────────────────────

type BudgetCardProps = {
  budget: Budget;
  spent: number;
  monthKey: string;
  onDelete: () => void;
  index: number;
};

const BudgetCard = React.memo(function BudgetCard({
  budget,
  spent,
  monthKey,
  onDelete,
  index,
}: BudgetCardProps) {
  const { category, monthly_limit } = budget;
  const pct = monthly_limit > 0 ? spent / monthly_limit : 0;
  const pctClamped = Math.min(pct, 1);
  const status = getBudgetStatus(spent, monthly_limit);
  const statusColor = getBudgetStatusColor(status);
  const remaining = monthly_limit - spent;
  const now = new Date();
  const dailyBudget = getDailyRemaining(monthly_limit, spent, now.getDate(), new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
  const icon = CATEGORY_ICONS[category] ?? "ellipsis-horizontal-circle-outline";
  const catColor = CATEGORY_COLORS[category] ?? colors.textMuted;
  const isOver = status === "over_budget";

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(400).easing(Easing.out(Easing.cubic))}>
      <Panel style={styles.budgetCard} glowColor={isOver ? "#F87171" : undefined}>
        {/* Header row */}
        <View style={styles.budgetHeader}>
          <View style={styles.budgetLeft}>
            <View style={[styles.budgetIcon, { backgroundColor: catColor + "18" }]}>
              <Ionicons name={icon as any} size={18} color={catColor} />
            </View>
            <View style={styles.budgetTitleCol}>
              <Text style={styles.budgetCategory}>{category}</Text>
              <Text style={styles.budgetMeta}>
                {formatCurrency(spent)}{" "}
                <Text style={{ color: colors.textMuted }}>of</Text>{" "}
                {formatCurrency(monthly_limit)}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={onDelete}
            hitSlop={12}
            style={styles.budgetDeleteBtn}
          >
            <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Progress Bar */}
        <TitanProgress
          value={pctClamped * 100}
          color={statusColor}
          height={6}
        />

        {/* Footer */}
        <View style={styles.budgetFooter}>
          <View style={styles.budgetFooterLeft}>
            <Text style={[styles.budgetPct, { color: statusColor }]}>
              {Math.round(pct * 100)}%
            </Text>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          </View>
          <View style={styles.budgetFooterRight}>
            <Text
              style={[
                styles.budgetRemaining,
                { color: remaining >= 0 ? colors.textSecondary : "#F87171" },
              ]}
            >
              {remaining >= 0
                ? `${formatCurrency(remaining)} left`
                : `${formatCurrency(Math.abs(remaining))} over`}
            </Text>
            {remaining > 0 && dailyBudget > 0 && (
              <Text style={styles.budgetDaily}>
                ~{formatCurrency(dailyBudget)}/day
              </Text>
            )}
          </View>
        </View>
      </Panel>
    </Animated.View>
  );
});

// ─── Add Budget Form ────────────────────────────────────────────────────────

const AddBudgetForm = React.memo(function AddBudgetForm({
  onClose,
  existingCategories,
}: {
  onClose: () => void;
  existingCategories: Set<string>;
}) {
  const createBudgetMut = useCreateBudget();

  const existingKey = useMemo(
    () => [...existingCategories].sort().join(","),
    [existingCategories],
  );

  const availableCategories = useMemo(
    () => EXPENSE_CATEGORIES.filter((c) => !existingCategories.has(c)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [existingKey],
  );

  const [category, setCategory] = useState(availableCategories[0] ?? "");
  const [limitStr, setLimitStr] = useState("");

  const handleLimitChange = useCallback((text: string) => {
    if (text.includes(".") && text.indexOf(".") !== text.lastIndexOf(".")) return;
    let cleaned = text.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts[1] && parts[1].length > 2) cleaned = parts[0] + "." + parts[1].slice(0, 2);
    setLimitStr(cleaned);
  }, []);

  const handleSave = useCallback(() => {
    if (!category) { Alert.alert("Missing", "Select a category"); return; }
    const parsed = parseFloat(limitStr);
    if (!Number.isFinite(parsed) || parsed <= 0) { Alert.alert("Invalid", "Enter a positive amount"); return; }
    if (parsed > 999999.99) { Alert.alert("Invalid", "Max budget is $999,999.99"); return; }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    createBudgetMut.mutate({ category, monthly_limit: Math.round(parsed * 100) / 100 });
    onClose();
  }, [category, limitStr, createBudgetMut, onClose]);

  if (availableCategories.length === 0) {
    return (
      <Animated.View entering={FadeInDown.duration(300).easing(Easing.out(Easing.cubic))}>
        <Panel style={styles.formPanel}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Add Budget</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          <View style={styles.allBudgetedContainer}>
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
            <Text style={styles.allBudgetedText}>
              All categories already have budgets.
            </Text>
          </View>
        </Panel>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(300).easing(Easing.out(Easing.cubic))}>
      <Panel style={styles.formPanel} glowColor={colors.money}>
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>Add Budget</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Category Chips */}
        <Text style={styles.fieldLabel}>CATEGORY</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {availableCategories.map((cat) => {
            const active = category === cat;
            const catColor = CATEGORY_COLORS[cat] ?? colors.textMuted;
            return (
              <Pressable
                key={cat}
                style={[
                  styles.chip,
                  active && { backgroundColor: catColor, borderColor: catColor },
                ]}
                onPress={() => { setCategory(cat); Haptics.selectionAsync(); }}
              >
                <Ionicons
                  name={(CATEGORY_ICONS[cat] ?? "ellipsis-horizontal-circle-outline") as any}
                  size={14}
                  color={active ? "#000" : catColor}
                />
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Monthly Limit */}
        <Text style={styles.fieldLabel}>MONTHLY LIMIT</Text>
        <View style={[styles.limitRow, { borderColor: colors.money + "40" }]}>
          <Text style={[styles.limitCurrency, { color: colors.money }]}>$</Text>
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
          <Ionicons name="add" size={18} color="#000" />
          <Text style={styles.saveBtnText}>Create Budget</Text>
        </Pressable>
      </Panel>
    </Animated.View>
  );
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function BudgetsScreen() {
  const router = useRouter();
  const { data: budgets = [] } = useBudgets();
  const deleteBudgetMut = useDeleteBudget();
  const { data: transactions = [] } = useTransactions();
  const [showForm, setShowForm] = useState(false);

  // Month navigation
  const [monthOffset, setMonthOffset] = useState(0);
  const currentMonth = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return getMonthKey(d);
  }, [monthOffset]);
  const monthLabel = useMemo(() => getMonthLabel(currentMonth), [currentMonth]);

  // No load() needed — React Query auto-fetches

  const monthTotals = useMemo(
    () => computeCloudMonthTotals(transactions, currentMonth),
    [transactions, currentMonth],
  );

  const existingCategories = useMemo(
    () => new Set(budgets.map((b) => b.category)),
    [budgets],
  );

  // Total budget vs total spent (only for budgeted categories)
  const totalBudget = useMemo(
    () => budgets.reduce((sum, b) => sum + b.monthly_limit, 0),
    [budgets],
  );
  const totalBudgeted = useMemo(
    () =>
      budgets.reduce(
        (sum, b) => sum + (monthTotals.byCategory[b.category] ?? 0),
        0,
      ),
    [budgets, monthTotals.byCategory],
  );

  // Sort budgets: over-budget first, then by percentage descending
  const sortedBudgets = useMemo(() => {
    return [...budgets].sort((a, b) => {
      const aSpent = monthTotals.byCategory[a.category] ?? 0;
      const bSpent = monthTotals.byCategory[b.category] ?? 0;
      const aPct = a.monthly_limit > 0 ? aSpent / a.monthly_limit : 0;
      const bPct = b.monthly_limit > 0 ? bSpent / b.monthly_limit : 0;

      // Over-budget items first
      const aOver = aPct > 1 ? 1 : 0;
      const bOver = bPct > 1 ? 1 : 0;
      if (aOver !== bOver) return bOver - aOver;

      // Then by percentage descending
      return bPct - aPct;
    });
  }, [budgets, monthTotals.byCategory]);

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert("Delete Budget", "Remove this budget?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            deleteBudgetMut.mutate(id);
          },
        },
      ]);
    },
    [deleteBudgetMut],
  );

  const renderBudgetCard = useCallback(
    ({ item, index }: { item: Budget; index: number }) => (
      <BudgetCard
        budget={item}
        spent={monthTotals.byCategory[item.category] ?? 0}
        monthKey={currentMonth}
        onDelete={() => handleDelete(item.id)}
        index={index}
      />
    ),
    [monthTotals.byCategory, currentMonth, handleDelete],
  );

  const budgetKeyExtractor = useCallback((item: Budget) => item.id, []);

  const listHeader = useMemo(
    () => (
      <>
        {/* Page Header */}
        <PageHeader kicker="MONEY ENGINE" title="Budgets" />

        {/* Month Navigation */}
        <MonthNav
          label={monthLabel}
          onPrev={() => setMonthOffset((o) => o - 1)}
          onNext={() => setMonthOffset((o) => o + 1)}
          canGoNext={monthOffset < 0}
        />

        {/* Total Budget Overview */}
        {budgets.length > 0 && (
          <TotalBudgetOverview
            totalSpent={totalBudgeted}
            totalBudget={totalBudget}
          />
        )}

        {/* Section Header */}
        <SectionHeader
          title="Monthly Budgets"
          right={`${budgets.length} active`}
          accentColor={colors.money}
        />
      </>
    ),
    [monthLabel, monthOffset, budgets.length, totalBudgeted, totalBudget],
  );

  const listEmpty = useMemo(
    () => (
      <Panel style={styles.emptyPanel}>
        <Ionicons name="pie-chart-outline" size={36} color={colors.textMuted} />
        <Text style={styles.emptyText}>No budgets set</Text>
        <Text style={styles.emptySubtext}>
          Create category budgets to track your spending limits and stay on target
        </Text>
      </Panel>
    ),
    [],
  );

  const listFooter = useMemo(
    () => (
      <>
        {showForm ? (
          <AddBudgetForm
            onClose={() => setShowForm(false)}
            existingCategories={existingCategories}
          />
        ) : (
          <Pressable
            style={styles.addBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowForm(true);
            }}
          >
            <Ionicons name="add" size={20} color="#000" />
            <Text style={styles.addBtnText}>Add Budget</Text>
          </Pressable>
        )}

        {/* Unbudgeted spending notice */}
        {budgets.length > 0 && monthTotals.spent > totalBudgeted && (
          <Animated.View entering={FadeInDown.delay(200).duration(400).easing(Easing.out(Easing.cubic))}>
            <Panel style={styles.unbudgetedPanel} tone="subtle">
              <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
              <View style={styles.unbudgetedInfo}>
                <Text style={styles.unbudgetedTitle}>Unbudgeted Spending</Text>
                <Text style={styles.unbudgetedAmount}>
                  {formatCurrency(Math.round((monthTotals.spent - totalBudgeted) * 100) / 100)} spent in categories without budgets
                </Text>
              </View>
            </Panel>
          </Animated.View>
        )}
      </>
    ),
    [showForm, existingCategories, budgets.length, monthTotals.spent, totalBudgeted],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Ionicons name="pie-chart-outline" size={18} color={colors.money} />
          <Text style={styles.headerTitle}>Budgets</Text>
        </View>
        <View style={{ width: 48 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlashList
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          data={sortedBudgets}
          keyExtractor={budgetKeyExtractor}
          renderItem={renderBudgetCard}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          ListFooterComponent={listFooter}
          ItemSeparatorComponent={BudgetSeparator}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Separator ───────────────────────────────────────────────────────────────

const BudgetSeparator = React.memo(function BudgetSeparator() {
  return <View style={styles.budgetSeparator} />;
});

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
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
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
    gap: spacing.xl,
    paddingVertical: spacing.md,
  },
  monthLabelText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    minWidth: 160,
    textAlign: "center",
    letterSpacing: 0.5,
  },

  // ── Total Overview ──
  totalPanel: {
    paddingVertical: spacing["2xl"],
    paddingHorizontal: spacing.xl,
  },
  totalTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
  },
  totalOf: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: "500",
    marginTop: -spacing.lg,
  },
  totalBarContainer: {
    marginTop: spacing.xl,
  },
  totalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
  },
  totalPctText: {
    ...fonts.mono,
    fontSize: 14,
    fontWeight: "700",
  },
  totalRemainingText: {
    fontSize: 13,
    fontWeight: "500",
  },

  // ── Budget Cards ──
  budgetSeparator: {
    height: spacing.md,
  },
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
    flex: 1,
  },
  budgetIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  budgetTitleCol: {
    flex: 1,
  },
  budgetCategory: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  budgetMeta: {
    ...fonts.mono,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  budgetDeleteBtn: {
    padding: spacing.sm,
  },
  budgetFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  budgetFooterLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  budgetFooterRight: {
    alignItems: "flex-end",
  },
  budgetPct: {
    ...fonts.mono,
    fontSize: 14,
    fontWeight: "700",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  budgetRemaining: {
    fontSize: 13,
    fontWeight: "500",
  },
  budgetDaily: {
    ...fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
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
  allBudgetedContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  allBudgetedText: {
    fontSize: 14,
    color: colors.textSecondary,
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
    flexDirection: "row",
    backgroundColor: colors.money,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
  },

  // ── Unbudgeted Notice ──
  unbudgetedPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  unbudgetedInfo: {
    flex: 1,
  },
  unbudgetedTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.warning,
  },
  unbudgetedAmount: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
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
    paddingHorizontal: spacing.xl,
  },
});
