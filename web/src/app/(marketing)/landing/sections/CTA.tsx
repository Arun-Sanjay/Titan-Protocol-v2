import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Section from "../ui/Section";
import Button from "../ui/Button";
import PhoneMockup from "../ui/PhoneMockup";
import DashboardScreen from "../mockups/DashboardScreen";
import { fadeUp, scaleIn, staggerContainer, viewportConfig } from "../lib/animations";
import { useLandingCtas } from "../lib/useLandingCtas";

export default function CTA() {
  const navigate = useNavigate();
  const { primaryHref, primaryLabel } = useLandingCtas();

  return (
    <Section id="get-started" className="relative overflow-hidden">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={viewportConfig}
        className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center"
      >
        {/* Left — copy + CTA */}
        <motion.div
          variants={fadeUp}
          className="flex flex-col items-center lg:items-start text-center lg:text-left"
        >
          <p className="font-sans text-[16px] md:text-[14px] font-medium text-white/45">
            The protocol is waiting
          </p>
          <h2 className="mt-5 heading-section text-white text-balance text-[48px] md:text-[52px] lg:text-[64px] max-w-xl">
            The protocol <span className="text-gradient-soft">is waiting.</span>
          </h2>
          <p className="mt-7 max-w-lg text-[19px] md:text-[19px] leading-[1.7] text-white/60">
            Four engines. One system that changes everything. Create your account
            and run your first day in minutes.
          </p>

          <div className="mt-10 flex flex-col xs:flex-row items-center gap-3">
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
                  .getElementById("features")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              See features
            </Button>
          </div>

          <div className="mt-10 flex items-center gap-5 font-sans text-[15px] md:text-[13px] text-white/40">
            <span>Free during beta</span>
            <span className="text-white/15">·</span>
            <span>No card required</span>
          </div>
        </motion.div>

        {/* Right — phone */}
        <motion.div
          variants={scaleIn}
          className="flex justify-center lg:justify-end will-change-transform"
        >
          <div className="relative w-[280px] md:w-[320px]">
            <PhoneMockup>
              <DashboardScreen device="phone" />
            </PhoneMockup>
          </div>
        </motion.div>
      </motion.div>
    </Section>
  );
}
