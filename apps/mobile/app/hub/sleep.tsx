import React from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius } from "../../src/theme";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { Card } from "../../src/components/ui/Card";

const SLEEP_STATS = [
  { label: "Bedtime", value: "--:--", icon: "🌙" },
  { label: "Wake Time", value: "--:--", icon: "☀️" },
  { label: "Duration", value: "--h --m", icon: "⏱" },
];

const STARS_TOTAL = 5;
const currentQuality = 0;

export default function SleepScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Sleep Tracker</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        <SectionHeader title="Last Night" />
        <View style={styles.statsRow}>
          {SLEEP_STATS.map((s) => (
            <Card key={s.label} style={styles.statCard}>
              <Text style={styles.statIcon}>{s.icon}</Text>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </Card>
          ))}
        </View>

        <Card style={styles.qualityCard}>
          <Text style={styles.qualityLabel}>Quality</Text>
          <View style={styles.starsRow}>
            {Array.from({ length: STARS_TOTAL }).map((_, i) => (
              <Text key={i} style={[styles.star, i < currentQuality && styles.starFilled]}>
                ★
              </Text>
            ))}
          </View>
          <Text style={styles.qualityHint}>
            {currentQuality === 0 ? "No sleep logged yet" : `${currentQuality} / ${STARS_TOTAL}`}
          </Text>
        </Card>

        <Pressable
          style={styles.actionBtn}
          onPress={() => Alert.alert("Coming Soon", "Sleep logging will be available in a future update.")}
        >
          <Text style={styles.actionBtnText}>Log Sleep</Text>
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
  statsRow: { flexDirection: "row", gap: spacing.md },
  statCard: { flex: 1, alignItems: "center", paddingVertical: spacing.lg },
  statIcon: { fontSize: 24, marginBottom: spacing.sm },
  statValue: { fontSize: 18, fontWeight: "800", color: colors.text },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs },
  qualityCard: { alignItems: "center", marginTop: spacing.md, paddingVertical: spacing["2xl"] },
  qualityLabel: { fontSize: 14, fontWeight: "700", color: colors.textSecondary, letterSpacing: 1, textTransform: "uppercase", marginBottom: spacing.sm },
  starsRow: { flexDirection: "row", gap: spacing.sm },
  star: { fontSize: 28, color: colors.surfaceBorder },
  starFilled: { color: colors.money },
  qualityHint: { fontSize: 13, color: colors.textMuted, marginTop: spacing.sm },
  actionBtn: {
    backgroundColor: colors.mind,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.xl,
  },
  actionBtnText: { fontSize: 16, fontWeight: "700", color: "#000" },
});
