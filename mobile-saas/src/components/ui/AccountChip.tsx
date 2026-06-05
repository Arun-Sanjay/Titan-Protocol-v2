import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useProfile } from "../../hooks/queries/useProfile";
import { useAuthStore } from "../../stores/useAuthStore";
import { getRankForLevel } from "../../db/gamification";
import { TitanProgress } from "./TitanProgress";
import { colors, fonts, spacing, radius } from "../../theme";

const XP_PER_LEVEL = 500;

function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/**
 * Notion/Claude-style account chip — mobile port of web's UserMenu, rendered
 * as a static header card (no dropdown). Avatar + name + email + rank/level/XP.
 */
export const AccountChip = React.memo(function AccountChip() {
  const { data: profile } = useProfile();
  const email = useAuthStore((s) => s.user?.email) ?? profile?.email ?? "";

  const level = profile?.level ?? 1;
  const xp = profile?.xp ?? 0;
  const rank = getRankForLevel(level);
  const name = profile?.display_name?.trim() || (email ? email.split("@")[0] : "Operator");

  const xpInLevel = Math.max(0, xp - (level - 1) * XP_PER_LEVEL);
  const pct = Math.max(0, Math.min(100, (xpInLevel / XP_PER_LEVEL) * 100));

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={[styles.avatar, { borderColor: rank.color, backgroundColor: rank.color + "22" }]}>
          <Text style={[styles.initials, { color: rank.color }]}>{initialsFor(name)}</Text>
        </View>
        <View style={styles.nameCol}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.email} numberOfLines={1}>
            {email || "—"}
          </Text>
        </View>
      </View>

      <View style={styles.statRow}>
        <Text style={[styles.rankName, { color: rank.color }]}>{rank.name}</Text>
        <Text style={styles.level}>· LVL {level}</Text>
        <View style={styles.spacer} />
        <Text style={styles.xp}>
          {xpInLevel}/{XP_PER_LEVEL} XP
        </Text>
      </View>

      <TitanProgress value={pct} color={rank.color} shimmer={false} />
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    padding: spacing.lg,
    gap: spacing.md,
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { ...fonts.mono, fontSize: 16, fontWeight: "700" },
  nameCol: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...fonts.subheading, fontSize: 16, color: colors.text },
  email: { ...fonts.small, fontSize: 12, color: colors.textMuted },
  statRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  rankName: { ...fonts.kicker, fontSize: 11, letterSpacing: 1.5 },
  level: { ...fonts.kicker, fontSize: 11, color: colors.textMuted, letterSpacing: 1 },
  spacer: { flex: 1 },
  xp: { ...fonts.mono, fontSize: 11, color: colors.textMuted },
});
