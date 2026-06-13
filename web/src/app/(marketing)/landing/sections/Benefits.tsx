import { motion } from "framer-motion";
import { Dumbbell, Brain, Coins, Users } from "lucide-react";
import Section from "../ui/Section";
import SectionHeading from "../ui/SectionHeading";
import { fadeUp, staggerContainer, viewportConfig } from "../lib/animations";

const engines = [
  {
    Icon: Dumbbell,
    title: "Body",
    body: "Physical capacity — workouts, sleep, nutrition, and recovery. Your body is the foundation. The system makes sure you never skip it.",
    color: "#00FF88",
  },
  {
    Icon: Brain,
    title: "Mind",
    body: "Intellectual edge — deep work, learning, and focus sessions. Sharpen the blade every single day.",
    color: "#A78BFA",
  },
  {
    Icon: Coins,
    title: "Money",
    body: "Financial discipline — income tracking, budgets, and cashflow. Build the machine that funds everything else.",
    color: "#FBBF24",
  },
  {
    Icon: Users,
    title: "Charisma",
    body: "Social influence — communication, networking, and presence. The engine most people ignore. You won't.",
    color: "#60A5FA",
  },
];

export default function Benefits() {
  return (
    <Section id="benefits">
      <SectionHeading
        label="Four dimensions. One system."
        title={
          <>
            Every aspect of performance.{" "}
            <span className="text-gradient-soft">Measured.</span>
          </>
        }
        description="Four engines working together. Each one tracks, scores, and pushes a different dimension of your life. Nothing gets ignored."
      />

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={viewportConfig}
        className="mt-16 md:mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6"
      >
        {engines.map(({ Icon, title, body, color }) => (
          <motion.div key={title} variants={fadeUp}>
            <div className="surface-card p-8 md:p-9 h-full flex flex-col relative overflow-hidden">
              {/* Top engine color accent line */}
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{
                  background: `linear-gradient(90deg, transparent 0%, ${color} 50%, transparent 100%)`,
                  opacity: 0.7,
                }}
              />

              <div
                className="flex h-12 w-12 items-center justify-center rounded-[10px]"
                style={{
                  background: `${color}10`,
                  boxShadow: `0 0 32px ${color}25, inset 0 0 0 1px ${color}30`,
                }}
              >
                <Icon className="h-5 w-5" style={{ color }} strokeWidth={1.5} />
              </div>

              <h3 className="mt-7 heading-section text-white text-2xl">{title}</h3>
              <p className="mt-3 text-[15px] leading-[1.7] text-white/60">{body}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </Section>
  );
}
