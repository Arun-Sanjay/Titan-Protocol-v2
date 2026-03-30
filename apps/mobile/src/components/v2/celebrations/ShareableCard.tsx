import React, { forwardRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, fonts } from "../../../theme";
import { useIdentityStore, selectIdentityMeta } from "../../../stores/useIdentityStore";

export type ShareCardType = "achievement" | "boss" | "milestone" | "score" | "perfect_day" | "titan_unlock" | "phase";

type Props = {
  type: ShareCardType;
  title: string;
  subtitle?: string;
  value?: string;
  rarity?: string;
  date?: string;
};

/**
 * Styled card for social media screenshots.
 * Render off-screen (position absolute, opacity 0) and capture with captureRef.
 */
export const ShareableCard = forwardRef<View, Props>(function ShareableCard(
  { type, title, subtitle, value, rarity, date },
  ref,
) {
  const archetype = useIdentityStore((s) => s.archetype);
  const meta = selectIdentityMeta(archetype);

  const accentColor = getAccentColor(type, rarity);

  return (
    <View ref={ref} style={styles.card} collapsable={false}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="flash" size={16} color={accentColor} />
        <Text style={styles.brand}>TITAN PROTOCOL</Text>
      </View>

      {/* Main content */}
      <View style={styles.body}>
        {rarity && (
          <Text style={[styles.rarity, { color: accentColor }]}>
            {rarity.toUpperCase()}
          </Text>
        )}

        <Text style={[styles.title, { color: accentColor }]}>{title}</Text>

        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

        {value && <Text style={[styles.value, { color: accentColor }]}>{value}</Text>}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        {meta && <Text style={styles.identity}>{meta.name}</Text>}
        {date && <Text style={styles.date}>{date}</Text>}
      </View>
    </View>
  );
});

function getAccentColor(type: ShareCardType, rarity?: string): string {
  if (type === "titan_unlock") return "#FFD700";
  if (type === "perfect_day") return colors.warning;
  if (type === "boss") return colors.warning;
  if (type === "achievement") {
    switch (rarity) {
      case "legendary": return "#FFD700";
      case "epic": return colors.mind;
      case "rare": return colors.warning;
      case "uncommon": return colors.general;
      default: return colors.textSecondary;
    }
  }
  return colors.primary;
}

const styles = StyleSheet.create({
  card: {
    width: 360,
    backgroundColor: "#000000",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    padding: spacing["2xl"],
    gap: spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  brand: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 3,
  },
  body: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  rarity: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "400",
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  value: {
    ...fonts.monoValue,
    fontSize: 28,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  identity: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
    letterSpacing: 1,
  },
  date: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.textMuted,
  },
});
