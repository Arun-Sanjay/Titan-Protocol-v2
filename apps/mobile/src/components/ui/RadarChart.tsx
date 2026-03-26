import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Polygon, Line, Circle } from "react-native-svg";
import { colors, fonts } from "../../theme";
import type { EngineKey } from "../../db/schema";

type Props = {
  scores: Record<EngineKey, number>; // 0-100
  size?: number;
};

const AXES: { key: EngineKey; label: string }[] = [
  { key: "body", label: "Body" },
  { key: "mind", label: "Mind" },
  { key: "money", label: "Money" },
  { key: "general", label: "General" },
];

function polarToXY(cx: number, cy: number, r: number, angleIndex: number, total: number) {
  const angle = (Math.PI * 2 * angleIndex) / total - Math.PI / 2;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

export const RadarChart = React.memo(function RadarChart({ scores, size = 180 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 24; // leave room for labels
  const n = AXES.length;

  // Grid rings at 25%, 50%, 75%, 100%
  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  // Data polygon points
  const dataPoints = AXES.map((axis, i) => {
    const val = (scores[axis.key] ?? 0) / 100;
    const r = val * maxR;
    return polarToXY(cx, cy, r, i, n);
  });
  const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  // Label positions (slightly outside max radius)
  const labelR = maxR + 18;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Grid rings */}
        {gridLevels.map((level) => {
          const r = level * maxR;
          const pts = Array.from({ length: n }, (_, i) => polarToXY(cx, cy, r, i, n));
          return (
            <Polygon
              key={level}
              points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="rgba(255, 255, 255, 0.06)"
              strokeWidth={1}
            />
          );
        })}

        {/* Axis lines */}
        {Array.from({ length: n }, (_, i) => {
          const p = polarToXY(cx, cy, maxR, i, n);
          return (
            <Line
              key={i}
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              stroke="rgba(255, 255, 255, 0.06)"
              strokeWidth={1}
            />
          );
        })}

        {/* Data polygon */}
        <Polygon
          points={dataPolygon}
          fill="rgba(247, 250, 255, 0.08)"
          stroke="rgba(247, 250, 255, 0.7)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* Data dots */}
        {dataPoints.map((p, i) => (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3}
            fill="rgba(247, 250, 255, 0.9)"
          />
        ))}
      </Svg>

      {/* Labels */}
      {AXES.map((axis, i) => {
        const pos = polarToXY(cx, cy, labelR, i, n);
        return (
          <Text
            key={axis.key}
            style={[
              styles.label,
              {
                position: "absolute",
                left: pos.x - 24,
                top: pos.y - 7,
                width: 48,
                textAlign: "center",
              },
            ]}
          >
            {axis.label}
          </Text>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  label: {
    ...fonts.kicker,
    fontSize: 9,
    color: colors.textSecondary,
  },
});
