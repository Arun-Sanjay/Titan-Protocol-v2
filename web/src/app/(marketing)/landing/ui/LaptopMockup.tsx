import { ReactNode } from "react";
import { cn } from "../lib/cn";

interface LaptopMockupProps {
  children: ReactNode;
  className?: string;
  /** Whether to apply the gentle CSS floating animation */
  float?: boolean;
  /** Animation delay so two devices don't sync */
  floatDelay?: number;
  /** Static rotation (degrees) */
  tilt?: number;
}

/**
 * Pure-CSS dark laptop mockup. Float runs as a CSS keyframe for
 * compositor-thread performance — no Framer Motion.
 */
export default function LaptopMockup({
  children,
  className,
  float = true,
  floatDelay = 0,
  tilt = 0,
}: LaptopMockupProps) {
  return (
    <div className={cn("laptop-wrapper select-none", className)}>
      <div
        className={cn("relative", float && "phone-float")}
        style={{
          transform: tilt ? `rotate(${tilt}deg)` : undefined,
          animationDelay: float && floatDelay ? `${floatDelay}s` : undefined,
        }}
      >
        <div className="laptop-screen">
          <div className="laptop-display">{children}</div>
        </div>
        <div className="laptop-base" />
      </div>
    </div>
  );
}
