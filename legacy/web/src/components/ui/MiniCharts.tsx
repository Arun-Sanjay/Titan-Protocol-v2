/**
 * Lightweight zero-dependency chart components with smooth animations.
 * Pure CSS/SVG charts (~6KB).
 *
 * Components:
 * - MiniLineChart: sparkline / trend line with draw animation
 * - MiniBarChart: vertical bar chart with rise animation
 * - MiniRadarChart: radar/spider chart with scale animation
 */

import * as React from "react";

// ─── Shared ─────────────────────────────────────────────────────────────────

const ANIM_DURATION = "0.8s";
const ANIM_EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

function uid() {
  return "c" + Math.random().toString(36).slice(2, 9);
}

// ─── MiniLineChart (Sparkline) ──────────────────────────────────────────────

type LineChartProps = {
  data: Array<{ [key: string]: unknown }>;
  dataKey: string;
  xKey?: string;
  width?: string | number;
  height?: number;
  stroke?: string;
  strokeWidth?: number;
  showDots?: boolean;
  showGrid?: boolean;
  showAxes?: boolean;
  showTooltip?: boolean;
  domain?: [number, number];
  className?: string;
  lines?: Array<{
    dataKey: string;
    stroke: string;
    strokeWidth?: number;
    strokeDasharray?: string;
  }>;
};

