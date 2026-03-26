import React from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius } from "../../src/theme";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { Card } from "../../src/components/ui/Card";

export default function WorkoutsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Workouts</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        <Pressable
          style={styles.startBtn}
          onPress={() => Alert.alert("Coming Soon", "Workout tracking will be available in a future update.")}
        >
          <Text style={styles.startBtnText}>Start Workout</Text>
        </Pressable>

        <SectionHeader title="Templates" />
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>No templates yet</Text>
          <Text style={styles.emptySubtext}>Create a workout template to get started quickly</Text>
        </Card>

        <SectionHeader title="Exercise Library" />
        <Card style={styles.libraryCard}>
          <View style={styles.libraryRow}>
            <View>
              <Text style={styles.libraryTitle}>Browse Exercises</Text>
              <Text style={styles.libraryCount}>0 exercises saved</Text>
            </View>
            <Text style={styles.libraryArrow}>→</Text>
          </View>
        </Card>

        <SectionHeader title="Recent Workouts" />
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>No workouts logged</Text>
          <Text style={styles.emptySubtext}>Complete your first workout to see it here</Text>
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
  startBtn: {
    backgroundColor: colors.body,
    borderRadius: radius.full,
    paddingVertical: spacing.lg,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  startBtnText: { fontSize: 18, fontWeight: "800", color: "#000" },
  emptyCard: { alignItems: "center", paddingVertical: spacing["2xl"] },
  emptyText: { fontSize: 16, fontWeight: "600", color: colors.textSecondary },
  emptySubtext: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
  libraryCard: {},
  libraryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  libraryTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  libraryCount: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs },
  libraryArrow: { fontSize: 20, color: colors.textSecondary },
});
