import React from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius } from "../../src/theme";
import { PageHeader } from "../../src/components/ui/PageHeader";

type HubItem = {
  icon: string;
  ionicon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: string;
  color: string;
  ready: boolean;
};

const HUB_ITEMS: HubItem[] = [
  { icon: "🎯", ionicon: "timer", label: "Focus Timer", route: "/hub/focus", color: colors.primary, ready: true },
  { icon: "📊", ionicon: "bar-chart", label: "Analytics", route: "/hub/analytics", color: colors.mind, ready: true },
  { icon: "⚡", ionicon: "flash", label: "Command Center", route: "/hub/command", color: colors.warning, ready: true },
  { icon: "💰", ionicon: "wallet", label: "Finance Tracker", route: "/hub/cashflow", color: colors.money, ready: true },
  { icon: "💪", ionicon: "barbell", label: "Workouts", route: "/hub/workouts", color: colors.body, ready: true },
  { icon: "😴", ionicon: "moon", label: "Sleep Tracker", route: "/hub/sleep", color: colors.mind, ready: true },
  { icon: "⚖️", ionicon: "scale", label: "Weight Tracker", route: "/hub/weight", color: colors.general, ready: true },
  { icon: "🍎", ionicon: "nutrition", label: "Nutrition", route: "/hub/nutrition", color: colors.body, ready: true },
  { icon: "📋", ionicon: "clipboard", label: "Budgets", route: "/hub/budgets", color: colors.money, ready: true },
  { icon: "🔥", ionicon: "flame", label: "Deep Work", route: "/hub/deep-work", color: colors.warning, ready: true },
  { icon: "⚙️", ionicon: "settings", label: "Settings", route: "/settings", color: colors.textSecondary, ready: true },
];

export default function HubScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader kicker="TOOLS" title="Hub" subtitle="Tools & utilities" />

        <View style={styles.grid}>
          {HUB_ITEMS.map((item) => (
            <Pressable
              key={item.route}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(item.route as any);
              }}
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
                { borderColor: item.color + "20" },
              ]}
            >
              <View style={[styles.iconCircle, { backgroundColor: item.color + "15" }]}>
                <Text style={styles.emoji}>{item.icon}</Text>
              </View>
              <Text style={styles.label}>{item.label}</Text>
              {!item.ready && (
                <View style={styles.comingSoon}>
                  <Text style={styles.comingSoonText}>SOON</Text>
                </View>
              )}
            </Pressable>
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
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  card: {
    width: "47%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
  },
  cardPressed: { transform: [{ scale: 0.97 }], opacity: 0.8 },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 28 },
  label: { fontSize: 14, fontWeight: "600", color: colors.text, textAlign: "center" },
  comingSoon: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.warningDim,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  comingSoonText: { fontSize: 8, fontWeight: "800", color: colors.warning, letterSpacing: 1 },
});
