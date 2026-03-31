import React, { useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../src/theme";
import { HUDBackground } from "../../src/components/ui/AnimatedBackground";
import { useSkillTreeStore, SKILL_TREES, type SkillNode, type SkillBranch } from "../../src/stores/useSkillTreeStore";
import type { EngineKey } from "../../src/db/schema";

// ─── Engine meta ──────────────────────────────────────────────────────────────

const ENGINE_LABELS: Record<EngineKey, string> = {
  body: "BODY", mind: "MIND", money: "MONEY", charisma: "CHARISMA",
};
const ENGINE_COLORS: Record<EngineKey, string> = {
  body: colors.body, mind: colors.mind, money: colors.money, charisma: colors.charisma,
};
const ENGINE_DIM: Record<EngineKey, string> = {
  body: colors.bodyDim, mind: colors.mindDim, money: colors.moneyDim, charisma: colors.charismaDim,
};

// ─── Node Card ────────────────────────────────────────────────────────────────

function NodeCard({
  node,
  state,
  engineColor,
  engineDim,
  onUnlock,
}: {
  node: SkillNode;
  state: "unlocked" | "unlockable" | "locked";
  engineColor: string;
  engineDim: string;
  onUnlock: (nodeId: string) => void;
}) {
  const isUnlocked = state === "unlocked";
  const isUnlockable = state === "unlockable";

  return (
    <View
      style={[
        nodeStyles.card,
        isUnlocked && { borderColor: engineColor + "50", backgroundColor: engineDim },
        isUnlockable && { borderColor: engineColor + "80" },
        state === "locked" && nodeStyles.cardLocked,
      ]}
    >
      {/* Status icon */}
      <View style={[nodeStyles.iconWrap, isUnlocked && { backgroundColor: engineColor + "25" }]}>
        <Text style={[nodeStyles.icon, isUnlocked && { color: engineColor }]}>
          {isUnlocked ? "◆" : isUnlockable ? "◇" : "○"}
        </Text>
      </View>

      {/* Name + description */}
      <View style={{ flex: 1 }}>
        <Text
          style={[
            nodeStyles.name,
            isUnlocked && { color: engineColor },
            state === "locked" && { color: colors.textMuted },
          ]}
          numberOfLines={1}
        >
          {node.name}
        </Text>
        <Text style={[nodeStyles.condition, state === "locked" && { color: "rgba(210,220,242,0.3)" }]} numberOfLines={1}>
          {node.conditionText}
        </Text>
      </View>

      {/* Unlock button or badge */}
      {isUnlocked ? (
        <View style={[nodeStyles.badge, { borderColor: engineColor + "40", backgroundColor: engineColor + "15" }]}>
          <Text style={[nodeStyles.badgeText, { color: engineColor }]}>DONE</Text>
        </View>
      ) : isUnlockable ? (
        <Pressable
          style={[nodeStyles.unlockBtn, { borderColor: engineColor, backgroundColor: engineColor + "15" }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onUnlock(node.id);
          }}
          hitSlop={8}
        >
          <Text style={[nodeStyles.unlockBtnText, { color: engineColor }]}>UNLOCK</Text>
        </Pressable>
      ) : (
        <View style={nodeStyles.lockIcon}>
          <Text style={nodeStyles.lockIconText}>🔒</Text>
        </View>
      )}
    </View>
  );
}

const nodeStyles = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: radius.md,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  cardLocked: {
    opacity: 0.45,
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: radius.sm,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  icon: { fontSize: 14, color: colors.textMuted },
  name: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 2 },
  condition: { ...fonts.kicker, fontSize: 8, color: colors.textMuted },
  badge: {
    borderRadius: radius.sm, borderWidth: 1,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  badgeText: { ...fonts.kicker, fontSize: 8 },
  unlockBtn: {
    borderRadius: radius.sm, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 5,
    minWidth: 60, alignItems: "center",
  },
  unlockBtnText: { ...fonts.kicker, fontSize: 9 },
  lockIcon: { width: 28, alignItems: "center" },
  lockIconText: { fontSize: 14 },
});

// ─── Branch Section ───────────────────────────────────────────────────────────

