import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sunrise,
  Crosshair,
  Award,
  Flame,
  Timer,
  Activity,
} from "lucide-react";
import Section from "../ui/Section";
import SectionHeading from "../ui/SectionHeading";
import PhoneMockup from "../ui/PhoneMockup";
import DashboardScreen from "../mockups/DashboardScreen";
import MissionScreen from "../mockups/MissionScreen";
import RankScreen from "../mockups/RankScreen";
import ProtocolScreen from "../mockups/ProtocolScreen";
import { fadeUp, staggerContainer, viewportConfig, titanEase } from "../lib/animations";

const features = [
  {
    Icon: Sunrise,
    title: "Morning Protocol",
    body: "Start every day with intention. Review your missions, check your engine scores, lock in your focus.",
    Screen: ProtocolScreen,
  },
  {
    Icon: Crosshair,
    title: "Mission Queue",
    body: "Your tasks aren't a to-do list. They're missions with XP values and engine tags — scored daily, not someday.",
    Screen: MissionScreen,
  },
  {
    Icon: Award,
    title: "XP & Rank System",
    body: "Every action earns XP. Eight ranks from Initiate to Titan. Your rank is earned, never given.",
    Screen: RankScreen,
  },
  {
    Icon: Flame,
    title: "Streak Engine",
    body: "Clear the daily bar and your streak grows, multiplying every XP award up to 3×. Slip, and it resets to zero.",
    Screen: DashboardScreen,
  },
  {
    Icon: Timer,
    title: "Focus Sessions",
    body: "A deep-work timer built into the protocol. Run focused blocks, log the reps, keep the engine hot.",
    Screen: RankScreen,
  },
  {
    Icon: Activity,
    title: "Daily Score",
    body: "Every evening, the protocol calculates your Titan Score. A single number that tells you exactly where you stand.",
    Screen: DashboardScreen,
  },
];

export default function Features() {
  const [active, setActive] = useState(0);
  const ActiveScreen = features[active].Screen;

  return (
    <Section id="features">
      <SectionHeading
        label="What's inside"
        title={
          <>
            Everything you need.{" "}
            <span className="text-gradient-soft">Nothing you don&apos;t.</span>
          </>
        }
        description="Six modules engineered for daily execution and yearlong compounding."
      />

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={viewportConfig}
        variants={staggerContainer}
        className="mt-16 md:mt-20 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center"
      >
        {/* Left — feature list */}
        <motion.div
          variants={fadeUp}
          className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3 will-change-transform"
        >
          {features.map((f, i) => {
            const isActive = i === active;
            const Icon = f.Icon;
            return (
              <button
                key={f.title}
                type="button"
                onClick={() => setActive(i)}
                onMouseEnter={() => setActive(i)}
                className={`group text-left p-5 rounded-card border transition-colors duration-700 ease-out ${
                  isActive
                    ? "bg-white/[0.05] border-white/15"
                    : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/10"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-[8px] border transition-colors duration-700 ${
                      isActive
                        ? "border-white/20 bg-white/[0.06]"
                        : "border-white/8 bg-white/[0.02]"
                    }`}
                  >
                    <Icon className="h-4 w-4 text-white/80" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1">
                    <h3
                      className={`font-sans text-[15px] font-semibold transition-colors duration-700 ${
                        isActive ? "text-white" : "text-white/85"
                      }`}
                    >
                      {f.title}
                    </h3>
                    <p className="mt-1.5 text-[13px] leading-[1.6] text-white/55">
                      {f.body}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </motion.div>

        {/* Right — phone with screen that swaps when feature changes */}
        <motion.div
          variants={fadeUp}
          className="lg:col-span-5 flex justify-center will-change-transform"
        >
          <div className="relative w-[280px] md:w-[300px]">
            <PhoneMockup>
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: titanEase }}
                  className="absolute inset-0 will-change-transform"
                >
                  <ActiveScreen />
                </motion.div>
              </AnimatePresence>
            </PhoneMockup>
          </div>
        </motion.div>
      </motion.div>
    </Section>
  );
}
