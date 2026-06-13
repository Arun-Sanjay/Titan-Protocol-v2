import { motion } from "framer-motion";
import { fadeIn, viewportConfig } from "../lib/animations";

const partners = [
  "Web",
  "Desktop",
  "iOS",
  "Android",
  "React",
  "Supabase",
  "TypeScript",
  "Realtime",
];

export default function LogoStrip() {
  return (
    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={viewportConfig}
      variants={fadeIn}
      className="relative py-20 md:py-24 overflow-hidden will-change-transform"
    >
      <div className="container-titan mb-10">
        <p className="text-center font-sans text-[14px] font-medium text-white/40">
          One account, synced across every surface you work from
        </p>
      </div>
      <div className="relative mask-fade-edges overflow-hidden">
        {/* Pure CSS marquee — runs on the compositor thread */}
        <div className="marquee-x-fast flex gap-16 md:gap-24 items-center w-max">
          {[...partners, ...partners, ...partners].map((p, i) => (
            <div
              key={i}
              className="flex items-center flex-shrink-0 text-white/50 hover:text-white/80 transition-colors duration-700"
            >
              <span
                className="font-sans text-[18px] md:text-[20px] font-semibold whitespace-nowrap"
                style={{ letterSpacing: "-0.015em" }}
              >
                {p}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
