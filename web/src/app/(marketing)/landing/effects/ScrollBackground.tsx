import { useEffect } from "react";
import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";

/**
 * Global scroll-driven background — monochrome black with the dark abstract
 * hero.jpg layered as the base texture across the entire page.
 *
 * Layers (back to front):
 *   1. Pure #000 base
 *   2. hero.jpg full-viewport (scroll-driven scale + y + opacity + rotate
 *      + cursor-tracked parallax via useSpring)
 *   3. Brushed-metal repeating-linear-gradient grain
 *   4. 4 diagonal sheen bands (scroll-driven y, slightly varied angles)
 *   5. Top radial spotlight (scroll-driven y + opacity + cursor parallax)
 *   6. Vignette darkening corners
 *   7. SVG noise overlay
 *
 * `position: fixed; inset: 0; z-index: 0; pointer-events: none` so it sits
 * behind everything and never blocks clicks. Page content lives at z >= 1.
 */
export default function ScrollBackground() {
  const { scrollYProgress } = useScroll();

  // === Mouse-tracked parallax (smoothed via useSpring) ===
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothMouseX = useSpring(mouseX, { stiffness: 40, damping: 18 });
  const smoothMouseY = useSpring(mouseY, { stiffness: 40, damping: 18 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      mouseX.set(x);
      mouseY.set(y);
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  // === Hero image — visible across the WHOLE page ===
  const imageScale = useTransform(scrollYProgress, [0, 0.5, 1], [1, 1.08, 1.18]);
  const imageScrollY = useTransform(scrollYProgress, [0, 1], [0, -180]);
  const imageOpacity = useTransform(
    scrollYProgress,
    [0, 0.25, 0.55, 0.85, 1],
    [0.24, 0.16, 0.2, 0.16, 0.22],
  );
  const imageRotate = useTransform(scrollYProgress, [0, 1], [0, 2]);
  const imageMouseX = useTransform(smoothMouseX, [-1, 1], [-18, 18]);
  const imageMouseY = useTransform(smoothMouseY, [-1, 1], [-12, 12]);

  // === Sheens ===
  const sheen1Y = useTransform(scrollYProgress, [0, 1], ["0vh", "45vh"]);
  const sheen2Y = useTransform(scrollYProgress, [0, 1], ["15vh", "-35vh"]);
  const sheen3Y = useTransform(scrollYProgress, [0, 1], ["-25vh", "25vh"]);
  const sheen4Y = useTransform(scrollYProgress, [0, 1], ["35vh", "-15vh"]);
  const sheen1MouseX = useTransform(smoothMouseX, [-1, 1], [-30, 30]);
  const sheen3MouseX = useTransform(smoothMouseX, [-1, 1], [25, -25]);

  // === Top spotlight ===
  const spotlightY = useTransform(scrollYProgress, [0, 1], ["0vh", "30vh"]);
  const spotlightOpacity = useTransform(
    scrollYProgress,
    [0, 0.4, 0.8, 1],
    [1, 0.6, 0.45, 0.85],
  );
  const spotlightMouseX = useTransform(smoothMouseX, [-1, 1], [-60, 60]);

  return (
    <div aria-hidden className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {/* === LAYER 1 — pure black base === */}
      <div className="absolute inset-0 bg-black" />

      {/* === LAYER 2 — global hero.jpg base texture === */}
      <motion.div
        className="hero-bg-image absolute inset-0 will-change-transform"
        style={{
          opacity: imageOpacity,
          scale: imageScale,
          y: imageScrollY,
          x: imageMouseX,
          rotate: imageRotate,
        }}
      >
        <motion.div
          className="absolute inset-0 will-change-transform"
          style={{ y: imageMouseY }}
        >
          <img
            src="/images/hero.jpg"
            alt=""
            loading="eager"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </motion.div>
      </motion.div>

      {/* === LAYER 3 — brushed-metal grain === */}
      <div
        className="absolute inset-0"
        style={{
          background: `repeating-linear-gradient(
            135deg,
            transparent 0px,
            transparent 140px,
            rgba(255, 255, 255, 0.014) 140px,
            rgba(255, 255, 255, 0.014) 141px,
            transparent 142px,
            transparent 280px
          )`,
        }}
      />

      {/* === LAYER 4 — 4 diagonal sheen bands === */}
      <motion.div
        className="absolute will-change-transform"
        style={{
          left: "-25vw",
          top: "-50vh",
          width: "150vw",
          height: "200vh",
          y: sheen1Y,
          x: sheen1MouseX,
          background: `linear-gradient(
            135deg,
            transparent 32%,
            rgba(255, 255, 255, 0.035) 47%,
            rgba(255, 255, 255, 0.055) 50%,
            rgba(255, 255, 255, 0.035) 53%,
            transparent 68%
          )`,
        }}
      />
      <motion.div
        className="absolute will-change-transform"
        style={{
          left: "-25vw",
          top: "-50vh",
          width: "150vw",
          height: "200vh",
          y: sheen2Y,
          background: `linear-gradient(
            128deg,
            transparent 42%,
            rgba(255, 255, 255, 0.028) 50%,
            transparent 58%
          )`,
        }}
      />
      <motion.div
        className="absolute will-change-transform"
        style={{
          left: "-25vw",
          top: "-50vh",
          width: "150vw",
          height: "200vh",
          y: sheen3Y,
          x: sheen3MouseX,
          background: `linear-gradient(
            142deg,
            transparent 28%,
            rgba(255, 255, 255, 0.022) 50%,
            transparent 72%
          )`,
        }}
      />
      <motion.div
        className="absolute will-change-transform"
        style={{
          left: "-25vw",
          top: "-50vh",
          width: "150vw",
          height: "200vh",
          y: sheen4Y,
          background: `linear-gradient(
            148deg,
            transparent 46%,
            rgba(255, 255, 255, 0.025) 50%,
            transparent 54%
          )`,
        }}
      />

      {/* === LAYER 5 — top radial spotlight === */}
      <motion.div
        className="absolute top-0 left-1/2 w-[1400px] h-[800px] will-change-transform"
        style={{
          translateX: "-50%",
          y: spotlightY,
          x: spotlightMouseX,
          opacity: spotlightOpacity,
          background: `radial-gradient(
            ellipse at top,
            rgba(255, 255, 255, 0.07) 0%,
            rgba(255, 255, 255, 0.02) 30%,
            transparent 65%
          )`,
        }}
      />

      {/* === LAYER 6 — vignette === */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 35%, rgba(0, 0, 0, 0.55) 100%)",
        }}
      />

      {/* === LAYER 7 — fine SVG noise === */}
      <div className="scroll-bg-noise absolute inset-0" style={{ opacity: 0.022 }} />
    </div>
  );
}
