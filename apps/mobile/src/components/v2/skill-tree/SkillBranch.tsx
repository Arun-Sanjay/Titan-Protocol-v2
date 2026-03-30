import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, fonts } from "../../../theme";
import { SkillNode } from "./SkillNode";
import type { SkillNodeProgress } from "../../../stores/useSkillTreeStore";

type Props = {
  name: string;
  nodes: SkillNodeProgress[];
  engineColor: string;
};

export function SkillBranch({ name, nodes, engineColor }: Props) {
  const sorted = [...nodes].sort((a, b) => a.level - b.level);
  const completed = sorted.filter((n) => n.status === "completed").length;

  return (
    <View style={styles.container}>
      <Text style={[styles.name, { color: engineColor }]}>{name}</Text>
      <Text style={styles.progress}>{completed}/{sorted.length}</Text>

      <View style={styles.nodes}>
        {sorted.map((node, idx) => (
          <React.Fragment key={node.nodeId}>
            {idx > 0 && (
              <View
                style={[
                  styles.connector,
                  node.status === "completed" || (idx > 0 && sorted[idx - 1].status === "completed")
                    ? { backgroundColor: engineColor + "60" }
                    : {},
                ]}
              />
            )}
            <SkillNode
              status={node.status}
              name={node.name ?? `Lv${node.level}`}
              level={node.level}
              engineColor={engineColor}
              progress={node.progress}
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
    width: 1.5,
    height: 12,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 1,
  },
});
