import React, { useMemo, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../src/theme";
import { HUDBackground } from "../../src/components/ui/AnimatedBackground";
import { useSkillTreeStore, SKILL_TREES, type SkillBranch } from "../../src/stores/useSkillTreeStore";
import { initializeAllTrees, evaluateAllTrees } from "../../src/lib/skill-tree-evaluator";
import type { EngineKey } from "../../src/db/schema";

// Stable empty array to prevent Zustand getSnapshot infinite loop
const EMPTY_PROGRESS: never[] = [];

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

// ─── Node Card (3 states: locked / ready / claimed) ─────────────────────────

function NodeCard({
  nodeId,
  name,
  conditionText,
  status,
  engineColor,
  engineDim,
  onClaim,
}: {
  nodeId: string;
  name: string;
  conditionText: string;
  status: "locked" | "ready" | "claimed";
  engineColor: string;
  engineDim: string;
  onClaim: (nodeId: string) => void;
}) {
  // Pulse animation for ready nodes
  const pulse = useSharedValue(1);
  React.useEffect(() => {
    if (status === "ready") {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    }
  }, [status]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: status === "ready" ? [{ scale: pulse.value }] : [],
  }));

  return (
    <Animated.View style={pulseStyle}>
      <View
        style={[
          nodeStyles.card,
          status === "claimed" && { borderColor: engineColor + "50", backgroundColor: engineDim },
          status === "ready" && { borderColor: engineColor, borderWidth: 1.5 },
          status === "locked" && nodeStyles.cardLocked,
        ]}
      >
        {/* Status icon */}
        <View style={[
          nodeStyles.iconWrap,
          status === "claimed" && { backgroundColor: engineColor + "25" },
          status === "ready" && { backgroundColor: engineColor + "20", borderWidth: 1, borderColor: engineColor + "50" },
        ]}>
          <Text style={[
            nodeStyles.icon,
            status === "claimed" && { color: engineColor },
            status === "ready" && { color: engineColor },
          ]}>
            {status === "claimed" ? "✓" : status === "ready" ? "★" : "🔒"}
          </Text>
        </View>

        {/* Name + description */}
        <View style={{ flex: 1 }}>
          <Text
            style={[
              nodeStyles.name,
              status === "claimed" && { color: engineColor },
              status === "ready" && { color: engineColor },
              status === "locked" && { color: colors.textMuted },
            ]}
            numberOfLines={1}
          >
            {name}
          </Text>
          <Text style={[nodeStyles.condition, status === "locked" && { color: "rgba(210,220,242,0.3)" }]} numberOfLines={1}>
            {conditionText}
          </Text>
        </View>

        {/* Action button */}
        {status === "claimed" ? (
          <View style={[nodeStyles.badge, { borderColor: engineColor + "40", backgroundColor: engineColor + "15" }]}>
            <Text style={[nodeStyles.badgeText, { color: engineColor }]}>CLAIMED</Text>
          </View>
        ) : status === "ready" ? (
          <Pressable
            style={[nodeStyles.claimBtn, { borderColor: engineColor, backgroundColor: engineColor + "15" }]}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onClaim(nodeId);
            }}
            hitSlop={8}
          >
            <Text style={[nodeStyles.claimBtnText, { color: engineColor }]}>CLAIM</Text>
          </Pressable>
        ) : (
          <View style={nodeStyles.lockIcon}>
            <Text style={nodeStyles.lockIconText}>🔒</Text>
          </View>
        )}
      </View>
    </Animated.View>
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
  cardLocked: { opacity: 0.45 },
  iconWrap: {
    width: 36, height: 36, borderRadius: radius.sm,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  icon: { fontSize: 16, color: colors.textMuted },
  name: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 2 },
  condition: { ...fonts.kicker, fontSize: 8, color: colors.textMuted },
  badge: {
    borderRadius: radius.sm, borderWidth: 1,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  badgeText: { ...fonts.kicker, fontSize: 8 },
  claimBtn: {
    borderRadius: radius.sm, borderWidth: 1.5,
    paddingHorizontal: 12, paddingVertical: 6,
    minWidth: 64, alignItems: "center",
  },
  claimBtnText: { ...fonts.kicker, fontSize: 9, fontWeight: "700" },
  lockIcon: { width: 28, alignItems: "center" },
  lockIconText: { fontSize: 14 },
});

