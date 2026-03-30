import React, { useMemo } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp } from "react-native-reanimated";
import { colors, spacing, fonts } from "../src/theme";
import { PageHeader } from "../src/components/ui/PageHeader";
import { SectionHeader } from "../src/components/ui/SectionHeader";
import { useAchievementStore, type AchievementRarity } from "../src/stores/useAchievementStore";
import achievementDefs from "../src/data/achievements.json";

type AchDef = {
  id: string;
  name: string;
  description: string;
  rarity: AchievementRarity;
  xpReward: number;
  iconName: string;
};

const ALL_DEFS = achievementDefs as AchDef[];

const RARITY_ORDER: AchievementRarity[] = ["legendary", "epic", "rare", "uncommon", "common"];
const RARITY_COLORS: Record<AchievementRarity, string> = {
  common: "#9CA3AF",
  uncommon: "#60A5FA",
  rare: "#FBBF24",
  epic: "#A78BFA",
  legendary: "#FFD700",
};
const RARITY_LABELS: Record<AchievementRarity, string> = {
  common: "COMMON",
  uncommon: "UNCOMMON",
  rare: "RARE",
  epic: "EPIC",
  legendary: "LEGENDARY",
};

export default function AchievementsScreen() {
  const router = useRouter();
  const unlockedIds = useAchievementStore((s) => s.unlockedIds);

  const grouped = useMemo(() => {
    const groups: Record<AchievementRarity, AchDef[]> = {
      legendary: [], epic: [], rare: [], uncommon: [], common: [],
    };
    for (const def of ALL_DEFS) {
      groups[def.rarity].push(def);
    }
    return groups;
  }, []);

  const totalUnlocked = unlockedIds.length;
  const totalAchievements = ALL_DEFS.length;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PageHeader
          kicker="COLLECTION"
          title="Achievements"
          subtitle={`${totalUnlocked} of ${totalAchievements} unlocked`}
        />

        {RARITY_ORDER.map((rarity) => {
          const defs = grouped[rarity];
          if (defs.length === 0) return null;
          const rarityColor = RARITY_COLORS[rarity];

          return (
            <View key={rarity}>
              <SectionHeader title={RARITY_LABELS[rarity]} right={`${defs.filter((d) => unlockedIds.includes(d.id)).length}/${defs.length}`} />
              <View style={styles.grid}>
                {defs.map((def, idx) => {
                  const unlocked = unlockedIds.includes(def.id);
                  return (
                    <Animated.View
                      key={def.id}
                      entering={FadeInUp.delay(idx * 40).duration(300)}
                      style={[styles.card, unlocked && { borderColor: rarityColor + "40" }]}
                    >
                      <View style={[styles.iconCircle, { backgroundColor: unlocked ? rarityColor + "20" : "rgba(255,255,255,0.04)" }]}>
                        <Ionicons
                          name={(unlocked ? def.iconName : "help-outline") as keyof typeof Ionicons.glyphMap}
                          size={24}
                          color={unlocked ? rarityColor : colors.textMuted}
                        />
                      </View>
                      <Text style={[styles.name, unlocked ? { color: rarityColor } : styles.nameLocked]} numberOfLines={1}>
                        {unlocked ? def.name : "???"}
                      </Text>
                      <Text style={styles.desc} numberOfLines={2}>
                        {unlocked ? def.description : "Achievement locked"}
                      </Text>
                      <View style={[styles.rarityPill, { borderColor: rarityColor + "40" }]}>
                        <Text style={[styles.rarityText, { color: rarityColor }]}>
                          {RARITY_LABELS[rarity]}
                        </Text>
                      </View>
                    </Animated.View>
                  );
                })}
              </View>
            </View>
          );
        })}

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
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginBottom: spacing.lg },
  card: {
    width: "47%",
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: "rgba(255,255,255,0.02)",
    alignItems: "center",
    gap: spacing.sm,
  },
  iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 13, fontWeight: "700", textAlign: "center" },
  nameLocked: { color: colors.textMuted },
  desc: { fontSize: 10, color: colors.textMuted, textAlign: "center", lineHeight: 14 },
  rarityPill: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
  },
  rarityText: { fontSize: 8, fontWeight: "700", letterSpacing: 1.5 },
});
