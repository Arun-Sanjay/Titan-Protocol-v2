import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "../ui/Button";
import LaptopMockup from "../ui/LaptopMockup";
import PhoneMockup from "../ui/PhoneMockup";
import DashboardScreen from "../mockups/DashboardScreen";
import ArchetypeScreen from "../mockups/ArchetypeScreen";
import ProtocolScreen from "../mockups/ProtocolScreen";
import RankScreen from "../mockups/RankScreen";
import { fadeUp, staggerContainer, titanEase } from "../lib/animations";
import { useLandingCtas } from "../lib/useLandingCtas";

const steps = [
  {
    num: "01",
    title: "Select your identity",
    body: "Eight archetypes — Titan, Athlete, Scholar, Hustler, Showman, Warrior, Founder, Charmer. Each one calibrates the scoring system to match your ambition. Choose the one that fits how you want to build your year.",
  },
  {
    num: "02",
    title: "Run the daily protocol",
    body: "Morning Protocol sets your intention for the day. Track missions, log habits, and build momentum. Evening Protocol reveals your Titan Score — a single number that measures how well you executed. Every day is scored. No days off.",
  },
  {
    num: "03",
    title: "Ascend the ranks",
    body: "Eight tiers — Initiate, Operative, Agent, Specialist, Commander, Vanguard, Sentinel, Titan. Your rank reflects your consistency and average score over time. The system doesn't lie. You either show up or you don't.",
  },
];

