import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Section from "../ui/Section";
import Button from "../ui/Button";
import PhoneMockup from "../ui/PhoneMockup";
import DashboardScreen from "../mockups/DashboardScreen";
import { fadeUp, scaleIn, staggerContainer, viewportConfig } from "../lib/animations";
import { useLandingCtas } from "../lib/useLandingCtas";

/**
 * "Also on mobile" proof — large centered phone, bold headline, single CTA.
 */
export default function PhoneShowcase() {
  const navigate = useNavigate();
  const { primaryHref, primaryLabel } = useLandingCtas();
  return (
    <Section className="relative overflow-hidden">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={viewportConfig}
        className="relative z-10 flex flex-col items-center text-center"
      >
        <motion.h2
          variants={fadeUp}
          className="heading-section text-white text-balance text-[40px] md:text-[56px] lg:text-[68px] max-w-4xl mx-auto"
        >
          Built to make consistency{" "}
          <span className="text-gradient-soft">unavoidable.</span>
        </motion.h2>

        <motion.p
          variants={fadeUp}
          className="mt-7 max-w-xl text-[17px] md:text-[19px] leading-[1.7] text-white/60 text-balance"
        >
          The protocol learns your patterns. Streaks compound. Miss-day penalties
          bite. The system holds you accountable so you don&apos;t have to — in your
          pocket, in your browser, on your desk.
        </motion.p>

        <motion.div variants={fadeUp} className="mt-10">
          <Button
            variant="primary"
            size="lg"
            iconRight={<ArrowRight className="h-4 w-4" />}
            onClick={() => navigate(primaryHref)}
          >
            {primaryLabel}
          </Button>
        </motion.div>

        {/* Big phone */}
        <motion.div
          variants={scaleIn}
          className="relative mt-20 md:mt-24 w-[280px] xs:w-[320px] md:w-[360px] lg:w-[400px] will-change-transform"
        >
          <PhoneMockup>
            <DashboardScreen device="phone" />
          </PhoneMockup>
        </motion.div>
      </motion.div>
    </Section>
  );
}
