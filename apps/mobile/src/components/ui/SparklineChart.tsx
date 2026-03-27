import React, { useRef } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Polyline, Defs, LinearGradient, Stop, Polygon, Circle } from "react-native-svg";
import { colors } from "../../theme";

type Props = {
  data: number[]; // array of scores (0-100)
  width?: number;
  height?: number;
  color?: string;
};

export const SparklineChart = React.memo(function SparklineChart({
  data,
  width = 120,
  height = 40,
  color = "rgba(247, 250, 255, 0.9)",
}: Props) {
  // Bug 22: unique gradient ID per instance to avoid collisions
  const gradId = useRef(`sparkFill-${Math.random().toString(36).slice(2)}`).current;

  // Bug 24: clamp values to 0-100
  const clamped = data.map(v => Math.max(0, Math.min(100, v)));

  // Bug 23: single data point renders a dot instead of empty view
  if (clamped.length === 0) return <View style={{ width, height }} />;

  const padding = 2;
  const maxVal = 100;
  const w = width - padding * 2;
  const h = height - padding * 2;

  if (clamped.length === 1) {
    const cx = padding + w / 2;
    const cy = padding + h - (clamped[0] / maxVal) * h;
    return (
      <Svg width={width} height={height}>
        <Circle cx={cx} cy={cy} r={3} fill={color} />
      </Svg>
    );
  }

  const points = clamped.map((val, i) => {
    const x = padding + (i / (clamped.length - 1)) * w;
    const y = padding + h - (val / maxVal) * h;
    return `${x},${y}`;
  });

  const linePoints = points.join(" ");

  // Area fill polygon (line + bottom edge)
  const areaPoints = [
    ...points,
    `${padding + w},${padding + h}`,
    `${padding},${padding + h}`,
  ].join(" ");

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Polygon points={areaPoints} fill={`url(#${gradId})`} />
      <Polyline
        points={linePoints}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
});
