/**
 * Public landing page at `/`. Ported from the standalone landing repo and
 * reframed as a web-first SaaS landing (auth CTAs, free-during-beta, no
 * one-time purchase). The whole tree is scoped by the `.titan-landing` wrapper
 * provided by MarketingLayout; the fixed ScrollBackground only paints here.
 *
 * Section order: Hero → PhoneShowcase → Features → AppShowcase → Benefits →
 * LogoStrip → Pricing → Comparison → FAQ → CTA. (Source Stats + Testimonials
 * sections were cut — fabricated social proof.)
 */
import { lazy, Suspense } from "react";
import ScrollBackground from "./landing/effects/ScrollBackground";
import HeroProcessFlow from "./landing/sections/HeroProcessFlow";
import PhoneShowcase from "./landing/sections/PhoneShowcase";
import Features from "./landing/sections/Features";
import AppShowcase from "./landing/sections/AppShowcase";
import Benefits from "./landing/sections/Benefits";
import LogoStrip from "./landing/sections/LogoStrip";
import Pricing from "./landing/sections/Pricing";
import CTA from "./landing/sections/CTA";

// Below-fold — code-split out of the initial bundle.
const Comparison = lazy(() => import("./landing/sections/Comparison"));
const FAQ = lazy(() => import("./landing/sections/FAQ"));

export default function LandingPage() {
  return (
    <>
      {/* Global scroll-driven background — fixed, behind everything. */}
      <ScrollBackground />

      <div className="relative z-10">
        <HeroProcessFlow />
        <PhoneShowcase />
        <Features />
        <AppShowcase />
        <Benefits />
        <LogoStrip />
        <Pricing />
        <Suspense fallback={<div style={{ minHeight: 600 }} />}>
          <Comparison />
          <FAQ />
        </Suspense>
        <CTA />
      </div>
    </>
  );
}
