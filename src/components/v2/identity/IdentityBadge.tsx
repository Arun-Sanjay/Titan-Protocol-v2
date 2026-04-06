import React from "react";
import { View, Text, StyleSheet, type TextStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "../../../theme";
import {
  useIdentityStore,
  selectIdentityMeta,
  type Archetype,
} from "../../../stores/useIdentityStore";

type BadgeSize = "small" | "medium" | "large";

type Props = {
  size?: BadgeSize;
  showIcon?: boolean;
  showVotes?: boolean;
  /** Override archetype (defaults to store value) */
  archetype?: Archetype | null;
};

const ENGINE_COLOR_MAP: Record<string, string> = {
  body: colors.body,
  mind: colors.mind,
  money: colors.money,
  charisma: colors.charisma,
  all: colors.primary,
};

const SIZE_CONFIG: Record<BadgeSize, { fontSize: number; fontWeight: TextStyle["fontWeight"]; iconSize: number; paddingV: number; paddingH: number }> = {
  small: { fontSize: 10, fontWeight: "700", iconSize: 12, paddingV: 4, paddingH: 8 },
  medium: { fontSize: 13, fontWeight: "600", iconSize: 16, paddingV: 6, paddingH: 12 },
  large: { fontSize: 16, fontWeight: "600", iconSize: 20, paddingV: 8, paddingH: 16 },
};

export function IdentityBadge({
  size = "medium",
  showIcon = true,
  showVotes = false,
  archetype: archetypeProp,
}: Props) {
  const storeArchetype = useIdentityStore((s) => s.archetype);
  const totalVotes = useIdentityStore((s) => s.totalVotes);

  const archetype = archetypeProp ?? storeArchetype;
  const meta = selectIdentityMeta(archetype);
  if (!meta) return null;

  const config = SIZE_CONFIG[size];
  const accentColor = ENGINE_COLOR_MAP[meta.primaryEngine] ?? colors.primary;

  return (
    <View
      style={[
        styles.badge,
        {
          paddingVertical: config.paddingV,
          paddingHorizontal: config.paddingH,
          borderColor: accentColor + "30", // 30 = ~19% opacity hex
        },
      ]}
    >
      {showIcon && (
        <Ionicons
          name={meta.iconName as keyof typeof Ionicons.glyphMap}
          size={config.iconSize}
          color={accentColor}
        />
      )}
      <Text
        style={[
          styles.name,
          {
            fontSize: config.fontSize,
            fontWeight: config.fontWeight,
            textTransform: size === "small" ? "uppercase" : "none",
            letterSpacing: size === "small" ? 1.5 : 0.5,
          },
        ]}
      >
        {meta.name}
      </Text>
      {showVotes && size === "large" && (
        <Text style={styles.votes}>{totalVotes}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  name: {
    color: colors.text,
  },
  votes: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    marginLeft: spacing.xs,
  },
});
