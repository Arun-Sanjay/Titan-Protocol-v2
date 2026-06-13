import { ReactNode } from "react";
import { cn } from "../lib/cn";

interface BadgeProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "accent";
  icon?: ReactNode;
}

export default function Badge({
  children,
  className,
  variant = "default",
  icon,
}: BadgeProps) {
  const variants: Record<string, string> = {
    default: "border-white/12 bg-white/[0.04] text-white/75 backdrop-blur-md",
    accent:
      "border-titan-accent/40 bg-titan-accent/10 text-titan-accent backdrop-blur-md",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 px-4 py-1.5 rounded-pill border",
        "font-sans text-[12px] font-medium",
        variants[variant],
        className,
      )}
    >
      {icon && <span className="flex items-center">{icon}</span>}
      {children}
    </span>
  );
}
