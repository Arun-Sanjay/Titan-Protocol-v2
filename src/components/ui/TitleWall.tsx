import React, { useMemo, useState, useCallback } from "react";
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../theme";
import { getAllTitleDefs, getTitleDef, RARITY_COLORS } from "../../lib/titles";
import { useTitleStore } from "../../stores/useTitleStore";

type TitleWallProps = {
  onEquip: (titleId: string) => void;
  onUnequip: () => void;
  equippedId: string | null;
};

const CATEGORIES = [
  "ALL",
  "STREAK",
  "PERFORMANCE",
  "OPS",
  "ENGINE",
  "RANK",
  "SPECIAL",
] as const;

type Category = (typeof CATEGORIES)[number];

function LegendaryBorderCard({
  children,
  rarityColor,
}: {
  children: React.ReactNode;
  rarityColor: string;
}) {
  const opacity = useSharedValue(0.6);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500 }),
        withTiming(0.6, { duration: 1500 }),
      ),
      -1,
      true,
    );
    return () => {
      cancelAnimation(opacity);
    };
  }, [opacity]);

  const animatedBorder = useAnimatedStyle(() => ({
    borderColor: rarityColor,
    shadowColor: rarityColor,
    shadowOpacity: opacity.value * 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  }));

  return (
    <Animated.View style={[styles.card, styles.cardEarned, animatedBorder]}>
      {children}
    </Animated.View>
  );
}

function TitleCard({
  titleDef,
  isEarned,
  isEquipped,
  onEquip,
  cardWidth,
  index,
}: {
  titleDef: ReturnType<typeof getTitleDef>;
  isEarned: boolean;
  isEquipped: boolean;
  onEquip: () => void;
  cardWidth: number;
  index: number;
}) {
  if (!titleDef) return null;

  const rarityColor = RARITY_COLORS[titleDef.rarity] ?? colors.textMuted;
  const isLegendary = titleDef.rarity === "legendary";

  if (!isEarned) {
    return (
      <Animated.View
        entering={FadeInDown.duration(300).delay(index * 40)}
        style={[styles.card, styles.cardUnearned, { width: cardWidth }]}
      >
        <View style={styles.rarityTag}>
          <Text style={[styles.rarityText, { color: colors.textMuted }]}>
            {titleDef.rarity.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.unearnedName}>???</Text>
        <Text style={styles.unearnedDesc}>???</Text>
        <Text style={styles.categoryTag}>
          {titleDef.category.toUpperCase()}
        </Text>
      </Animated.View>
    );
  }

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onEquip();
  };

  const cardContent = (
    <>
      <View style={styles.rarityTag}>
        <Text style={[styles.rarityText, { color: rarityColor }]}>
          {titleDef.rarity.toUpperCase()}
        </Text>
      </View>

      <Text style={styles.earnedName}>{titleDef.name}</Text>
      <Text style={styles.earnedDesc}>{titleDef.description}</Text>
      <Text style={styles.categoryTag}>
        {titleDef.category.toUpperCase()}
      </Text>

      {isEquipped && (
        <View style={styles.equippedRow}>
          <Text style={styles.equippedCheck}>{"\u2713"}</Text>
          <Text style={styles.equippedLabel}>EQUIPPED</Text>
        </View>
      )}
    </>
  );

  if (isLegendary) {
    return (
      <Animated.View
        entering={FadeInDown.duration(300).delay(index * 40)}
        style={{ width: cardWidth }}
      >
        <Pressable onPress={handlePress}>
          <LegendaryBorderCard rarityColor={rarityColor}>
            <View
              style={[
                styles.cardInner,
                { backgroundColor: `${rarityColor}14` },
              ]}
            >
              {cardContent}
            </View>
          </LegendaryBorderCard>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(300).delay(index * 40)}
      style={{ width: cardWidth }}
    >
      <Pressable onPress={handlePress}>
        <View
          style={[
            styles.card,
            styles.cardEarned,
            {
              borderColor: rarityColor,
              backgroundColor: `${rarityColor}14`,
            },
          ]}
        >
          {cardContent}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function TitleWall({ onEquip, onUnequip, equippedId }: TitleWallProps) {
  const [activeCategory, setActiveCategory] = useState<Category>("ALL");
  const { unlockedIds } = useTitleStore();
  const { width: screenWidth } = useWindowDimensions();

  const cardWidth = (screenWidth - spacing.md * 2 - spacing.sm) / 2;

  const allTitles = useMemo(() => getAllTitleDefs(), []);

  const filteredTitles = useMemo(() => {
    if (activeCategory === "ALL") return allTitles;
    return allTitles.filter(
      (t) => t.category.toUpperCase() === activeCategory,
    );
  }, [allTitles, activeCategory]);

  const handleEquip = useCallback(
    (titleId: string) => {
      if (equippedId === titleId) {
        onUnequip();
      } else {
        onEquip(titleId);
      }
    },
    [equippedId, onEquip, onUnequip],
  );

  return (
    <View style={styles.container}>
      {/* Category filter tabs */}
      <View style={styles.filterRow}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveCategory(cat);
            }}
            style={[
              styles.filterTab,
              activeCategory === cat && styles.filterTabActive,
            ]}
          >
            <Text
              style={[
                styles.filterTabText,
                activeCategory === cat && styles.filterTabTextActive,
              ]}
            >
              {cat}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Title grid */}
      <View style={styles.grid}>
        {filteredTitles.map((titleDef, index) => {
          const isEarned = unlockedIds.includes(titleDef.id);
          const isEquipped = equippedId === titleDef.id;

          return (
            <TitleCard
              key={titleDef.id}
              titleDef={titleDef}
              isEarned={isEarned}
              isEquipped={isEquipped}
              onEquip={() => handleEquip(titleDef.id)}
              cardWidth={cardWidth}
              index={index}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: spacing.md,
  },
  filterTab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "transparent",
  },
  filterTabActive: {
    borderColor: colors.surfaceBorder,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  filterTabText: {
    fontFamily: fonts.mono.fontFamily,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  filterTabTextActive: {
    color: colors.text,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    minHeight: 110,
  },
  cardEarned: {
    borderColor: colors.surfaceBorder,
  },
  cardUnearned: {
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  cardInner: {
    flex: 1,
    borderRadius: radius.md - 1,
    padding: spacing.sm,
  },
  rarityTag: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
  },
  rarityText: {
    fontFamily: fonts.mono.fontFamily,
    fontSize: 8,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  earnedName: {
    fontWeight: fonts.title.fontWeight,
    fontSize: 13,
    color: colors.text,
    marginTop: spacing.xs,
    marginBottom: 4,
  },
  earnedDesc: {
    fontWeight: fonts.body.fontWeight,
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
    marginBottom: 6,
  },
  unearnedName: {
    fontWeight: fonts.title.fontWeight,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: 4,
  },
  unearnedDesc: {
    fontWeight: fonts.body.fontWeight,
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 6,
  },
  categoryTag: {
    fontFamily: fonts.mono.fontFamily,
    fontSize: 8,
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  equippedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  equippedCheck: {
    fontSize: 12,
    color: "#34d399",
  },
  equippedLabel: {
    fontFamily: fonts.mono.fontFamily,
    fontSize: 9,
    color: "#34d399",
    letterSpacing: 1,
  },
});
