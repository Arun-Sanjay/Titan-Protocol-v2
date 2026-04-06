import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, fonts } from "../src/theme";
import { PageHeader } from "../src/components/ui/PageHeader";
import { NarrativeTimeline } from "../src/components/v2/narrative/NarrativeTimeline";
import { useIdentityStore, selectIdentityMeta, selectDaysSinceSelection } from "../src/stores/useIdentityStore";

export default function NarrativeScreen() {
  const router = useRouter();
  const archetype = useIdentityStore((s) => s.archetype);
  const selectedDate = useIdentityStore((s) => s.selectedDate);
  const meta = selectIdentityMeta(archetype);
  const days = selectDaysSinceSelection(selectedDate);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          kicker="YOUR STORY"
          title="Narrative"
          subtitle={
            meta
              ? `Day ${days + 1} as ${meta.name}`
              : "Your transformation story"
          }
        />

        <NarrativeTimeline />

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg },
});
