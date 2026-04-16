import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, fonts } from "../../../theme";
import type { Tables } from "../../../types/supabase";
import { formatDateShort } from "../../../lib/date";

type NarrativeLogRow = Tables<"narrative_log">;

type NarrativeEntryType =
  | "milestone"
  | "phase"
  | "boss"
  | "achievement"
  | "identity"
  | "streak"
  | "skill";

const TYPE_CONFIG: Record<NarrativeEntryType, { icon: string; color: string }> = {
  milestone: { icon: "flag", color: colors.warning },
  phase: { icon: "rocket", color: colors.charisma },
  boss: { icon: "trophy", color: colors.warning },
  achievement: { icon: "ribbon", color: colors.mind },
  identity: { icon: "person", color: colors.primary },
  streak: { icon: "flame", color: colors.danger },
  skill: { icon: "git-branch", color: colors.body },
};

type Props = {
  entry: NarrativeLogRow;
};

export function NarrativeEntryCard({ entry }: Props) {
  const config = TYPE_CONFIG[entry.type as NarrativeEntryType] ?? TYPE_CONFIG.milestone;

  return (
    <View style={styles.container}>
      {/* Timeline dot + line */}
      <View style={styles.timeline}>
        <View style={[styles.dot, { backgroundColor: config.color }]}>
          <Ionicons
            name={config.icon as keyof typeof Ionicons.glyphMap}
            size={12}
            color={colors.bg}
          />
        </View>
        <View style={styles.line} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: config.color }]} numberOfLines={1}>
            {entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}
          </Text>
          <Text style={styles.date}>{formatDateShort(entry.date_key)}</Text>
        </View>
        <Text style={styles.body}>{entry.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 60,
  },
  timeline: {
    alignItems: "center",
    width: 28,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  line: {
    flex: 1,
    width: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginTop: 4,
  },
  content: {
    flex: 1,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  date: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.textMuted,
  },
  body: {
    fontSize: 13,
    fontWeight: "400",
    color: colors.textSecondary,
    lineHeight: 20,
  },
  stats: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  stat: {
    ...fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
  },
});
