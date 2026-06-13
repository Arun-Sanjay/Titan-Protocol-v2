import type { Variants } from "framer-motion";

// === GLOBAL EASING ===
// Smooth ease-out — premium glide. Typed as a 4-tuple (not `as const`) so it
// satisfies framer-motion v12's cubic-bezier easing type.
export const titanEase: [number, number, number, number] = [0.16, 1, 0.3, 1];

// === BASE VARIANTS ===
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.9, ease: titanEase },
  },
};

export const fadeUpLarge: Variants = {
  hidden: { opacity: 0, y: 48 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 1.05, ease: titanEase },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.85, ease: titanEase },
  },
};

export const fadeDown: Variants = {
  hidden: { opacity: 0, y: -24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.9, ease: titanEase },
  },
};

export const fadeLeft: Variants = {
  hidden: { opacity: 0, x: -32 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.95, ease: titanEase },
  },
};

export const fadeRight: Variants = {
  hidden: { opacity: 0, x: 32 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.95, ease: titanEase },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 1, ease: titanEase },
  },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15 },
  },
};

export const staggerContainerSlow: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.2 },
  },
};

export const staggerContainerFast: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

// === HERO SPECIFIC ===
export const heroHeading: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
};

export const heroWord: Variants = {
  hidden: { opacity: 0, y: 36, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 1.05, ease: titanEase },
  },
};

// === BLOCK SCALE-IN — for CTA section "zoom toward you" feel ===
export const blockScaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 1.1, ease: titanEase },
  },
};

// === VIEWPORT CONFIGS ===
// amount 0.15 fires animations sooner = no visible pop-in.
// once: true = no re-trigger on scroll back (perf win).
export const viewportConfig = { once: true, amount: 0.15 } as const;
export const viewportConfigEager = { once: true, amount: 0.05 } as const;