export default function HeroProcessFlow() {
  const navigate = useNavigate();
  const { primaryHref, primaryLabel } = useLandingCtas();
  const containerRef = useRef<HTMLElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const step1Ref = useRef<HTMLDivElement>(null);
  const step2Ref = useRef<HTMLDivElement>(null);
  const step3Ref = useRef<HTMLDivElement>(null);

  const [activeScreen, setActiveScreen] = useState(0);

  // Single useScroll over the master container drives the subtle device parallax.
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Center device cluster — subtle downward drift while the steps scroll past.
  const clusterY = useTransform(scrollYProgress, [0, 0.18, 0.34], ["0vh", "0vh", "4vh"]);

  // === IntersectionObserver — drives the screen swap inside the SECONDARY phone ===
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    // Spacer sentinel — when the spacer is in view, we're in hero/dashboard state.
    if (spacerRef.current) {
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveScreen(0);
        },
        { threshold: 0.3 },
      );
      obs.observe(spacerRef.current);
      observers.push(obs);
    }

    // Step observers
    [step1Ref, step2Ref, step3Ref].forEach((ref, i) => {
      if (!ref.current) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveScreen(i + 1);
        },
        { threshold: 0.4, rootMargin: "-20% 0px -20% 0px" },
      );
      obs.observe(ref.current);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <section
      ref={containerRef}
      id="top"
      className="relative w-full"
      style={{ minHeight: "440vh" }}
    >
      {/* === HERO TEXT — normal flow at top === */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="relative z-20 container-narrow flex flex-col items-center text-center pt-40 md:pt-44 pb-16 will-change-transform"
      >
        <motion.p
          variants={fadeUp}
          className="font-sans text-[14px] font-medium text-white/45"
          style={{ letterSpacing: "0.05em" }}
        >
          Performance. Redefined.
        </motion.p>

        <motion.h1
          variants={fadeUp}
          className="mt-6 heading-display text-white text-balance text-[44px] xs:text-[52px] md:text-[64px] lg:text-[76px] max-w-4xl"
        >
          You weren&apos;t built to be{" "}
          <span className="text-gradient-soft">average.</span>
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="mt-7 max-w-2xl text-[17px] md:text-[19px] leading-[1.7] text-white/60 text-balance"
        >
          A gamified performance system that scores every day across four engines —
          Body, Mind, Money, and Charisma. Track missions, build streaks, rank up
          from Initiate to Titan. Run it in any browser, on your desktop, and on
          your phone — all synced to one account.
        </motion.p>

        <motion.div
          variants={fadeUp}
          className="mt-10 flex flex-col xs:flex-row items-center justify-center gap-3"
        >
          <Button
            variant="primary"
            size="lg"
            iconRight={<ArrowRight className="h-4 w-4" />}
            onClick={() => navigate(primaryHref)}
          >
            {primaryLabel}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              document
                .getElementById("how-it-works")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            See how it works
          </Button>
        </motion.div>
      </motion.div>

      {/* Anchor marker — present in both desktop + mobile layouts. */}
      <div id="how-it-works" aria-hidden />

      {/* === DEVICE ZONE (desktop only) === */}
      <div className="relative hidden lg:block" style={{ minHeight: "340vh" }}>
        {/* === STICKY DEVICE CLUSTER — laptop (constant) + swapping phone === */}
        <div
          className="sticky z-10 pointer-events-none"
          style={{ top: "15vh", height: "70vh" }}
        >
          <div className="absolute inset-0 flex items-center justify-end pr-[3%] xl:pr-[6%]">
            <motion.div
              style={{ y: clusterY }}
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 1, ease: titanEase }}
              className="relative will-change-transform"
            >
              {/* Laptop — the web app, constant dashboard */}
              <div className="w-[560px] xl:w-[640px]">
                <LaptopMockup float={false}>
                  <DashboardScreen device="laptop" />
                </LaptopMockup>
              </div>

              {/* Phone — same protocol on mobile; screen swaps as you scroll */}
              <div className="absolute -bottom-12 -right-6 xl:-right-12 w-[180px] xl:w-[200px]">
                <PhoneMockup tilt={4} float={false}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeScreen}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className="absolute inset-0 will-change-transform"
                    >
                      {activeScreen === 0 && <DashboardScreen device="phone" />}
                      {activeScreen === 1 && <ArchetypeScreen />}
                      {activeScreen === 2 && <ProtocolScreen />}
                      {activeScreen === 3 && <RankScreen />}
                    </motion.div>
                  </AnimatePresence>
                </PhoneMockup>
              </div>
            </motion.div>
          </div>
        </div>

        {/* === SCROLLING STEP TEXT — overlays the sticky cluster === */}
        <div className="relative z-20" style={{ marginTop: "-70vh" }}>
          <div ref={spacerRef} style={{ height: "30vh" }} aria-hidden />

          {/* Step 1 — text LEFT */}
          <div
            ref={step1Ref}
            className="relative min-h-[80vh] flex items-center pointer-events-none"
          >
            <div className="container-titan w-full">
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={
                  activeScreen === 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }
                }
                transition={{
                  duration: 0.6,
                  ease: titanEase,
                  delay: activeScreen === 1 ? 0.1 : 0,
                }}
                className="max-w-[360px] pointer-events-auto will-change-transform"
              >
                <StepText step={steps[0]} staticContent />
              </motion.div>
            </div>
          </div>

          {/* Step 2 — text LEFT (devices sit on the right, clear of the text) */}
          <div
            ref={step2Ref}
            className="relative min-h-[80vh] flex items-center pointer-events-none"
          >
            <div className="container-titan w-full">
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={
                  activeScreen === 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }
                }
                transition={{
                  duration: 0.6,
                  ease: titanEase,
                  delay: activeScreen === 2 ? 0.1 : 0,
                }}
                className="max-w-[360px] pointer-events-auto will-change-transform"
              >
                <StepText step={steps[1]} staticContent />
              </motion.div>
            </div>
          </div>

          {/* Step 3 — text LEFT */}
          <div
            ref={step3Ref}
            className="relative min-h-[80vh] flex items-center pointer-events-none"
          >
            <div className="container-titan w-full">
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={
                  activeScreen === 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }
                }
                transition={{
                  duration: 0.6,
                  ease: titanEase,
                  delay: activeScreen === 3 ? 0.1 : 0,
                }}
                className="max-w-[360px] pointer-events-auto will-change-transform"
              >
                <StepText step={steps[2]} staticContent />
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* === MOBILE / TABLET FALLBACK — lead with the laptop, then stacked steps === */}
      <div className="lg:hidden">
        <div className="relative z-10 mt-2 mb-20 px-4">
          <div className="mx-auto w-full max-w-[460px]">
            <LaptopMockup>
              <DashboardScreen device="laptop" />
            </LaptopMockup>
          </div>
        </div>

        <div className="container-titan py-16">
          <div className="flex flex-col gap-24">
            {steps.map((step, i) => {
              const Screen = [ArchetypeScreen, ProtocolScreen, RankScreen][i];
              return (
                <div
                  key={step.num}
                  className="flex flex-col items-center gap-10 text-center"
                >
                  <StepText step={step} centered />
                  <div className="w-[230px] md:w-[260px]">
                    <PhoneMockup>
                      <Screen />
                    </PhoneMockup>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

interface StepTextProps {
  step: (typeof steps)[number];
  centered?: boolean;
  /**
   * When true, render without the component's own whileInView animation — the
   * parent drives opacity/y via scroll-tied motion values.
   */
  staticContent?: boolean;
}

function StepText({ step, centered = false, staticContent = false }: StepTextProps) {
  const inner = (
    <>
      <p
        className="font-sans text-[13px] font-semibold text-white/45"
        style={{ letterSpacing: "0.08em" }}
      >
        STEP {step.num}
      </p>
      <h2 className="mt-4 heading-section text-white text-[32px] md:text-[40px] lg:text-[44px]">
        {step.title}
      </h2>
      <p className="mt-5 text-[16px] leading-[1.7] text-white/60">{step.body}</p>
    </>
  );

  if (staticContent) {
    return <div className={`max-w-md ${centered ? "mx-auto" : ""}`}>{inner}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.9, ease: titanEase }}
      className={`will-change-transform max-w-md ${centered ? "mx-auto" : ""}`}
    >
      {inner}
    </motion.div>
  );
}
