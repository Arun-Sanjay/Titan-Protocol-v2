import { motion } from "framer-motion";
import { ReactNode } from "react";
import SectionLabel from "./SectionLabel";
import {
  fadeUp,
  fadeIn,
  viewportConfig,
  staggerContainer,
} from "../lib/animations";
import { cn } from "../lib/cn";

interface SectionHeadingProps {
  label?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  className?: string;
}

/**
 * Centered heading block — small label -> bold sans heading -> muted description.
 */
export default function SectionHeading({
  label,
  title,
  description,
  align = "center",
  className,
}: SectionHeadingProps) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={viewportConfig}
      className={cn(
        "flex flex-col gap-5",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {label && (
        <motion.div variants={fadeIn}>
          <SectionLabel text={label} align={align} />
        </motion.div>
      )}
      <motion.h2
        variants={fadeUp}
        className={cn(
          "heading-section text-white text-balance",
          "text-[36px] md:text-[44px] lg:text-[52px] max-w-3xl",
          align === "center" && "mx-auto",
        )}
      >
        {title}
      </motion.h2>
      {description && (
        <motion.p
          variants={fadeUp}
          className={cn(
            "text-[16px] md:text-[18px] max-w-2xl leading-[1.7] text-white/60",
            align === "center" && "mx-auto",
          )}
        >
          {description}
        </motion.p>
      )}
    </motion.div>
  );
}
