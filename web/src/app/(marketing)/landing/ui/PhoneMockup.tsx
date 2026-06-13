import { ReactNode } from "react";
import { cn } from "../lib/cn";

interface PhoneMockupProps {
  children: ReactNode;
  className?: string;
  /** Static rotation in degrees applied to the phone */
  tilt?: number;
  /** Whether to apply the gentle CSS floating animation */
  float?: boolean;
  /** Override animation delay (seconds) so two phones don't sync */
  floatDelay?: number;
  /** Width override */
  width?: string;
  /** Time displayed in the status bar (default 9:41 — Apple's standard) */
  time?: string;
}

/**
 * Premium dark phone frame with subtle gradient bezel + dynamic island, plus an
 * iOS-style status bar overlay. Float runs as a CSS keyframe (`.phone-float`).
 */
export default function PhoneMockup({
  children,
  className,
  tilt = 0,
  float = true,
  floatDelay = 0,
  width = "100%",
  time = "9:41",
}: PhoneMockupProps) {
  return (
    <div className={cn("relative", className)} style={{ width, perspective: "1400px" }}>
      <div
        className={cn("phone-frame", float && "phone-float")}
        style={{
          transform: tilt ? `rotate(${tilt}deg)` : undefined,
          animationDelay: float && floatDelay ? `${floatDelay}s` : undefined,
        }}
      >
        <div className="phone-screen">
          {/* === iOS-STYLE STATUS BAR OVERLAY === */}
          <div className="absolute top-0 inset-x-0 z-10 px-6 pt-3 pb-2 flex items-center justify-between text-white pointer-events-none">
            <span className="text-[11px] font-semibold tabular-nums">{time}</span>
            <div className="flex items-center gap-1.5">
              {/* Signal bars */}
              <svg width="14" height="9" viewBox="0 0 14 9" fill="currentColor" aria-hidden>
                <rect x="0" y="6" width="2.5" height="3" rx="0.4" />
                <rect x="3.5" y="4" width="2.5" height="5" rx="0.4" />
                <rect x="7" y="2" width="2.5" height="7" rx="0.4" />
                <rect x="10.5" y="0" width="2.5" height="9" rx="0.4" />
              </svg>
              {/* Wifi */}
              <svg
                width="13"
                height="9"
                viewBox="0 0 13 9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M1 3.2 A 8 8 0 0 1 12 3.2" />
                <path d="M3 5.2 A 5 5 0 0 1 10 5.2" />
                <circle cx="6.5" cy="7.5" r="0.7" fill="currentColor" />
              </svg>
              {/* Battery */}
              <svg width="20" height="9" viewBox="0 0 20 9" fill="none" aria-hidden>
                <rect
                  x="0.5"
                  y="0.5"
                  width="16"
                  height="8"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="0.8"
                  opacity="0.55"
                />
                <rect
                  x="17.5"
                  y="3"
                  width="1.5"
                  height="3"
                  rx="0.4"
                  fill="currentColor"
                  opacity="0.55"
                />
                <rect x="2" y="2" width="13" height="5" rx="1" fill="currentColor" />
              </svg>
            </div>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
