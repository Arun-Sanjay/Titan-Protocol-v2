import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { colors, spacing, fonts } from "../../../theme";
import { SkillBranch } from "./SkillBranch";
import { useSkillTreeStore, type SkillNodeProgress } from "../../../stores/useSkillTreeStore";
import { TitanProgress } from "../../ui/TitanProgress";

const ENGINE_COLORS: Record<string, string> = {
  body: colors.body,
  mind: colors.mind,
  money: colors.money,
  charisma: colors.charisma,
};

const ENGINE_LABELS: Record<string, string> = {
  body: "BODY",
  mind: "MIND",
  money: "MONEY",
  charisma: "CHARISMA",
};

type Props = {
  engine: string;
};

export function SkillTreeView({ engine }: Props) {
  const allProgress = useSkillTreeStore((s) => s.progress[engine] ?? []);
  const engineColor = ENGINE_COLORS[engine] ?? colors.primary;

  // Group nodes by branch
  const branchMap = new Map<string, SkillNodeProgress[]>();
  for (const node of allProgress) {
    if (!branchMap.has(node.branch)) branchMap.set(node.branch, []);
    branchMap.get(node.branch)!.push(node);
  }

  const totalNodes = allProgress.length;
  const completedNodes = allProgress.filter((n) => n.status === "claimed").length;
  const overallProgress = totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.engineLabel, { color: engineColor }]}>
          {ENGINE_LABELS[engine]} SKILL TREE
        </Text>
        <View style={styles.progressRow}>
          <TitanProgress value={overallProgress} color={engineColor} height={4} />
          <Text style={styles.progressText}>{completedNodes}/{totalNodes} nodes</Text>
        </View>
      </View>

      {/* Branches side by side */}
      {branchMap.size > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.branches}>
          {Array.from(branchMap.entries()).map(([branchId, nodes]) => (
            <SkillBranch
              key={branchId}
              name={branchId.replace(/_/g, " ")}
              nodes={nodes}
              engineColor={engineColor}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Skill tree not initialized yet</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
  },
  engineLabel: {
    ...fonts.kicker,
    fontSize: 10,
    letterSpacing: 2,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  progressText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
    width: 70,
  },
  branches: {
    gap: spacing.xl,
    paddingVertical: spacing.md,
  },
  empty: {
    alignItems: "center",
    paddingVertical: spacing["2xl"],
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