function BranchSection({
  branch,
  unlockedNodes,
  engineColor,
  engineDim,
  onUnlock,
}: {
  branch: SkillBranch;
  unlockedNodes: Set<string>;
  engineColor: string;
  engineDim: string;
  onUnlock: (nodeId: string) => void;
}) {
  const unlockedCount = branch.nodes.filter((n) => unlockedNodes.has(n.id)).length;

  return (
    <View style={branchStyles.section}>
      {/* Branch header */}
      <View style={branchStyles.header}>
        <View style={[branchStyles.dot, { backgroundColor: engineColor }]} />
        <Text style={branchStyles.branchName}>{branch.name}</Text>
        <Text style={branchStyles.branchProgress}>
          {unlockedCount}/{branch.nodes.length}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={branchStyles.progressTrack}>
        <View
          style={[
            branchStyles.progressFill,
            {
              width: `${(unlockedCount / branch.nodes.length) * 100}%` as any,
              backgroundColor: engineColor,
            },
          ]}
        />
      </View>

      {/* Nodes */}
      <View style={branchStyles.nodes}>
        {branch.nodes.map((node, i) => {
          let state: "unlocked" | "unlockable" | "locked";
          if (unlockedNodes.has(node.id)) {
            state = "unlocked";
          } else if (i === 0 || unlockedNodes.has(branch.nodes[i - 1].id)) {
            state = "unlockable";
          } else {
            state = "locked";
          }
          return (
            <NodeCard
              key={node.id}
              node={node}
              state={state}
              engineColor={engineColor}
              engineDim={engineDim}
              onUnlock={onUnlock}
            />
          );
        })}
      </View>
    </View>
  );
}

const branchStyles = StyleSheet.create({
  section: { marginBottom: spacing.xl },
  header: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  branchName: { ...fonts.kicker, fontSize: 10, color: colors.text, flex: 1 },
  branchProgress: { ...fonts.mono, fontSize: 11, color: colors.textMuted },
  progressTrack: {
    height: 2, backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 1, marginBottom: spacing.md, overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 1 },
  nodes: {},
});

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SkillTreePage() {
  const router = useRouter();
  const { engine: engineParam } = useLocalSearchParams<{ engine: string }>();
  const engine = (engineParam ?? "body") as EngineKey;

  const unlockedNodes = useSkillTreeStore((s) => s.unlockedNodes);
  const unlockNode = useSkillTreeStore((s) => s.unlockNode);
  const getProgress = useSkillTreeStore((s) => s.getProgress);

  const branches = SKILL_TREES[engine] ?? [];
  const engineColor = ENGINE_COLORS[engine] ?? colors.text;
  const engineDim = ENGINE_DIM[engine] ?? colors.bodyDim;
  const { unlocked, total } = useMemo(() => getProgress(engine), [unlockedNodes, engine]);

  const handleUnlock = (nodeId: string) => {
    unlockNode(nodeId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <HUDBackground />

      {/* Header bar */}
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backText}>← BACK</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <View style={[styles.engineBadge, { borderColor: engineColor + "60" }]}>
          <Text style={[styles.engineBadgeText, { color: engineColor }]}>
            {ENGINE_LABELS[engine]}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Title + overall progress */}
        <Text style={styles.pageTitle}>SKILL TREE</Text>
        <Text style={[styles.engineTitle, { color: engineColor }]}>
          {ENGINE_LABELS[engine]} ENGINE
        </Text>
        <Text style={styles.subtitle}>
          Unlock nodes by completing milestones. Each unlock reinforces your identity.
        </Text>

        {/* Overall progress */}
        <View style={styles.overallProgress}>
          <View style={styles.overallTrack}>
            <View
              style={[
                styles.overallFill,
                { width: `${total > 0 ? (unlocked / total) * 100 : 0}%` as any, backgroundColor: engineColor },
              ]}
            />
          </View>
          <Text style={styles.overallText}>
            {unlocked}/{total} nodes unlocked
          </Text>
        </View>

        {/* Branch sections */}
        {branches.map((branch) => (
          <BranchSection
            key={branch.id}
            branch={branch}
            unlockedNodes={unlockedNodes}
            engineColor={engineColor}
            engineDim={engineDim}
            onUnlock={handleUnlock}
          />
        ))}

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
  },
  back: { paddingVertical: spacing.xs },
  backText: { ...fonts.kicker, fontSize: 10, color: colors.textMuted },
  engineBadge: {
    borderRadius: radius.sm, borderWidth: 1,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  engineBadgeText: { ...fonts.kicker, fontSize: 9 },

  pageTitle: {
    ...fonts.kicker, fontSize: 9, color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  engineTitle: {
    fontSize: 28, fontWeight: "700", letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 13, color: colors.textSecondary, lineHeight: 18,
    marginBottom: spacing.xl,
  },

  overallProgress: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    marginBottom: spacing["2xl"],
  },
  overallTrack: {
    flex: 1, height: 4, backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 2, overflow: "hidden",
  },
  overallFill: { height: "100%", borderRadius: 2 },
  overallText: { ...fonts.mono, fontSize: 11, color: colors.textMuted, minWidth: 110 },
});
