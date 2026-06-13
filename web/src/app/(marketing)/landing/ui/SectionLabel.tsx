import { cn } from "../lib/cn";

interface SectionLabelProps {
  text: string;
  className?: string;
  align?: "left" | "center";
}

/**
 * Minimal label — Inter Medium, normal case, 14px, white/40, 0.05em tracking.
 */
export default function SectionLabel({
  text,
  className,
  align = "center",
}: SectionLabelProps) {
  return (
    <div className={cn("inline-block", align === "center" && "mx-auto", className)}>
      <span
        className="font-sans text-[14px] font-medium text-white/40"
        style={{ letterSpacing: "0.05em" }}
      >
        {text}
      </span>
    </div>
  );
}
