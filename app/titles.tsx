import React, { useMemo } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../src/theme";
import { TitleWall } from "../src/components/ui/TitleWall";
import { useTitleStore } from "../src/stores/useTitleStore";
import { getAllTitleDefs } from "../src/lib/titles";

export default function TitlesScreen() {
  const router = useRouter();
  const titleStore = useTitleStore();

  const allTitles = useMemo(() => getAllTitleDefs(), []);
  const earnedCount = titleStore.unlockedIds.length;
  const totalCount = allTitles.length;

  const handleEquip = (titleId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    titleStore.equip(titleId);
  };

  const handleUnequip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    titleStore.unequip();
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
            equippedId={titleStore.equippedId}
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
