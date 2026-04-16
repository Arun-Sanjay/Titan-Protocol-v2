import React, { useMemo } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../src/theme";
import { TitleWall } from "../src/components/ui/TitleWall";
// Phase 4.1: cloud-backed titles via React Query
import { useUserTitles, useEquipTitle, useUnequipAllTitles } from "../src/hooks/queries/useTitles";
import { getAllTitleDefs } from "../src/lib/titles";

export default function TitlesScreen() {
  const router = useRouter();

  // Phase 4.1: cloud-backed user titles via React Query
  const { data: userTitles = [] } = useUserTitles();
  const equipTitleMutation = useEquipTitle();
  const unequipAllMutation = useUnequipAllTitles();

  const allTitles = useMemo(() => getAllTitleDefs(), []);
  const earnedCount = userTitles.length;
  const totalCount = allTitles.length;

  // Derive equipped title_id from cloud data
  const equippedId = useMemo(() => {
    const equipped = userTitles.find((t) => t.equipped);
    return equipped?.title_id ?? null;
  }, [userTitles]);

  const handleEquip = (titleId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    equipTitleMutation.mutate(titleId);
  };

  const handleUnequip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    unequipAllMutation.mutate();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            hitSlop={12}
          >
            <Text style={styles.backButton}>{"\u2190"} BACK</Text>
          </Pressable>
          <Text style={styles.pageTitle}>TITLES</Text>
          <Text style={styles.earnedCount}>
            {earnedCount}/{totalCount} EARNED
          </Text>
        </Animated.View>

        {/* Title wall */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)}>
          <TitleWall
            onEquip={handleEquip}
            onUnequip={handleUnequip}
            equippedId={equippedId}
          />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing["2xl"],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  backButton: {
    fontFamily: fonts.mono.fontFamily,
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 0.8,
  },
  pageTitle: {
    fontWeight: fonts.title.fontWeight,
    fontSize: 18,
    color: colors.text,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  earnedCount: {
    fontFamily: fonts.mono.fontFamily,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
});
