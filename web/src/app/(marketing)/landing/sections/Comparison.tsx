import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import Section from "../ui/Section";
import SectionHeading from "../ui/SectionHeading";
import { fadeUp, staggerContainer, viewportConfig } from "../lib/animations";

const rows = [
  { feature: "Gamified XP & rank system", titan: true, others: false },
  { feature: "Four-engine life tracking", titan: true, others: false },
  { feature: "Daily scoring & streaks", titan: true, others: false },
  { feature: "XP-multiplying streak engine", titan: true, others: false },
  { feature: "Realtime cross-device sync", titan: true, others: false },
  { feature: "Instant local cache on every device", titan: true, others: false },
  { feature: "Free during beta", titan: true, others: false },
];

export default function Comparison() {
  return (
    <Section id="comparison">
      <SectionHeading
        label="Why Titan Protocol"
        title={
          <>
            Titan Protocol{" "}
            <span className="text-gradient-soft">vs. everything else.</span>
          </>
        }
        description="A side-by-side breakdown of where Titan Protocol ends and the rest of the productivity world begins."
      />

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={viewportConfig}
        className="mt-16 md:mt-20 max-w-3xl mx-auto surface-card overflow-hidden"
        style={{ padding: 0 }}
      >
        {/* Header row */}
        <div className="grid grid-cols-[1.4fr_1fr_1fr] md:grid-cols-[2fr_1fr_1fr] border-b border-white/8">
          <div className="px-6 md:px-8 py-6">
            <p className="font-sans text-[13px] font-medium text-white/45">
              Capability
            </p>
          </div>
          <div className="px-3 md:px-6 py-6 border-l border-white/8 text-center">
            <p className="font-sans text-base md:text-lg text-white font-semibold">
              Titan Protocol
            </p>
          </div>
          <div className="px-3 md:px-6 py-6 border-l border-white/8 text-center">
            <p className="font-sans text-base md:text-lg text-white/50 font-medium">
              Generic apps
            </p>
          </div>
        </div>

        {/* Rows */}
        {rows.map((row, i) => (
          <motion.div
            key={i}
            variants={fadeUp}
            className={`grid grid-cols-[1.4fr_1fr_1fr] md:grid-cols-[2fr_1fr_1fr] ${
              i !== rows.length - 1 ? "border-b border-white/6" : ""
            }`}
          >
            <div className="px-6 md:px-8 py-5 md:py-6">
              <p className="text-[14px] md:text-[15px] text-white/85">
                {row.feature}
              </p>
            </div>
            <div className="px-3 md:px-6 py-5 md:py-6 border-l border-white/8 flex items-center justify-center">
              {row.titan ? (
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/25 bg-white/[0.06]">
                  <Check className="h-4 w-4 text-white" strokeWidth={2.5} />
                </span>
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/8 bg-white/[0.02]">
                  <X className="h-4 w-4 text-white/30" strokeWidth={2} />
                </span>
              )}
            </div>
            <div className="px-3 md:px-6 py-5 md:py-6 border-l border-white/8 flex items-center justify-center">
              {row.others ? (
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/[0.04]">
                  <Check className="h-4 w-4 text-white/55" strokeWidth={2.5} />
                </span>
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/8 bg-white/[0.02]">
                  <X className="h-4 w-4 text-white/30" strokeWidth={2} />
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </Section>
  );
}
