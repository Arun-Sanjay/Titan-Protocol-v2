import React from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius } from "../../src/theme";
import { PageHeader } from "../../src/components/ui/PageHeader";
import { HUDBackground } from "../../src/components/ui/AnimatedBackground";
import { useModeStore, checkFeatureVisible, type Feature } from "../../src/stores/useModeStore";

type HubItem = {
  icon: string;
  ionicon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: string;
  color: string;
  ready: boolean;
  feature?: Feature; // If set, only show when this feature is visible
};

const HUB_ITEMS: HubItem[] = [
  { icon: "🎯", ionicon: "timer", label: "Focus Timer", route: "/hub/focus", color: colors.primary, ready: true },
  { icon: "📊", ionicon: "bar-chart", label: "Analytics", route: "/hub/analytics", color: colors.mind, ready: true },
  { icon: "⚡", ionicon: "flash", label: "Command Center", route: "/hub/command", color: colors.warning, ready: true },
  { icon: "💰", ionicon: "wallet", label: "Finance Tracker", route: "/hub/cashflow", color: colors.money, ready: true },
  { icon: "💪", ionicon: "barbell", label: "Workouts", route: "/hub/workouts", color: colors.body, ready: true },
  { icon: "😴", ionicon: "moon", label: "Sleep Tracker", route: "/hub/sleep", color: colors.mind, ready: true },
  { icon: "⚖️", ionicon: "scale", label: "Weight Tracker", route: "/hub/weight", color: colors.charisma, ready: true },
  { icon: "🍎", ionicon: "nutrition", label: "Nutrition", route: "/hub/nutrition", color: colors.body, ready: true },
  { icon: "📋", ionicon: "clipboard", label: "Budgets", route: "/hub/budgets", color: colors.money, ready: true },
  { icon: "🔥", ionicon: "flame", label: "Deep Work", route: "/hub/deep-work", color: colors.warning, ready: true },
  { icon: "🧠", ionicon: "bulb-outline", label: "Mind Training", route: "/mind-training", color: colors.mind, ready: true, feature: "mind_training" },
  { icon: "🏆", ionicon: "flag", label: "Quests", route: "/quests", color: colors.warning, ready: true, feature: "quests" },
  { icon: "🎖️", ionicon: "ribbon", label: "Achievements", route: "/achievements", color: colors.mind, ready: true },
  { icon: "⚙️", ionicon: "settings", label: "Settings", route: "/hub/settings", color: colors.textSecondary, ready: true },
];

function HubCard({ item, cardWidth, index }: { item: HubItem; cardWidth: number; index: number }) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(item.route as any);
      }}
      style={({ pressed }) => [
        styles.card,
        { width: cardWidth, borderColor: item.color + "20" },
        pressed && styles.cardPressed,
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: item.color + "15" }]}>
        <Text style={styles.emoji}>{item.icon}</Text>
      </View>
      <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {item.label}
      </Text>
    </Pressable>
  );
}

export default function HubScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = (screenWidth - spacing.lg * 2 - spacing.md) / 2;
  const hubMode = useModeStore((s) => s.mode);

  const visibleItems = HUB_ITEMS.filter((item) =>
    !item.feature || checkFeatureVisible(hubMode, item.feature),
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <HUDBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>HUB</Text>
          <View style={{ width: 34 }} />
        </View>

        <View style={styles.grid}>
          {visibleItems.map((item, i) => (
            <HubCard key={item.route} item={item} cardWidth={cardWidth} index={i} />
          ))}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.lg, marginBottom: spacing.md },
  backButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.surfaceBorder },
  title: { fontSize: 18, fontWeight: "700", color: colors.text, letterSpacing: 1 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 12,
  },
  cardPressed: { transform: [{ scale: 0.96 }], opacity: 0.7 },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: { fontSize: 28 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
  },
});
