import React, { useCallback, useEffect, useMemo, useState } from "react";
// Note: useEffect is still needed for the type->category sync in AddTransactionForm
import {
  View,
  Text,
  ScrollView,
  SectionList,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import Animated, {
  FadeInDown,
  FadeInRight,
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
import {
  useMoneyStore,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  CATEGORY_ICONS,
  CATEGORY_COLORS,
  type MoneyLoan,
  type CategoryTotal,
} from "../../src/stores/useMoneyStore";
import {
  useTransactions,
  useCreateTransaction,
  useDeleteTransaction,
} from "../../src/hooks/queries/useMoney";
import type { MoneyTransaction } from "../../src/services/money";
import { getTodayKey, getMonthKey, getMonthLabel, addDays } from "../../src/lib/date";
import { formatCurrency, CURRENCIES, getSelectedCurrency, setSelectedCurrency, type CurrencyCode } from "../../src/lib/format";

// ─── Cloud-compatible helpers (use date_key instead of dateISO) ─────────────

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function computeCloudMonthTotals(
  txs: MoneyTransaction[],
  monthKey: string,
): { spent: number; earned: number; net: number; byCategory: Record<string, number> } {
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
  for (const key of Object.keys(byCategory)) {
    byCategory[key] = r2(byCategory[key]);
  }
  return { spent: r2(spent), earned: r2(earned), net: r2(earned - spent), byCategory };
}

function getCloudMonthTransactions(txs: MoneyTransaction[], monthKey: string): MoneyTransaction[] {
  return txs.filter((tx) => tx.date_key.startsWith(monthKey));
}

function getCloudCategoryTotals(txs: MoneyTransaction[], monthKey: string): CategoryTotal[] {
  const totals = computeCloudMonthTotals(txs, monthKey);
  const entries = Object.entries(totals.byCategory).sort(([, a], [, b]) => b - a);
  const totalSpent = totals.spent || 1;
  return entries.map(([category, total]) => ({
    category,
    total,
    percentage: r2((total / totalSpent) * 100),
    icon: CATEGORY_ICONS[category] ?? "ellipsis-horizontal-circle-outline",
    color: CATEGORY_COLORS[category] ?? "#6b7280",
  }));
}

function getCloudMonthComparison(txs: MoneyTransaction[], monthKey: string) {
  const current = computeCloudMonthTotals(txs, monthKey);
  const [yearStr, monthStr] = monthKey.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevKey = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
  const prev = computeCloudMonthTotals(txs, prevKey);
  return {
    earned: current.earned,
    spent: current.spent,
    net: current.net,
    prevEarned: prev.earned,
    prevSpent: prev.spent,
    prevNet: prev.net,
    earnedDelta: prev.earned > 0 ? r2(((current.earned - prev.earned) / prev.earned) * 100) : 0,
    spentDelta: prev.spent > 0 ? r2(((current.spent - prev.spent) / prev.spent) * 100) : 0,
    netDelta: prev.net !== 0 ? r2(((current.net - prev.net) / Math.abs(prev.net)) * 100) : 0,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EXPENSE_COLOR = "#F87171";
const INCOME_COLOR = colors.body; // #00FF88

function formatSectionDate(dateISO: string): string {
  const today = getTodayKey();
  const yesterday = addDays(today, -1);
  if (dateISO === today) return "Today";
  if (dateISO === yesterday) return "Yesterday";
  const d = new Date(dateISO + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function getDeltaLabel(delta: number): string {
  if (delta === 0) return "—";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(0)}%`;
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
      <Text style={styles.monthLabel}>{label}</Text>
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

// ─── Day Navigation Component ───────────────────────────────────────────────

const DayNav = React.memo(function DayNav({
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
      <Text style={styles.monthLabel}>{label}</Text>
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

// ─── View Mode Toggle ───────────────────────────────────────────────────────

const ViewModeToggle = React.memo(function ViewModeToggle({
  viewMode,
  onToggle,
}: {
  viewMode: "monthly" | "daily";
  onToggle: (mode: "monthly" | "daily") => void;
}) {
  return (
    <View style={styles.viewModeRow}>
      <Pressable
        style={[styles.viewModeBtn, viewMode === "monthly" && styles.viewModeBtnActive]}
        onPress={() => { onToggle("monthly"); Haptics.selectionAsync(); }}
      >
        <Text style={[styles.viewModeBtnText, viewMode === "monthly" && styles.viewModeBtnTextActive]}>
          MONTHLY
        </Text>
      </Pressable>
      <Pressable
        style={[styles.viewModeBtn, viewMode === "daily" && styles.viewModeBtnActive]}
        onPress={() => { onToggle("daily"); Haptics.selectionAsync(); }}
      >
        <Text style={[styles.viewModeBtnText, viewMode === "daily" && styles.viewModeBtnTextActive]}>
          DAILY
        </Text>
      </Pressable>
    </View>
  );
});

// ─── Daily Summary Panel ────────────────────────────────────────────────────

const DailySummary = React.memo(function DailySummary({
  earned,
  spent,
  net,
}: {
  earned: number;
  spent: number;
  net: number;
}) {
  return (
    <Panel style={styles.heroPanel} delay={50} tone="hero">
      <View style={styles.heroMetrics}>
        <View style={styles.heroMetric}>
          <MetricValue
            label="EARNED"
            value={formatCurrency(earned)}
            size="sm"
            color={INCOME_COLOR}
          />
        </View>
        <View style={styles.heroDivider} />
        <View style={styles.heroMetric}>
          <MetricValue
            label="SPENT"
            value={formatCurrency(spent)}
            size="sm"
            color={EXPENSE_COLOR}
          />
        </View>
        <View style={styles.heroDivider} />
        <View style={styles.heroMetric}>
          <MetricValue
            label="NET"
            value={formatCurrency(net)}
            size="sm"
            color={net >= 0 ? colors.money : EXPENSE_COLOR}
          />
        </View>
      </View>
    </Panel>
  );
});

// ─── Monthly Summary Hero Panel ─────────────────────────────────────────────

const MonthlySummary = React.memo(function MonthlySummary({
  earned,
  spent,
  net,
  earnedDelta,
  spentDelta,
}: {
  earned: number;
  spent: number;
  net: number;
  earnedDelta: number;
  spentDelta: number;
}) {
  return (
    <Panel style={styles.heroPanel} delay={50} tone="hero">
      <View style={styles.heroMetrics}>
        <View style={styles.heroMetric}>
          <MetricValue
            label="EARNED"
            value={formatCurrency(earned)}
            size="sm"
            color={INCOME_COLOR}
          />
          {earnedDelta !== 0 && (
            <Text style={[styles.deltaText, { color: earnedDelta > 0 ? INCOME_COLOR : EXPENSE_COLOR }]}>
              {getDeltaLabel(earnedDelta)} vs last mo
            </Text>
          )}
        </View>
        <View style={styles.heroDivider} />
        <View style={styles.heroMetric}>
          <MetricValue
            label="SPENT"
            value={formatCurrency(spent)}
            size="sm"
            color={EXPENSE_COLOR}
          />
          {spentDelta !== 0 && (
            <Text style={[styles.deltaText, { color: spentDelta > 0 ? EXPENSE_COLOR : INCOME_COLOR }]}>
              {getDeltaLabel(spentDelta)} vs last mo
            </Text>
          )}
        </View>
        <View style={styles.heroDivider} />
        <View style={styles.heroMetric}>
          <MetricValue
            label="NET"
            value={formatCurrency(net)}
            size="sm"
            color={net >= 0 ? colors.money : EXPENSE_COLOR}
          />
          <Text style={[styles.deltaText, { color: net >= 0 ? colors.money : EXPENSE_COLOR }]}>
            {net >= 0 ? "surplus" : "deficit"}
          </Text>
        </View>
      </View>
    </Panel>
  );
});

// ─── Category Bar ───────────────────────────────────────────────────────────

const CategoryBar = React.memo(function CategoryBar({
  item,
  maxTotal,
  isSelected,
  onPress,
}: {
  item: CategoryTotal;
  maxTotal: number;
  isSelected: boolean;
  onPress: () => void;
}) {
  const pct = maxTotal > 0 ? Math.min(item.total / maxTotal, 1) * 100 : 0;

  return (
    <Pressable
      onPress={() => { onPress(); Haptics.selectionAsync(); }}
      style={[styles.catBarRow, isSelected && styles.catBarRowSelected]}
    >
      <View style={styles.catBarLabelRow}>
        <View style={[styles.catBarIcon, { backgroundColor: item.color + "20" }]}>
          <Ionicons
            name={item.icon as any}
            size={14}
            color={item.color}
          />
        </View>
        <Text style={styles.catBarLabel}>{item.category}</Text>
        <Text style={styles.catBarPct}>{item.percentage.toFixed(0)}%</Text>
        <Text style={styles.catBarAmount}>{formatCurrency(item.total)}</Text>
      </View>
      <TitanProgress
        value={pct}
        color={item.color}
        height={5}
        shimmer={isSelected}
      />
    </Pressable>
  );
});

// ─── Quick Add Transaction Form ─────────────────────────────────────────────

const AddTransactionForm = React.memo(function AddTransactionForm({
  onClose,
}: {
  onClose: () => void;
}) {
  const createTxMut = useCreateTransaction();
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [note, setNote] = useState("");
  const [txDate, setTxDate] = useState(getTodayKey());

  const categories = type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  useEffect(() => {
    setCategory(type === "expense" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]);
  }, [type]);

  const handleAmountChange = useCallback((text: string) => {
    if (text.includes(".") && text.indexOf(".") !== text.lastIndexOf(".")) return;
    let cleaned = text.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts[1] && parts[1].length > 2) cleaned = parts[0] + "." + parts[1].slice(0, 2);
    setAmount(cleaned);
  }, []);

  const handleSave = useCallback(() => {
    const parsed = parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 999999.99) return;
    const roundedAmount = Math.round(parsed * 100) / 100;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    createTxMut.mutate({
      dateKey: txDate,
      type,
      amount: roundedAmount,
      category,
      note: note.trim() || undefined,
    });
    // Reset form
    setAmount("");
    setNote("");
    setCategory(type === "expense" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]);
    setTxDate(getTodayKey());
    onClose();
  }, [amount, txDate, type, category, note, createTxMut, onClose]);

  const today = getTodayKey();
  const yesterday = addDays(today, -1);

  const typeColor = type === "expense" ? EXPENSE_COLOR : INCOME_COLOR;

  return (
    <Animated.View entering={FadeInDown.duration(300).easing(Easing.out(Easing.cubic))}>
      <Panel style={styles.formPanel} glowColor={typeColor}>
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>Quick Add</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Type Toggle */}
        <View style={styles.typeToggle}>
          <Pressable
            style={[styles.typeBtn, type === "income" && { backgroundColor: INCOME_COLOR }]}
            onPress={() => { setType("income"); Haptics.selectionAsync(); }}
          >
            <Ionicons
              name="arrow-down-outline"
              size={14}
              color={type === "income" ? "#000" : colors.textMuted}
            />
            <Text style={[styles.typeBtnText, type === "income" && styles.typeBtnTextActive]}>
              INCOME
            </Text>
          </Pressable>
          <Pressable
            style={[styles.typeBtn, type === "expense" && { backgroundColor: EXPENSE_COLOR }]}
            onPress={() => { setType("expense"); Haptics.selectionAsync(); }}
          >
            <Ionicons
              name="arrow-up-outline"
              size={14}
              color={type === "expense" ? "#000" : colors.textMuted}
            />
            <Text style={[styles.typeBtnText, type === "expense" && styles.typeBtnTextActive]}>
              EXPENSE
            </Text>
          </Pressable>
        </View>

        {/* Amount */}
        <View style={[styles.amountRow, { borderColor: typeColor + "40" }]}>
          <Text style={[styles.amountCurrency, { color: typeColor }]}>$</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={handleAmountChange}
            autoFocus
          />
        </View>

        {/* Category Chips */}
        <Text style={styles.fieldLabel}>CATEGORY</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {categories.map((cat) => {
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

        {/* Date Selector */}
        <Text style={styles.fieldLabel}>DATE</Text>
        <View style={styles.dateRow}>
          {[
            { key: today, label: "Today" },
            { key: yesterday, label: "Yesterday" },
            { key: addDays(today, -2), label: "2 days ago" },
          ].map((d) => {
            const active = txDate === d.key;
            return (
              <Pressable
                key={d.key}
                style={[styles.dateBtn, active && styles.dateBtnActive]}
                onPress={() => { setTxDate(d.key); Haptics.selectionAsync(); }}
              >
                <Text style={[styles.dateBtnText, active && styles.dateBtnTextActive]}>
                  {d.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

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
          style={[styles.saveBtn, { backgroundColor: typeColor }]}
          onPress={handleSave}
        >
          <Ionicons name="checkmark" size={18} color="#000" />
          <Text style={styles.saveBtnText}>
            Save {type === "expense" ? "Expense" : "Income"}
          </Text>
        </Pressable>
      </Panel>
    </Animated.View>
  );
});

// ─── Transaction Row ─────────────────────────────────────────────────────────

const TransactionRow = React.memo(function TransactionRow({ tx }: { tx: MoneyTransaction }) {
  const deleteTxMut = useDeleteTransaction();

  const handleDelete = useCallback(() => {
    Alert.alert("Delete Transaction", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          deleteTxMut.mutate(tx.id);
        },
      },
    ]);
  }, [tx.id, deleteTxMut]);

  const icon = CATEGORY_ICONS[tx.category] ?? "ellipsis-horizontal-circle-outline";
  const catColor = CATEGORY_COLORS[tx.category] ?? colors.textMuted;
  const isExpense = tx.type === "expense";
  const amountColor = isExpense ? EXPENSE_COLOR : INCOME_COLOR;

  return (
    <View style={styles.txRow}>
      <View style={[styles.txIcon, { backgroundColor: catColor + "18" }]}>
        <Ionicons name={icon as any} size={18} color={catColor} />
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txCategory} numberOfLines={1}>
          {tx.note ?? tx.category}
        </Text>
        {tx.note && tx.note.length > 0 ? (
          <Text style={styles.txNote} numberOfLines={1}>{tx.category}</Text>
        ) : null}
      </View>
      <Text style={[styles.txAmount, { color: amountColor }]}>
        {isExpense ? "-" : "+"}
        {formatCurrency(tx.amount)}
      </Text>
      <Pressable onPress={handleDelete} hitSlop={12} style={styles.txDeleteBtn}>
        <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
      </Pressable>
    </View>
  );
});

// ─── Date Section Header ─────────────────────────────────────────────────────

const DateSectionHeader = React.memo(function DateSectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.dateSectionHeader}>
      <Text style={styles.dateLabel}>{formatSectionDate(title)}</Text>
    </View>
  );
});

// ─── Loan Card ───────────────────────────────────────────────────────────────

const LoanCard = React.memo(function LoanCard({
  loan,
  onMarkPaid,
  onDelete,
}: {
  loan: MoneyLoan;
  onMarkPaid: () => void;
  onDelete: () => void;
}) {
  const remaining = Math.max(0, loan.amount - loan.paid);
  const pct = loan.amount > 0 ? (loan.paid / loan.amount) * 100 : 0;
  const isPaid = loan.status === "paid";

  return (
    <Panel style={styles.loanCard}>
      <View style={styles.loanHeader}>
        <View style={styles.loanInfo}>
          <Text style={styles.loanLender}>{loan.lender}</Text>
          <Text style={styles.loanMeta}>
            {formatCurrency(loan.paid)} / {formatCurrency(loan.amount)}
          </Text>
        </View>
        <View style={styles.loanActions}>
          {!isPaid && (
            <Pressable
              onPress={() => { onMarkPaid(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
              style={styles.loanPayBtn}
            >
              <Text style={styles.loanPayBtnText}>Mark Paid</Text>
            </Pressable>
          )}
          <Pressable onPress={onDelete} hitSlop={12}>
            <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>
      <TitanProgress
        value={pct}
        color={isPaid ? colors.success : colors.money}
        height={5}
      />
      <Text style={[styles.loanRemaining, { color: isPaid ? colors.success : colors.textSecondary }]}>
        {isPaid ? "Fully paid" : `${formatCurrency(remaining)} remaining`}
      </Text>
    </Panel>
  );
});

// ─── Add Loan Form ───────────────────────────────────────────────────────────

const AddLoanForm = React.memo(function AddLoanForm({
  onClose,
}: {
  onClose: () => void;
}) {
  const addLoan = useMoneyStore((s) => s.addLoan);
  const [lender, setLender] = useState("");
  const [amountStr, setAmountStr] = useState("");

  const handleSave = useCallback(() => {
    const parsed = parseFloat(amountStr);
    if (!lender.trim() || !Number.isFinite(parsed) || parsed <= 0 || parsed > 999999.99) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addLoan({
      lender: lender.trim(),
      amount: Math.round(parsed * 100) / 100,
      paid: 0,
      dateISO: getTodayKey(),
      dueISO: null,
      status: "unpaid",
    });
    onClose();
  }, [lender, amountStr, addLoan, onClose]);

  return (
    <Animated.View entering={FadeInDown.duration(300).easing(Easing.out(Easing.cubic))}>
      <Panel style={styles.formPanel}>
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>Add Loan</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>
        </View>
        <TextInput
          style={styles.noteInput}
          placeholder="Lender name"
          placeholderTextColor={colors.textMuted}
          value={lender}
          onChangeText={setLender}
          autoFocus
        />
        <View style={styles.amountRow}>
          <Text style={styles.amountCurrency}>$</Text>
          <TextInput
            style={[styles.amountInput, { fontSize: 22 }]}
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            value={amountStr}
            onChangeText={(t) => {
              if (t.includes(".") && t.indexOf(".") !== t.lastIndexOf(".")) return;
              let cleaned = t.replace(/[^0-9.]/g, "");
              const parts = cleaned.split(".");
              if (parts[1] && parts[1].length > 2) cleaned = parts[0] + "." + parts[1].slice(0, 2);
              setAmountStr(cleaned);
            }}
          />
        </View>
        <Pressable style={[styles.saveBtn, { backgroundColor: colors.money }]} onPress={handleSave}>
          <Ionicons name="add" size={18} color="#000" />
          <Text style={styles.saveBtnText}>Add Loan</Text>
        </Pressable>
      </Panel>
    </Animated.View>
  );
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function CashflowScreen() {
  const router = useRouter();
  const { data: transactions = [] } = useTransactions();
  // Loans remain on MMKV — no cloud table for them yet
  const loans = useMoneyStore((s) => s.loans);
  const loadLoans = useMoneyStore((s) => s.load);
  const markLoanPaid = useMoneyStore((s) => s.markLoanPaid);
  const deleteLoan = useMoneyStore((s) => s.deleteLoan);

  // Load loans from MMKV (transactions auto-fetched by React Query)
  useEffect(() => { loadLoans(); }, [loadLoans]);

  const [showForm, setShowForm] = useState(false);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loansExpanded, setLoansExpanded] = useState(false);

  // View mode: monthly or daily
  const [viewMode, setViewMode] = useState<"monthly" | "daily">("monthly");
  const [selectedDate, setSelectedDate] = useState(getTodayKey());

  // Month navigation
  const [monthOffset, setMonthOffset] = useState(0);
  const currentMonth = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return getMonthKey(d);
  }, [monthOffset]);
  const monthLabel = useMemo(() => getMonthLabel(currentMonth), [currentMonth]);

  // Computed data
  const monthTxs = useMemo(
    () => getCloudMonthTransactions(transactions, currentMonth),
    [transactions, currentMonth],
  );

  const comparison = useMemo(
    () => getCloudMonthComparison(transactions, currentMonth),
    [transactions, currentMonth],
  );

  const categoryTotals = useMemo(
    () => getCloudCategoryTotals(transactions, currentMonth),
    [transactions, currentMonth],
  );

  const maxCategoryTotal = categoryTotals.length > 0 ? categoryTotals[0].total : 0;

  // Daily mode data
  const dayTxs = useMemo(
    () => transactions.filter((tx) => tx.date_key === selectedDate),
    [transactions, selectedDate],
  );

  const dayTotals = useMemo(() => {
    let earned = 0;
    let spent = 0;
    for (const tx of dayTxs) {
      if (tx.type === "income") earned += tx.amount;
      else spent += tx.amount;
    }
    return { earned, spent, net: earned - spent };
  }, [dayTxs]);

  const selectedDateLabel = useMemo(() => {
    const today = getTodayKey();
    const yesterday = addDays(today, -1);
    if (selectedDate === today) return "Today";
    if (selectedDate === yesterday) return "Yesterday";
    const d = new Date(selectedDate + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }, [selectedDate]);

  const canGoNextDay = selectedDate < getTodayKey();

  // Filter by selected category (uses daily or monthly list depending on view mode)
  const baseTxs = viewMode === "daily" ? dayTxs : monthTxs;
  const filteredTxs = useMemo(() => {
    if (!selectedCategory) return baseTxs;
    return baseTxs.filter((tx) => tx.category === selectedCategory);
  }, [baseTxs, selectedCategory]);

  // Group filtered transactions by date for SectionList
  const sections = useMemo(() => {
    const sorted = [...filteredTxs].sort(
      (a, b) => b.date_key.localeCompare(a.date_key) || a.id.localeCompare(b.id),
    );
    const groups: { title: string; data: MoneyTransaction[] }[] = [];
    let currentDate = "";
    for (const tx of sorted) {
      if (tx.date_key !== currentDate) {
        currentDate = tx.date_key;
        groups.push({ title: currentDate, data: [] });
      }
      groups[groups.length - 1].data.push(tx);
    }
    return groups;
  }, [filteredTxs]);

  // Active loans
  const activeLoans = useMemo(
    () => loans.filter((l) => l.status === "unpaid"),
    [loans],
  );

  const paidLoans = useMemo(
    () => loans.filter((l) => l.status === "paid"),
    [loans],
  );

  const handleDeleteLoan = useCallback(
    (id: number) => {
      Alert.alert("Delete Loan", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            deleteLoan(id);
          },
        },
      ]);
    },
    [deleteLoan],
  );

  const handleCategoryPress = useCallback((cat: string) => {
    setSelectedCategory((prev) => (prev === cat ? null : cat));
  }, []);

  // ─── List Header (everything above transaction list) ────────────────────────

  const listHeader = useMemo(
    () => (
      <>
        {/* Page Header */}
        <PageHeader kicker="MONEY ENGINE" title="Cashflow" />

        {/* View Mode Toggle */}
        <ViewModeToggle viewMode={viewMode} onToggle={setViewMode} />

        {/* Navigation — Monthly or Daily */}
        {viewMode === "monthly" ? (
          <MonthNav
            label={monthLabel}
            onPrev={() => setMonthOffset((o) => o - 1)}
            onNext={() => setMonthOffset((o) => o + 1)}
            canGoNext={monthOffset < 0}
          />
        ) : (
          <DayNav
            label={selectedDateLabel}
            onPrev={() => setSelectedDate((d) => addDays(d, -1))}
            onNext={() => setSelectedDate((d) => addDays(d, 1))}
            canGoNext={canGoNextDay}
          />
        )}

        {/* Summary Hero — Monthly or Daily */}
        {viewMode === "monthly" ? (
          <MonthlySummary
            earned={comparison.earned}
            spent={comparison.spent}
            net={comparison.net}
            earnedDelta={comparison.earnedDelta}
            spentDelta={comparison.spentDelta}
          />
        ) : (
          <DailySummary
            earned={dayTotals.earned}
            spent={dayTotals.spent}
            net={dayTotals.net}
          />
        )}

        {/* Category Breakdown */}
        {categoryTotals.length > 0 && (
          <>
            <SectionHeader
              title="Spending by Category"
              right={formatCurrency(comparison.spent)}
              accentColor={colors.money}
            />
            <Panel style={styles.catPanel} delay={100}>
              {selectedCategory && (
                <Pressable
                  onPress={() => { setSelectedCategory(null); Haptics.selectionAsync(); }}
                  style={styles.clearFilterBtn}
                >
                  <Ionicons name="close-circle" size={14} color={colors.money} />
                  <Text style={styles.clearFilterText}>
                    Showing: {selectedCategory} — tap to clear
                  </Text>
                </Pressable>
              )}
              {categoryTotals.map((item) => (
                <CategoryBar
                  key={item.category}
                  item={item}
                  maxTotal={maxCategoryTotal}
                  isSelected={selectedCategory === item.category}
                  onPress={() => handleCategoryPress(item.category)}
                />
              ))}
            </Panel>
          </>
        )}

        {/* Quick Add Transaction */}
        {showForm ? (
          <AddTransactionForm onClose={() => setShowForm(false)} />
        ) : (
          <Pressable
            style={styles.addBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowForm(true);
            }}
          >
            <Ionicons name="add" size={20} color="#000" />
            <Text style={styles.addBtnText}>Add Transaction</Text>
          </Pressable>
        )}

        {/* Loan Tracker */}
        {(activeLoans.length > 0 || paidLoans.length > 0) && (
          <>
            <Pressable
              onPress={() => { setLoansExpanded((e) => !e); Haptics.selectionAsync(); }}
              style={styles.loanSectionHeader}
            >
              <SectionHeader
                title="Active Loans"
                right={`${activeLoans.length} unpaid`}
                accentColor={EXPENSE_COLOR}
              />
              <Ionicons
                name={loansExpanded ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.textMuted}
                style={styles.loanChevron}
              />
            </Pressable>
            {loansExpanded && (
              <Animated.View entering={FadeInDown.duration(250).easing(Easing.out(Easing.cubic))}>
                {activeLoans.map((loan) => (
                  <LoanCard
                    key={loan.id}
                    loan={loan}
                    onMarkPaid={() => markLoanPaid(loan.id)}
                    onDelete={() => handleDeleteLoan(loan.id)}
                  />
                ))}
                {activeLoans.length === 0 && (
                  <Panel style={styles.emptyPanel}>
                    <Text style={styles.emptySubtext}>No active loans</Text>
                  </Panel>
                )}
                {paidLoans.length > 0 && (
                  <>
                    <SectionHeader
                      title="Paid"
                      right={`${paidLoans.length} cleared`}
                      accentColor={colors.success}
                    />
                    {paidLoans.map((loan) => (
                      <LoanCard
                        key={loan.id}
                        loan={loan}
                        onMarkPaid={() => markLoanPaid(loan.id)}
                        onDelete={() => handleDeleteLoan(loan.id)}
                      />
                    ))}
                  </>
                )}
              </Animated.View>
            )}
          </>
        )}

        {/* Add Loan button — always accessible outside collapsible */}
        {showLoanForm ? (
          <AddLoanForm onClose={() => setShowLoanForm(false)} />
        ) : (
          <Pressable
            style={styles.addLoanBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowLoanForm(true);
            }}
          >
            <Ionicons name="add" size={16} color={colors.money} />
            <Text style={styles.addLoanBtnText}>Add Loan</Text>
          </Pressable>
        )}

        {/* Transaction List Header */}
        <SectionHeader
          title="Transactions"
          right={`${filteredTxs.length} ${selectedCategory ? "in " + selectedCategory : viewMode === "daily" ? "today" : "this month"}`}
          accentColor={colors.money}
        />
      </>
    ),
    [
      viewMode,
      monthLabel,
      monthOffset,
      selectedDate,
      selectedDateLabel,
      canGoNextDay,
      comparison,
      dayTotals,
      categoryTotals,
      maxCategoryTotal,
      selectedCategory,
      showForm,
      showLoanForm,
      activeLoans,
      paidLoans,
      loansExpanded,
      filteredTxs.length,
      handleCategoryPress,
      handleDeleteLoan,
      markLoanPaid,
    ],
  );

  const listEmpty = useMemo(
    () => (
      <Panel style={styles.emptyPanel}>
        <Ionicons name="wallet-outline" size={32} color={colors.textMuted} />
        <Text style={styles.emptyText}>
          {selectedCategory
            ? `No ${selectedCategory} transactions`
            : viewMode === "daily"
            ? "No transactions this day"
            : "No transactions this month"}
        </Text>
        <Text style={styles.emptySubtext}>
          {selectedCategory
            ? "Try clearing the category filter or adding a transaction"
            : 'Tap "Add Transaction" above to start tracking'}
        </Text>
      </Panel>
    ),
    [selectedCategory, viewMode],
  );

  const renderTxItem = useCallback(
    ({ item, index }: { item: MoneyTransaction; index: number }) => (
      <View style={styles.txPanelItem}>
        {index > 0 && <View style={styles.txDivider} />}
        <TransactionRow tx={item} />
      </View>
    ),
    [],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Ionicons name="wallet-outline" size={18} color={colors.money} />
          <Text style={styles.headerTitle}>Cashflow</Text>
        </View>
        <View style={{ width: 48 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <SectionList
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderTxItem}
          renderSectionHeader={({ section }) => (
            <DateSectionHeader title={section.title} />
          )}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          stickySectionHeadersEnabled={false}
        />
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

  // ── View Mode Toggle ──
  viewModeRow: {
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: colors.inputBg,
    borderRadius: radius.full,
    padding: 3,
    gap: 3,
    marginBottom: spacing.sm,
  },
  viewModeBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  viewModeBtnActive: {
    backgroundColor: colors.money,
  },
  viewModeBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 1,
  },
  viewModeBtnTextActive: {
    color: "#000",
  },

  // ── Month Navigation ──
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
    paddingVertical: spacing.md,
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    minWidth: 160,
    textAlign: "center",
    letterSpacing: 0.5,
  },

  // ── Hero Summary Panel ──
  heroPanel: {
    paddingVertical: spacing["2xl"],
    paddingHorizontal: spacing.lg,
  },
  heroMetrics: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  heroMetric: {
    flex: 1,
    alignItems: "center",
  },
  heroDivider: {
    width: 1,
    height: 44,
    backgroundColor: colors.surfaceBorder,
    marginHorizontal: spacing.sm,
    alignSelf: "center",
  },
  deltaText: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: spacing.xs,
    letterSpacing: 0.3,
  },

  // ── Category Bars ──
  catPanel: { gap: spacing.sm, paddingVertical: spacing.md },
  catBarRow: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  catBarRowSelected: {
    backgroundColor: "rgba(251, 191, 36, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.20)",
  },
  catBarLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  catBarIcon: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  catBarLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    flex: 1,
  },
  catBarPct: {
    ...fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
  },
  catBarAmount: {
    ...fonts.mono,
    fontSize: 13,
    color: colors.textSecondary,
    minWidth: 70,
    textAlign: "right",
  },
  clearFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  clearFilterText: {
    fontSize: 12,
    color: colors.money,
    fontWeight: "600",
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
    gap: 3,
  },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    gap: spacing.xs,
  },
  typeBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 1,
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
  dateRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  dateBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  dateBtnActive: {
    backgroundColor: colors.money,
    borderColor: colors.money,
  },
  dateBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  dateBtnTextActive: {
    color: "#000",
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
    flexDirection: "row",
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

  // ── Transaction List ──
  dateSectionHeader: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  dateLabel: {
    ...fonts.kicker,
    color: colors.textMuted,
  },
  txPanelItem: {
    paddingHorizontal: spacing.sm,
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
    fontSize: 12,
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

  // ── Loan Tracker ──
  loanSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  loanChevron: {
    marginTop: spacing.xl,
    marginLeft: -spacing.sm,
  },
  loanCard: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  loanHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  loanInfo: {
    flex: 1,
  },
  loanLender: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  loanMeta: {
    ...fonts.mono,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  loanActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  loanPayBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.money,
  },
  loanPayBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#000",
  },
  loanRemaining: {
    fontSize: 12,
    fontWeight: "500",
  },
  addLoanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.money + "30",
    borderStyle: "dashed",
  },
  addLoanBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.money,
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
