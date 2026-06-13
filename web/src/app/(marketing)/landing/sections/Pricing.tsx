import { motion } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Section from "../ui/Section";
import SectionHeading from "../ui/SectionHeading";
import Button from "../ui/Button";
import { scaleIn, staggerContainer, viewportConfig } from "../lib/animations";
import { useLandingCtas } from "../lib/useLandingCtas";

const features = [
  "Every engine unlocked — Body, Mind, Money, Charisma",
  "Realtime sync across your devices",
  "Daily Titan Score, eight ranks & streaks",
  "Instant local cache on every device",
  "Your data, your control — delete everything in one click",
  "Classic customers: 6–12 months of Pro, free",
];

export default function Pricing() {
  const navigate = useNavigate();
  const { primaryHref, primaryLabel } = useLandingCtas();

  return (
    <Section id="pricing" className="relative overflow-hidden">
      <SectionHeading
        label="Pricing"
        title={
          <>
            Free during beta. <span className="text-gradient-soft">No card.</span>
          </>
        }
        description="The full system is free while we're in beta. Paid plans arrive later — and existing Titan Protocol Classic customers get months of Pro on us."
      />

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={viewportConfig}
        className="relative z-10 mt-16 md:mt-20 max-w-md mx-auto"
      >
        <motion.div variants={scaleIn}>
          <div className="surface-card p-8 md:p-10 relative overflow-hidden">
            {/* Top champagne accent line */}
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(201,185,154,0.7) 50%, transparent 100%)",
              }}
            />

            <div className="text-center">
              <p className="font-sans text-[14px] font-medium text-white/45">
                Titan Protocol
              </p>

              <div className="mt-5 flex items-baseline justify-center gap-3 flex-wrap">
                <span className="font-sans text-[64px] md:text-[72px] text-champagne tracking-[-0.04em] font-bold leading-none">
                  Free
                </span>
              </div>

              <div className="mt-3 flex items-center justify-center">
                <span
                  className="font-sans text-[12px] font-medium text-titan-champagne border border-titan-champagne/40 bg-titan-champagne/10 px-3 py-1 rounded-pill"
                  style={{ boxShadow: "0 0 20px rgba(201, 185, 154, 0.18)" }}
                >
                  Beta access · all features
                </span>
              </div>
            </div>

            {/* Feature list */}
            <ul className="mt-8 space-y-3.5">
              {features.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-3 text-[14px] text-white/80"
                >
                  <span className="flex h-5 w-5 mt-0.5 flex-shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/[0.04]">
                    <Check className="h-3 w-3 text-white" strokeWidth={2.5} />
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            {/* CTA */}
            <div className="mt-8">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                iconRight={<ArrowRight className="h-4 w-4" />}
                onClick={() => navigate(primaryHref)}
              >
                {primaryLabel}
              </Button>
            </div>

            <p className="mt-5 text-center font-sans text-[12px] text-white/40">
              No credit card · Free during beta · Free updates
            </p>
          </div>
        </motion.div>
      </motion.div>
    </Section>
  );
}
