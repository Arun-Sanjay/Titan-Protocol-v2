import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, fonts } from "../../../theme";
import { SkillNode } from "./SkillNode";
import type { SkillNodeProgress } from "../../../stores/useSkillTreeStore";

type Props = {
  name: string;
  nodes: SkillNodeProgress[];
  engineColor: string;
  onClaimNode?: (nodeId: string) => void;
};

export function SkillBranch({ name, nodes, engineColor, onClaimNode }: Props) {
  const sorted = [...nodes].sort((a, b) => a.level - b.level);
  const claimed = sorted.filter((n) => n.status === "claimed").length;

  /** Determine connector line style between node at idx-1 and idx. */
  function getConnectorStyle(idx: number): object {
    const prev = sorted[idx - 1];
    const curr = sorted[idx];

    // Both claimed -> solid engineColor
    if (prev.status === "claimed" && curr.status === "claimed") {
      return { backgroundColor: engineColor };
    }

    // Claimed -> ready -> dashed engineColor (simulate with dotted bg)
    if (prev.status === "claimed" && curr.status === "ready") {
      return { backgroundColor: engineColor, opacity: 0.5 };
    }

    // Everything else (locked -> locked, etc.) -> dim solid
    return { backgroundColor: "rgba(255, 255, 255, 0.06)" };
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.name, { color: engineColor }]}>{name}</Text>
      <Text style={styles.progress}>
        {claimed}/{sorted.length}
      </Text>

      <View style={styles.nodes}>
        {sorted.map((node, idx) => (
          <React.Fragment key={node.nodeId}>
            {idx > 0 && (
              <View style={[styles.connector, getConnectorStyle(idx)]} />
            )}
            <SkillNode
              status={node.status}
              name={node.name ?? `Lv${node.level}`}
              level={node.level}
              engineColor={engineColor}
              progress={node.progress}
              progressText={node.progressText}
              onClaim={
                node.status === "ready" && onClaimNode
                  ? () => onClaimNode(node.nodeId)
                  : undefined
              }
            />
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 70,
  },
  name: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  progress: {
    fontSize: 9,
    fontWeight: "500",
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  nodes: {
    alignItems: "center",
    gap: 2,
  },
  connector: {
    width: 2,
    height: 16,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 1,
  },
});
