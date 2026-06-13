import { cn } from "../lib/cn";

interface TitanLogoProps {
  className?: string;
  showFull?: boolean;
}

export default function TitanLogo({ className, showFull = true }: TitanLogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="relative flex h-7 w-7 items-center justify-center rounded-[8px] border border-white/15 bg-white/[0.04]"
      >
        <span className="font-sans text-[12px] font-bold text-white">T</span>
      </span>
      <span
        className="font-sans text-[15px] font-semibold text-white"
        style={{ letterSpacing: "-0.01em" }}
      >
        Titan
        {showFull && <span className="text-white/55 font-medium"> Protocol</span>}
      </span>
    </div>
  );
}
