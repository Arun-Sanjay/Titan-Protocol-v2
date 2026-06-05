import React from "react";
import { View } from "react-native";
import Svg, { Polygon, Line, Circle, Text as SvgText } from "react-native-svg";
import Animated, { FadeIn } from "react-native-reanimated";
import { colors } from "../../theme";

export type RadarDatum = { subject: string; score: number };

type Props = {
  data: RadarDatum[];
  /** Rendered width/height in px. The chart math stays in a 200×200 viewBox. */
  size?: number;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  gridStroke?: string;
  labelColor?: string;
  labelFontSize?: number;
  dotColor?: string;
  dotRadius?: number;
  /** Fade in on mount. Default true. */
  animated?: boolean;
};

// Geometry mirrors web's MiniRadarChart (web/src/components/ui/MiniCharts.tsx)
// exactly so the mobile radar matches the desktop one 1:1.
const VIEWBOX = 200;
const CENTER = VIEWBOX / 2; // 100
const OUTER_R = VIEWBOX * 0.32; // 64
const LABEL_R = OUTER_R + 16; // 80
const LEVELS = [0.25, 0.5, 0.75, 1];

function angleFor(i: number, n: number): number {
  return (Math.PI * 2 * i) / n - Math.PI / 2; // -90° so axis 0 points up
}

function pointAt(i: number, r: number, n: number): [number, number] {
  const a = angleFor(i, n);
  return [CENTER + Math.cos(a) * r, CENTER + Math.sin(a) * r];
}

/**
 * Engine-overview radar chart. Pure react-native-svg (no extra deps); same
 * polygon/grid geometry as the web dashboard's MiniRadarChart.
 */
export const RadarChart = React.memo(function RadarChart({
  data,
  size = 220,
  stroke = "rgba(222,231,243,0.80)",
  fill = "rgba(222,231,243,0.15)",
  strokeWidth = 1.5,
  gridStroke = "rgba(255,255,255,0.07)",
  labelColor = colors.textMuted,
  labelFontSize = 10,
  dotColor,
  dotRadius = 2,
  animated = true,
}: Props) {
  if (!data || data.length < 3) return null;
  const n = data.length;

  const dataPoints = data.map((d, i) =>
    pointAt(i, (Math.max(0, Math.min(100, d.score)) / 100) * OUTER_R, n),
  );
  const dataPolygon = dataPoints.map(([x, y]) => `${x},${y}`).join(" ");

  const rings = LEVELS.map((level) =>
    data
      .map((_, i) => pointAt(i, OUTER_R * level, n))
      .map(([x, y]) => `${x},${y}`)
      .join(" "),
  );

  const svg = (
    <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
      {/* concentric grid rings */}
      {rings.map((pts, idx) => (
        <Polygon key={`ring-${idx}`} points={pts} fill="none" stroke={gridStroke} strokeWidth={0.5} />
      ))}
      {/* radial axes */}
      {data.map((_, i) => {
        const [x, y] = pointAt(i, OUTER_R, n);
        return (
          <Line key={`axis-${i}`} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke={gridStroke} strokeWidth={0.5} />
        );
      })}
      {/* data shape */}
      <Polygon points={dataPolygon} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />
      {/* vertex dots */}
      {dataPoints.map(([x, y], i) => (
        <Circle key={`dot-${i}`} cx={x} cy={y} r={dotRadius} fill={dotColor ?? stroke} />
      ))}
      {/* axis labels */}
      {data.map((d, i) => {
        const [x, y] = pointAt(i, LABEL_R, n);
        return (
          <SvgText
            key={`label-${i}`}
            x={x}
            y={y + labelFontSize / 3}
            fill={labelColor}
            fontSize={labelFontSize}
            textAnchor="middle"
          >
            {d.subject}
          </SvgText>
        );
      })}
    </Svg>
  );

  if (!animated) {
    return <View style={{ width: size, height: size }}>{svg}</View>;
  }
  return (
    <Animated.View entering={FadeIn.duration(500)} style={{ width: size, height: size }}>
      {svg}
    </Animated.View>
  );
});