export function MiniLineChart({
  data,
  dataKey,
  xKey,
  width = "100%",
  height = 40,
  stroke = "rgba(222,231,243,0.95)",
  strokeWidth = 1.8,
  showDots = false,
  showGrid = false,
  showAxes = false,
  showTooltip = false,
  domain,
  className,
  lines,
}: LineChartProps) {
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = React.useState(400);
  const idRef = React.useRef(uid());

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setContainerW(Math.round(w));
    });
    obs.observe(el);
    setContainerW(el.clientWidth || 400);
    return () => obs.disconnect();
  }, []);

  if (!data || data.length === 0) return null;

  const pad = showAxes
    ? { top: 12, right: 12, bottom: 28, left: 40 }
    : { top: 6, right: 6, bottom: 6, left: 6 };

  const svgW = containerW;
  const svgH = height;
  const plotW = svgW - pad.left - pad.right;
  const plotH = svgH - pad.top - pad.bottom;

  const allKeys = lines ? [dataKey, ...lines.map((l) => l.dataKey)] : [dataKey];
  const allValues = data.flatMap((d) => allKeys.map((k) => Number(d[k]) || 0));
  const minVal = domain ? domain[0] : Math.min(...allValues);
  const maxVal = domain ? domain[1] : Math.max(...allValues, 1);

  function toX(i: number) {
    return pad.left + (data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2);
  }
  function toY(val: number) {
    const ratio = maxVal === minVal ? 0.5 : (val - minVal) / (maxVal - minVal);
    return pad.top + plotH - ratio * plotH;
  }

  function makePath(key: string) {
    return data
      .map((d, i) => {
        const x = toX(i);
        const y = toY(Number(d[key]) || 0);
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }

  // Gradient fill under line
  function makeAreaPath(key: string) {
    const linePath = data
      .map((d, i) => {
        const x = toX(i);
        const y = toY(Number(d[key]) || 0);
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
    const bottom = pad.top + plotH;
    return `${linePath} L${toX(data.length - 1).toFixed(2)},${bottom} L${toX(0).toFixed(2)},${bottom} Z`;
  }

  const gradId = `grad-${idRef.current}`;
  const clipId = `clip-${idRef.current}`;

  // Calculate total path length for animation
  let totalLen = 0;
  for (let i = 1; i < data.length; i++) {
    const dx = toX(i) - toX(i - 1);
    const dy = toY(Number(data[i][dataKey]) || 0) - toY(Number(data[i - 1][dataKey]) || 0);
    totalLen += Math.sqrt(dx * dx + dy * dy);
  }

  const yTicks = domain ? [domain[0], 25, 50, 75, domain[1]] : [minVal, minVal + (maxVal - minVal) * 0.25, minVal + (maxVal - minVal) * 0.5, minVal + (maxVal - minVal) * 0.75, maxVal];

  return (
    <div ref={containerRef} className={className} style={{ width, height, position: "relative" }}>
      <style>{`
        @keyframes lineReveal-${idRef.current} {
          from { stroke-dashoffset: ${Math.ceil(totalLen + 10)}; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes areaReveal { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" height="100%" style={{ display: "block" }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.2" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>

        {showGrid &&
          yTicks.map((tick, i) => {
            const y = toY(tick);
            return (
              <line key={i} x1={pad.left} x2={svgW - pad.right} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
            );
          })}

        {showAxes && (
          <g style={{ animation: `fadeIn 0.4s ${ANIM_EASE} both` }}>
            {yTicks.map((tick, i) => (
              <text key={i} x={pad.left - 6} y={toY(tick) + 4} textAnchor="end" fill="rgba(255,255,255,0.45)" fontSize={10} fontFamily="inherit">
                {Math.round(tick)}
              </text>
            ))}
            {data.map((d, i) => {
              if (data.length > 10 && i % Math.ceil(data.length / 6) !== 0 && i !== data.length - 1) return null;
              return (
                <text key={i} x={toX(i)} y={svgH - 4} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize={10} fontFamily="inherit">
                  {xKey ? String(d[xKey]) : ""}
                </text>
              );
            })}
          </g>
        )}

        {/* Gradient area fill */}
        <path
          d={makeAreaPath(dataKey)}
          fill={`url(#${gradId})`}
          style={{ animation: `areaReveal ${ANIM_DURATION} ${ANIM_EASE} 0.3s both` }}
        />

        {/* Main line with draw animation */}
        <path
          d={makePath(dataKey)}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={Math.ceil(totalLen + 10)}
          style={{
            animation: `lineReveal-${idRef.current} ${ANIM_DURATION} ${ANIM_EASE} both`,
          }}
        />

        {/* Additional lines */}
        {lines?.map((line) => (
          <path
            key={line.dataKey}
            d={makePath(line.dataKey)}
            fill="none"
            stroke={line.stroke}
            strokeWidth={line.strokeWidth ?? 1.5}
            strokeDasharray={line.strokeDasharray}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animation: `fadeIn ${ANIM_DURATION} ${ANIM_EASE} 0.2s both` }}
          />
        ))}

        {showDots &&
          data.map((d, i) => (
            <circle
              key={i}
              cx={toX(i)}
              cy={toY(Number(d[dataKey]) || 0)}
              r={3}
              fill={stroke}
              style={{
                animation: `fadeIn 0.3s ${ANIM_EASE} ${(i / data.length) * 0.6 + 0.4}s both`,
              }}
            />
          ))}

        {/* Hover crosshair + dot */}
        {showTooltip && hoveredIdx !== null && (
          <>
            <line
              x1={toX(hoveredIdx)}
              x2={toX(hoveredIdx)}
              y1={pad.top}
              y2={pad.top + plotH}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle
              cx={toX(hoveredIdx)}
              cy={toY(Number(data[hoveredIdx][dataKey]) || 0)}
              r={4}
              fill={stroke}
              stroke="rgba(0,0,0,0.5)"
              strokeWidth={1.5}
            />
          </>
        )}

        {/* Invisible hover targets */}
        {showTooltip &&
          data.map((_d, i) => (
            <rect
              key={`hover-${i}`}
              x={toX(i) - plotW / data.length / 2}
              y={pad.top}
              width={plotW / data.length}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHoveredIdx(i)}
            />
          ))}
      </svg>

      {/* Tooltip */}
      {showTooltip && hoveredIdx !== null && data[hoveredIdx] && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: `${(toX(hoveredIdx) / svgW) * 100}%`,
            transform: "translateX(-50%)",
            background: "rgba(11,11,13,0.95)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 6,
            padding: "5px 10px",
            fontSize: 11,
            color: "rgba(255,255,255,0.9)",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 10,
            backdropFilter: "blur(8px)",
          }}
        >
          {xKey && (
            <span style={{ color: "rgba(255,255,255,0.5)", marginRight: 4 }}>
              {String(data[hoveredIdx][xKey])}
            </span>
          )}
          {allKeys.map((k, ki) => (
            <span key={k} style={{ fontWeight: 600, marginLeft: ki > 0 ? 6 : 0 }}>
              {Number(data[hoveredIdx][k]).toFixed(0)}%
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MiniBarChart ───────────────────────────────────────────────────────────

type BarChartProps = {
  data: Array<{ [key: string]: unknown }>;
  dataKey: string;
  xKey?: string;
  width?: string | number;
  height?: number;
  fill?: string;
  showAxes?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  domain?: [number, number];
  className?: string;
  barRadius?: number;
  tooltipStyle?: React.CSSProperties;
  tooltipFormatter?: (val: number) => string;
  xTickStyle?: React.CSSProperties;
  yTickStyle?: React.CSSProperties;
};

export function MiniBarChart({
  data,
  dataKey,
  xKey,
  width = "100%",
  height = 200,
  fill = "#e6e6e6",
  showAxes = false,
  showGrid = false,
  showTooltip = false,
  domain,
  className,
  barRadius = 3,
  tooltipStyle,
  tooltipFormatter,
}: BarChartProps) {
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = React.useState(400);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setContainerW(Math.round(w));
    });
    obs.observe(el);
    setContainerW(el.clientWidth || 400);
    return () => obs.disconnect();
  }, []);

  if (!data || data.length === 0) return null;

  const pad = showAxes
    ? { top: 12, right: 12, bottom: 28, left: 40 }
    : { top: 6, right: 6, bottom: 6, left: 6 };

  const svgW = containerW;
  const svgH = height;
  const plotW = svgW - pad.left - pad.right;
  const plotH = svgH - pad.top - pad.bottom;

  const maxVal = domain ? domain[1] : Math.max(...data.map((d) => Number(d[dataKey]) || 0), 1);
  const minVal = domain ? domain[0] : 0;

  const barGap = Math.max(2, plotW * 0.12 / data.length);
  const barW = Math.max(2, (plotW - barGap * (data.length + 1)) / data.length);

  const yTicks = [minVal, minVal + (maxVal - minVal) * 0.25, (minVal + maxVal) / 2, minVal + (maxVal - minVal) * 0.75, maxVal];

  return (
    <div ref={containerRef} className={className} style={{ width, height, position: "relative" }}>
      <style>{`
        @keyframes barRise {
          from { transform: scaleY(0); }
          to { transform: scaleY(1); }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        width="100%"
        height="100%"
        style={{ display: "block" }}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        {showGrid &&
          yTicks.map((tick, i) => {
            const y = pad.top + plotH - ((tick - minVal) / (maxVal - minVal)) * plotH;
            return (
              <line key={i} x1={pad.left} x2={svgW - pad.right} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
            );
          })}

        {showAxes && (
          <g style={{ animation: `fadeIn 0.4s ${ANIM_EASE} both` }}>
            {yTicks.map((tick, i) => {
              const y = pad.top + plotH - ((tick - minVal) / (maxVal - minVal)) * plotH;
              return (
                <text key={i} x={pad.left - 6} y={y + 4} textAnchor="end" fill="rgba(255,255,255,0.45)" fontSize={10} fontFamily="inherit">
                  {Math.round(tick)}
                </text>
              );
            })}
            {data.map((d, i) => {
              const x = pad.left + barGap + i * (barW + barGap) + barW / 2;
              // Skip some labels if too many bars
              if (data.length > 12 && i % Math.ceil(data.length / 8) !== 0 && i !== data.length - 1) return null;
              return (
                <text key={i} x={x} y={svgH - 4} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize={10} fontFamily="inherit">
                  {xKey ? String(d[xKey]) : ""}
                </text>
              );
            })}
          </g>
        )}

        {data.map((d, i) => {
          const val = Number(d[dataKey]) || 0;
          const barH = Math.max(0, ((val - minVal) / (maxVal - minVal)) * plotH);
          const x = pad.left + barGap + i * (barW + barGap);
          const y = pad.top + plotH - barH;
          const r = Math.min(barRadius, barW / 2);
          const isHovered = hoveredIdx === i;
          const delay = (i / data.length) * 0.4;

          return (
            <g key={i} onMouseEnter={() => setHoveredIdx(i)}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                fill={fill}
                rx={r}
                ry={r}
                opacity={isHovered ? 1 : 0.7}
                style={{
                  transformOrigin: `${x + barW / 2}px ${pad.top + plotH}px`,
                  animation: `barRise 0.6s ${ANIM_EASE} ${delay}s both`,
                  transition: "opacity 0.2s ease",
                }}
              />
              {/* Hover highlight */}
              {isHovered && (
                <rect
                  x={x - 1}
                  y={y - 1}
                  width={barW + 2}
                  height={barH + 2}
                  fill="none"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth={1}
                  rx={r}
                  ry={r}
                />
              )}
            </g>
          );
        })}
      </svg>

      {showTooltip && hoveredIdx !== null && data[hoveredIdx] && (() => {
        const x = pad.left + barGap + hoveredIdx * (barW + barGap) + barW / 2;
        return (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: `${(x / svgW) * 100}%`,
              transform: "translateX(-50%)",
              background: "rgba(11,11,13,0.95)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 6,
              padding: "5px 10px",
              fontSize: 11,
              color: "rgba(255,255,255,0.9)",
              whiteSpace: "nowrap",
              pointerEvents: "none",
              zIndex: 10,
              backdropFilter: "blur(8px)",
              ...tooltipStyle,
            }}
          >
            {xKey && (
              <span style={{ color: "rgba(255,255,255,0.5)", marginRight: 4 }}>
                {String(data[hoveredIdx][xKey])}
              </span>
            )}
            <span style={{ fontWeight: 600 }}>
              {tooltipFormatter
                ? tooltipFormatter(Number(data[hoveredIdx][dataKey]))
                : `${Number(data[hoveredIdx][dataKey]).toFixed(0)}%`}
            </span>
          </div>
        );
      })()}
    </div>
  );
}

// ─── MiniRadarChart ─────────────────────────────────────────────────────────

type RadarChartProps = {
  data: Array<{ subject: string; score: number }>;
  width?: string | number;
  height?: number;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  gridStroke?: string;
  labelStyle?: { fill?: string; fontSize?: number; fontFamily?: string; letterSpacing?: string };
  dotStyle?: { fill?: string; r?: number; stroke?: string; strokeWidth?: number };
  className?: string;
};

export function MiniRadarChart({
  data,
  width = "100%",
  height = 200,
  stroke = "rgba(222,231,243,0.80)",
  fill = "rgba(222,231,243,0.15)",
  strokeWidth = 1.5,
  gridStroke = "rgba(255,255,255,0.07)",
  labelStyle,
  dotStyle,
  className,
}: RadarChartProps) {
  if (!data || data.length < 3) return null;

  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.32;
  const n = data.length;
  const levels = [0.25, 0.5, 0.75, 1];

  function angleFor(i: number) {
    return (Math.PI * 2 * i) / n - Math.PI / 2;
  }
  function pointAt(i: number, r: number): [number, number] {
    const a = angleFor(i);
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  }

  const gridPolygons = levels.map((level) => {
    const points = Array.from({ length: n }, (_, i) => pointAt(i, outerR * level));
    return points.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
  });

  const dataPoints = data.map((d, i) => {
    const r = (Math.min(d.score, 100) / 100) * outerR;
    return pointAt(i, r);
  });
  const dataPolygon = dataPoints.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");

  const labelR = outerR + 16;

  return (
    <div className={className} style={{ width, height }}>
      <style>{`
        @keyframes radarScale {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
      <svg viewBox={`0 0 ${size} ${size}`} preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
        {/* Grid lines from center */}
        {Array.from({ length: n }, (_, i) => {
          const [ex, ey] = pointAt(i, outerR);
          return <line key={`axis-${i}`} x1={cx} y1={cy} x2={ex} y2={ey} stroke={gridStroke} strokeWidth={0.5} />;
        })}

        {/* Grid polygons */}
        {gridPolygons.map((pts, lvl) => (
          <polygon key={`grid-${lvl}`} points={pts} fill="none" stroke={gridStroke} strokeWidth={0.5} />
        ))}

        {/* Data polygon with scale animation */}
        <polygon
          points={dataPolygon}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            animation: `radarScale 0.8s ${ANIM_EASE} both`,
          }}
        />

        {/* Dots */}
        {dataPoints.map((p, i) => (
          <circle
            key={`dot-${i}`}
            cx={p[0]}
            cy={p[1]}
            r={dotStyle?.r ?? 3}
            fill={dotStyle?.fill ?? stroke}
            stroke={dotStyle?.stroke ?? "rgba(0,0,0,0.3)"}
            strokeWidth={dotStyle?.strokeWidth ?? 1}
            style={{ animation: `fadeIn 0.3s ${ANIM_EASE} ${0.5 + i * 0.1}s both` }}
          />
        ))}

        {/* Labels */}
        {data.map((d, i) => {
          const [lx, ly] = pointAt(i, labelR);
          return (
            <text
              key={`label-${i}`}
              x={lx}
              y={ly + 4}
              textAnchor="middle"
              fill={labelStyle?.fill ?? "rgba(233,240,255,0.55)"}
              fontSize={labelStyle?.fontSize ?? 11}
              fontFamily={labelStyle?.fontFamily ?? "inherit"}
              letterSpacing={labelStyle?.letterSpacing ?? "0.08em"}
              style={{ animation: `fadeIn 0.4s ${ANIM_EASE} ${0.3 + i * 0.08}s both` }}
            >
              {d.subject}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
