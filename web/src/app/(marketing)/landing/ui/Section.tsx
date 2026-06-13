import { ReactNode } from "react";
import { cn } from "../lib/cn";

interface SectionProps {
  id?: string;
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  fullBleed?: boolean;
  narrow?: boolean;
}

/**
 * Section with generous vertical breathing room (py-32 md:py-44 default).
 * Pass `narrow` for the narrower max-width container.
 */
export default function Section({
  id,
  children,
  className,
  containerClassName,
  fullBleed = false,
  narrow = false,
}: SectionProps) {
  return (
    <section id={id} className={cn("relative py-32 md:py-44", className)}>
      {fullBleed ? (
        children
      ) : (
        <div
          className={cn(
            narrow ? "container-narrow" : "container-titan",
            containerClassName,
          )}
        >
          {children}
        </div>
      )}
    </section>
  );
}
