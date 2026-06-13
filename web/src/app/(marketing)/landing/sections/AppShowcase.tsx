import { motion } from "framer-motion";
import Section from "../ui/Section";
import SectionHeading from "../ui/SectionHeading";
import LaptopMockup from "../ui/LaptopMockup";
import PhoneMockup from "../ui/PhoneMockup";
import DashboardScreen from "../mockups/DashboardScreen";
import MissionScreen from "../mockups/MissionScreen";
import { fadeUp, scaleIn, staggerContainer, viewportConfig } from "../lib/animations";

export default function AppShowcase() {
  return (
    <Section id="showcase" className="relative overflow-hidden">
      <SectionHeading
        label="Available everywhere"
        title={
          <>
            One protocol. <span className="text-gradient-soft">Every device.</span>
          </>
        }
        description="The same data, the same Titan Score, the same rank ladder — on the web, on your desktop, and on your phone. Synced in realtime to one account."
      />

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={viewportConfig}
        className="relative z-10 mt-20 md:mt-28 flex flex-col items-center gap-20 md:gap-24"
      >
        {/* Two-device stage: laptop (lead) + phone */}
        <div className="relative w-full flex flex-col md:flex-row items-center justify-center gap-16 md:gap-0">
          {/* Laptop */}
          <motion.div
            variants={scaleIn}
            className="relative w-full max-w-[600px] lg:max-w-[680px] z-10 will-change-transform"
          >
            <LaptopMockup floatDelay={0}>
              <DashboardScreen device="laptop" />
            </LaptopMockup>
          </motion.div>

          {/* Phone — overlaps the laptop's right edge, leaning forward */}
          <motion.div
            variants={scaleIn}
            className="relative w-[210px] lg:w-[230px] z-20 md:-ml-24 lg:-ml-28 md:translate-y-6 will-change-transform"
          >
            <PhoneMockup tilt={6} floatDelay={1.2}>
              <MissionScreen />
            </PhoneMockup>
          </motion.div>
        </div>

        {/* Platform tags row */}
        <motion.div
          variants={fadeUp}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          {["Web · live", "macOS / Windows · coming soon", "iOS / Android · coming soon"].map(
            (label) => (
              <span
                key={label}
                className="font-sans text-[13px] font-medium text-white/55 border border-white/10 bg-white/[0.03] rounded-pill px-4 py-1.5"
              >
                {label}
              </span>
            ),
          )}
        </motion.div>
      </motion.div>
    </Section>
  );
}
