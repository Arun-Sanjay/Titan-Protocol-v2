import { motion, HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";
import { cn } from "../lib/cn";

interface CardProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  hover?: boolean;
}

/**
 * Frosted glass surface card.
 *
 * Hover transitions run via CSS (`.surface-card:hover` in landing.css) for
 * compositor-friendly performance — Framer Motion is only used for the
 * entrance animation (transform/opacity).
 */
export default function Card({
  children,
  className,
  hover = true,
  ...rest
}: CardProps) {
  return (
    <motion.div
      className={cn(
        "surface-card",
        hover && "surface-card-hover",
        "p-8 will-change-transform",
        className,
      )}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