// ─── Branch Section ───────────────────────────────────────────────────────────

function BranchSection({
  branch,
  engine,
  engineColor,
  engineDim,
  onClaim,
}: {
  branch: SkillBranch;
  engine: string;
  engineColor: string;
  engineDim: string;
  onClaim: (nodeId: string) => void;
}) {
  const progress = useSkillTreeStore((s) => s.progress[engine] ?? EMPTY_PROGRESS);
  const unlockedNodes = useSkillTreeStore((s) => s.unlockedNodes);

  // Determine node status from the progress store
  const getNodeStatus = (nodeId: string, index: number): "locked" | "ready" | "claimed" => {
    const nodeProgress = progress.find((n) => n.nodeId === nodeId);
    if (nodeProgress) {
      if (nodeProgress.status === "claimed") return "claimed";
      if (nodeProgress.status === "ready") return "ready";
    }
    // Fallback: check unlockedNodes set for backward compat
    if (unlockedNodes.has(nodeId)) return "claimed";
    return "locked";
  };

  const claimedCount = branch.nodes.filter((n) => getNodeStatus(n.id, 0) === "claimed").length;

  return (
    <View style={branchStyles.section}>
      <View style={branchStyles.header}>
        <View style={[branchStyles.dot, { backgroundColor: engineColor }]} />
        <Text style={branchStyles.branchName}>{branch.name}</Text>
        <Text style={branchStyles.branchProgress}>
          {claimedCount}/{branch.nodes.length}
        </Text>
      </View>

      <View style={branchStyles.progressTrack}>
        <View
          style={[
            branchStyles.progressFill,
            { width: `${(claimedCount / branch.nodes.length) * 100}%` as any, backgroundColor: engineColor },
          ]}
        />
      </View>

      <View style={branchStyles.nodes}>
        {branch.nodes.map((node, i) => (
          <NodeCard
            key={node.id}
            nodeId={node.id}
            name={node.name}
            conditionText={node.conditionText}
            status={getNodeStatus(node.id, i)}
            engineColor={engineColor}
            engineDim={engineDim}
            onClaim={onClaim}
          />
        ))}
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

  const claimNode = useSkillTreeStore((s) => s.claimNode);
  const getProgress = useSkillTreeStore((s) => s.getProgress);
  const progress = useSkillTreeStore((s) => s.progress);

  // Initialize and evaluate skill trees on mount
  useEffect(() => {
    initializeAllTrees();
    evaluateAllTrees();
  }, []);

  const branches = SKILL_TREES[engine] ?? [];
  const engineColor = ENGINE_COLORS[engine] ?? colors.text;
  const engineDim = ENGINE_DIM[engine] ?? colors.bodyDim;
  const { unlocked, total } = useMemo(() => getProgress(engine), [progress, engine]);

  const handleClaim = (nodeId: string) => {
    claimNode(engine, nodeId);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <HUDBackground />

      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backText}>{"\u2190"} BACK</Text>
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
        <Text style={styles.pageTitle}>SKILL TREE</Text>
        <Text style={[styles.engineTitle, { color: engineColor }]}>
          {ENGINE_LABELS[engine]} ENGINE
        </Text>
        <Text style={styles.subtitle}>
          Earn nodes through real performance. Claim them when ready.
        </Text>

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
            {unlocked}/{total} nodes claimed
          </Text>
        </View>

        {branches.map((branch) => (
          <BranchSection
            key={branch.id}
            branch={branch}
            engine={engine}
            engineColor={engineColor}
            engineDim={engineDim}
            onClaim={handleClaim}
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
