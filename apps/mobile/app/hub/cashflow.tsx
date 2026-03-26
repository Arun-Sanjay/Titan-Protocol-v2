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
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius, fonts } from "../../src/theme";
import { Panel } from "../../src/components/ui/Panel";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import {
  useMoneyStore,
  computeMonthTotals,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type MoneyTx,
} from "../../src/stores/useMoneyStore";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTodayKey(): string {
  const today = new Date();
  return today.toISOString().slice(0, 10);
}

function getMonthKey(): string {
  const today = new Date();
  return today.toISOString().slice(0, 7);
}

function formatCurrency(amount: number): string {
  return "$" + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatDate(dateISO: string): string {
  const d = new Date(dateISO + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
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
  Salary: "cash-outline",
  Freelance: "laptop-outline",
  Investment: "trending-up-outline",
  Gift: "gift-outline",
  Refund: "arrow-undo-outline",
};

const CATEGORY_COLORS: Record<string, string> = {
  Food: "#f97316",
  Transport: "#3b82f6",
  Shopping: "#ec4899",
  Bills: "#8b5cf6",
  Health: "#ef4444",
  Entertainment: "#06b6d4",
  Education: "#14b8a6",
  Other: "#6b7280",
};

// ─── Add Form Component ──────────────────────────────────────────────────────

function AddTransactionForm({ onClose }: { onClose: () => void }) {
  const addTransaction = useMoneyStore((s) => s.addTransaction);
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [note, setNote] = useState("");

  const categories = type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  // Reset category when type changes
  useEffect(() => {
    setCategory(type === "expense" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]);
  }, [type]);

  const handleSave = () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addTransaction({
      dateISO: getTodayKey(),
      type,
      amount: parsed,
      category,
      bucket: null,
      note: note.trim(),
    });
    onClose();
  };

  return (
    <Panel style={styles.formPanel}>
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>New Transaction</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={22} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Type Toggle */}
      <View style={styles.typeToggle}>
        <Pressable
          style={[styles.typeBtn, type === "expense" && styles.typeBtnActiveExpense]}
          onPress={() => { setType("expense"); Haptics.selectionAsync(); }}
        >
          <Text
            style={[
              styles.typeBtnText,
              type === "expense" && styles.typeBtnTextActive,
            ]}
          >
            Expense
          </Text>
        </Pressable>
        <Pressable
          style={[styles.typeBtn, type === "income" && styles.typeBtnActiveIncome]}
          onPress={() => { setType("income"); Haptics.selectionAsync(); }}
        >
          <Text
            style={[
              styles.typeBtnText,
              type === "income" && styles.typeBtnTextActive,
            ]}
          >
            Income
          </Text>
        </Pressable>
      </View>

      {/* Amount */}
      <View style={styles.amountRow}>
        <Text style={styles.amountCurrency}>$</Text>
        <TextInput
          style={styles.amountInput}
          placeholder="0.00"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
          autoFocus
        />
      </View>

      {/* Category Chips */}
      <Text style={styles.fieldLabel}>Category</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {categories.map((cat) => {
          const active = category === cat;
          return (
            <Pressable
              key={cat}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => { setCategory(cat); Haptics.selectionAsync(); }}
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

      {/* Note */}
      <TextInput
        style={styles.noteInput}
        placeholder="Add a note (optional)"
        placeholderTextColor={colors.textMuted}
        value={note}
        onChangeText={setNote}
        returnKeyType="done"
      />

      {/* Save */}
      <Pressable
        style={[
          styles.saveBtn,
          { backgroundColor: type === "expense" ? colors.danger : colors.success },
        ]}
        onPress={handleSave}
      >
        <Text style={styles.saveBtnText}>
          Save {type === "expense" ? "Expense" : "Income"}
        </Text>
      </Pressable>
    </Panel>
  );
}

// ─── Category Bar Component ──────────────────────────────────────────────────

function CategoryBar({
  category,
  amount,
  maxAmount,
}: {
  category: string;
  amount: number;
  maxAmount: number;
}) {
  const pct = maxAmount > 0 ? Math.min(amount / maxAmount, 1) : 0;
  const barColor = CATEGORY_COLORS[category] ?? colors.textMuted;

  return (
    <View style={styles.catBarRow}>
      <View style={styles.catBarLabelRow}>
        <Ionicons
          name={CATEGORY_ICONS[category] ?? "ellipsis-horizontal-circle-outline"}
          size={14}
          color={barColor}
        />
        <Text style={styles.catBarLabel}>{category}</Text>
        <Text style={styles.catBarAmount}>{formatCurrency(amount)}</Text>
      </View>
      <View style={styles.catBarTrack}>
        <View
          style={[styles.catBarFill, { width: `${pct * 100}%`, backgroundColor: barColor }]}
        />
      </View>
    </View>
  );
}

// ─── Transaction Row ─────────────────────────────────────────────────────────

function TransactionRow({ tx }: { tx: MoneyTx }) {
  const deleteTransaction = useMoneyStore((s) => s.deleteTransaction);

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    deleteTransaction(tx.id);
  };

  const icon = CATEGORY_ICONS[tx.category] ?? "ellipsis-horizontal-circle-outline";
  const isExpense = tx.type === "expense";

  return (
    <View style={styles.txRow}>
      <View style={[styles.txIcon, { backgroundColor: isExpense ? colors.dangerDim : colors.successDim }]}>
        <Ionicons
          name={icon}
          size={18}
          color={isExpense ? colors.danger : colors.success}
        />
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txCategory} numberOfLines={1}>
          {tx.category}
        </Text>
        {tx.note ? (
          <Text style={styles.txNote} numberOfLines={1}>
            {tx.note}
          </Text>
        ) : null}
      </View>
      <Text
        style={[
          styles.txAmount,
          { color: isExpense ? colors.danger : colors.success },
        ]}
      >
        {isExpense ? "-" : "+"}
        {formatCurrency(tx.amount)}
      </Text>
      <Pressable onPress={handleDelete} hitSlop={12} style={styles.txDeleteBtn}>
        <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function CashflowScreen() {
  const router = useRouter();
  const { transactions, load } = useMoneyStore();
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const monthKey = getMonthKey();
  const monthTotals = useMemo(
    () => computeMonthTotals(transactions, monthKey),
    [transactions, monthKey]
  );

  // Sort categories by amount descending
  const sortedCategories = useMemo(() => {
    return Object.entries(monthTotals.byCategory)
      .sort(([, a], [, b]) => b - a);
  }, [monthTotals.byCategory]);

  const maxCategoryAmount = sortedCategories.length > 0 ? sortedCategories[0][1] : 0;

  // Group transactions by date (most recent first)
  const groupedByDate = useMemo(() => {
    const sorted = [...transactions].sort(
      (a, b) => b.dateISO.localeCompare(a.dateISO) || b.id - a.id
    );
    const groups: { date: string; txs: MoneyTx[] }[] = [];
    let currentDate = "";
    for (const tx of sorted) {
      if (tx.dateISO !== currentDate) {
        currentDate = tx.dateISO;
        groups.push({ date: currentDate, txs: [] });
      }
      groups[groups.length - 1].txs.push(tx);
    }
    return groups;
  }, [transactions]);

  const monthLabel = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, []);

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
        <Text style={styles.headerTitle}>Finance Tracker</Text>
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
          {/* Monthly Summary */}
          <Panel style={styles.summaryPanel}>
            <Text style={styles.summaryMonth}>{monthLabel}</Text>
            <Text
              style={[
                styles.summaryNet,
                {
                  color:
                    monthTotals.net >= 0 ? colors.success : colors.danger,
                },
              ]}
            >
              {monthTotals.net >= 0 ? "+" : ""}
              {formatCurrency(Math.abs(monthTotals.net))}
            </Text>
            <Text style={styles.summaryNetLabel}>Net</Text>

            <View style={styles.summaryRow}>
              <View style={styles.summaryStat}>
                <Text style={[styles.summaryValue, { color: colors.success }]}>
                  {formatCurrency(monthTotals.earned)}
                </Text>
                <Text style={styles.summaryLabel}>Earned</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryStat}>
                <Text style={[styles.summaryValue, { color: colors.danger }]}>
                  {formatCurrency(monthTotals.spent)}
                </Text>
                <Text style={styles.summaryLabel}>Spent</Text>
              </View>
            </View>
          </Panel>

          {/* Category Breakdown */}
          {sortedCategories.length > 0 && (
            <>
              <SectionHeader
                title="Spending by Category"
                right={formatCurrency(monthTotals.spent)}
              />
              <Panel style={styles.catPanel}>
                {sortedCategories.map(([cat, amount]) => (
                  <CategoryBar
                    key={cat}
                    category={cat}
                    amount={amount}
                    maxAmount={maxCategoryAmount}
                  />
                ))}
              </Panel>
            </>
          )}

          {/* Add Transaction */}
          {showForm ? (
            <AddTransactionForm onClose={() => setShowForm(false)} />
          ) : (
            <Pressable style={styles.addBtn} onPress={handleOpenForm}>
              <Ionicons name="add" size={20} color="#000" />
              <Text style={styles.addBtnText}>Add Transaction</Text>
            </Pressable>
          )}

          {/* Transaction List */}
          <SectionHeader
            title="Transactions"
            right={`${transactions.length} total`}
          />

          {groupedByDate.length === 0 ? (
            <Panel style={styles.emptyPanel}>
              <Ionicons
                name="wallet-outline"
                size={32}
                color={colors.textMuted}
              />
              <Text style={styles.emptyText}>No transactions yet</Text>
              <Text style={styles.emptySubtext}>
                Tap "Add Transaction" to start tracking
              </Text>
            </Panel>
          ) : (
            groupedByDate.map((group) => (
              <View key={group.date} style={styles.dateGroup}>
                <Text style={styles.dateLabel}>{formatDate(group.date)}</Text>
                <Panel style={styles.txPanel}>
                  {group.txs.map((tx, i) => (
                    <React.Fragment key={tx.id}>
                      {i > 0 && <View style={styles.txDivider} />}
                      <TransactionRow tx={tx} />
                    </React.Fragment>
                  ))}
                </Panel>
              </View>
            ))
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

  // ── Summary Panel ──
  summaryPanel: {
    alignItems: "center",
    paddingVertical: spacing["2xl"],
    marginTop: spacing.md,
  },
  summaryMonth: {
    ...fonts.kicker,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  summaryNet: {
    ...fonts.monoValue,
    fontSize: 36,
  },
  summaryNetLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xl,
    gap: spacing.xl,
  },
  summaryStat: { alignItems: "center" },
  summaryValue: {
    ...fonts.mono,
    fontSize: 18,
    fontWeight: "700",
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.surfaceBorder,
  },

  // ── Category Bars ──
  catPanel: { gap: spacing.md },
  catBarRow: { gap: spacing.xs },
  catBarLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  catBarLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    flex: 1,
  },
  catBarAmount: {
    ...fonts.mono,
    fontSize: 13,
    color: colors.textSecondary,
  },
  catBarTrack: {
    height: 6,
    backgroundColor: colors.inputBg,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  catBarFill: {
    height: 6,
    borderRadius: radius.full,
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

  // ── Inline Form ──
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
  typeToggle: {
    flexDirection: "row",
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    padding: 3,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: radius.sm,
  },
  typeBtnActiveExpense: {
    backgroundColor: colors.danger,
  },
  typeBtnActiveIncome: {
    backgroundColor: colors.success,
  },
  typeBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textMuted,
  },
  typeBtnTextActive: {
    color: "#000",
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: spacing.lg,
  },
  amountCurrency: {
    ...fonts.monoValue,
    fontSize: 28,
    color: colors.textMuted,
  },
  amountInput: {
    flex: 1,
    ...fonts.monoValue,
    fontSize: 28,
    color: colors.text,
    paddingVertical: spacing.md,
    marginLeft: spacing.sm,
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
  noteInput: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  saveBtn: {
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
  },

  // ── Transaction List ──
  dateGroup: { marginTop: spacing.md },
  dateLabel: {
    ...fonts.kicker,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  txPanel: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  txInfo: {
    flex: 1,
  },
  txCategory: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  txNote: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  txAmount: {
    ...fonts.mono,
    fontSize: 15,
    fontWeight: "700",
  },
  txDeleteBtn: {
    padding: spacing.xs,
  },
  txDivider: {
    height: 1,
    backgroundColor: colors.surfaceBorder,
    marginLeft: 36 + spacing.md,
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
  },
});
