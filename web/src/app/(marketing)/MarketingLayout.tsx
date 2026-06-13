/**
 * Shared chrome for the marketing pages — a clean black floating-pill nav +
 * footer ported from the standalone landing repo, scoped under `.titan-landing`
 * so it inherits the Inter/black aesthetic. Auth state flips the right-side CTA
 * between "Sign in / Start free" and "Open the app".
 *
 * HashRouter constraint: in-page section links can't use `href="#id"` (the hash
 * is the router), so they're buttons that smooth-scroll — navigating home first
 * when triggered from a sub-page. Real routes still use react-router <Link>.
 */
import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowRight } from "lucide-react";
import { useWebAuth } from "../../lib/auth";
import TitanLogo from "./landing/ui/TitanLogo";
import Button from "./landing/ui/Button";
import { titanEase } from "./landing/lib/animations";
import { cn } from "./landing/lib/cn";
import "./marketing.css";

const sectionLinks = [
  { label: "Features", id: "features" },
  { label: "How it works", id: "how-it-works" },
  { label: "Pricing", id: "pricing" },
  { label: "FAQ", id: "faq" },
];

/** Smooth-scroll to a landing section, navigating home first if elsewhere. */
function useScrollToSection() {
  const navigate = useNavigate();
  const location = useLocation();
  return (id: string) => {
    const go = () =>
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    if (location.pathname === "/") {
      go();
    } else {
      navigate("/");
      window.setTimeout(go, 120);
    }
  };
}

export function MarketingLayout() {
  return (
    <div className="mk-root titan-landing">
      <MarketingNav />
      <main className="mk-main">
        <Outlet />
      </main>
      <MarketingFooter />
    </div>
  );
}

function MarketingNav() {
  const { user, loading } = useWebAuth();
  const navigate = useNavigate();
  const scrollToSection = useScrollToSection();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const primaryHref = user ? "/app" : "/auth/login?mode=signup";
  const primaryLabel = user ? "Open the app" : "Get started";

  return (
    <>
      {/* Floating pill navbar */}
      <header className="fixed top-5 left-0 right-0 z-50 flex justify-center px-5">
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.9, ease: titanEase, delay: 0.1 }}
          className={cn(
            "flex items-center gap-2 transition-all duration-700 ease-out",
            "rounded-pill px-3 py-2 md:pl-5 md:pr-3",
            scrolled
              ? "bg-black/60 backdrop-blur-2xl border border-white/8"
              : "bg-white/[0.02] backdrop-blur-md border border-white/6",
          )}
        >
          <Link
            to="/"
            className="flex items-center pr-3 md:pr-5"
            aria-label="Titan Protocol home"
          >
            <TitanLogo />
          </Link>

          <nav
            className="hidden md:flex items-center gap-1 border-l border-white/8 pl-3"
            aria-label="Primary"
          >
            {sectionLinks.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => scrollToSection(link.id)}
                className="px-4 py-2 rounded-pill font-sans text-[14px] font-medium text-white/65 hover:text-white hover:bg-white/[0.05] transition-all duration-700"
              >
                {link.label}
              </button>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2 ml-2">
            {!loading && !user && (
              <Link
                to="/auth/login"
                className="px-3 py-2 rounded-pill font-sans text-[14px] font-medium text-white/65 hover:text-white transition-colors duration-700"
              >
                Sign in
              </Link>
            )}
            <Button
              size="sm"
              variant="primary"
              iconRight={<ArrowRight className="h-3.5 w-3.5" />}
              onClick={() => navigate(primaryHref)}
            >
              {primaryLabel}
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden flex items-center justify-center h-10 w-10 rounded-full border border-white/12 text-white"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </motion.div>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.5, ease: titanEase }}
              className="fixed top-0 right-0 bottom-0 w-[300px] z-50 bg-titan-bg border-l border-white/8 md:hidden flex flex-col"
            >
              <div className="flex items-center justify-between h-16 px-5 border-b border-white/8">
                <TitanLogo showFull={false} />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="h-9 w-9 flex items-center justify-center rounded-full border border-white/12 text-white"
                  aria-label="Close menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav className="flex flex-col p-5 gap-1" aria-label="Mobile primary">
                {sectionLinks.map((link) => (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      scrollToSection(link.id);
                    }}
                    className="text-left font-sans text-[16px] font-medium text-white/85 hover:text-white py-4 border-b border-white/6"
                  >
                    {link.label}
                  </button>
                ))}
                {!loading && !user && (
                  <Link
                    to="/auth/login"
                    onClick={() => setMobileOpen(false)}
                    className="font-sans text-[16px] font-medium text-white/85 hover:text-white py-4 border-b border-white/6"
                  >
                    Sign in
                  </Link>
                )}
              </nav>

              <div className="mt-auto p-5 border-t border-white/8">
                <Button
                  fullWidth
                  variant="primary"
                  size="md"
                  iconRight={<ArrowRight className="h-3.5 w-3.5" />}
                  onClick={() => {
                    setMobileOpen(false);
                    navigate(primaryHref);
                  }}
                >
                  {primaryLabel}
                </Button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function MarketingFooter() {
  const scrollToSection = useScrollToSection();

  return (
    <footer className="relative bg-titan-bg pt-24 md:pt-32 pb-16">
      <div className="container-titan">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
          <div className="col-span-2">
            <TitanLogo />
            <p className="mt-6 max-w-xs text-[14px] leading-[1.7] text-white/55">
              The personal operating system for discipline. Turn execution into
              XP and consistency into compounding power.
            </p>
          </div>

          <div>
            <p className="font-sans text-[13px] font-semibold text-white/55">
              Product
            </p>
            <ul className="mt-6 space-y-3.5">
              {sectionLinks.map((link) => (
                <li key={link.id}>
                  <button
                    type="button"
                    onClick={() => scrollToSection(link.id)}
                    className="text-[14px] text-white/70 hover:text-white transition-colors duration-700"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-sans text-[13px] font-semibold text-white/55">
              Company
            </p>
            <ul className="mt-6 space-y-3.5">
              <li>
                <Link
                  to="/about"
                  className="text-[14px] text-white/70 hover:text-white transition-colors duration-700"
                >
                  About
                </Link>
              </li>
              <li>
                <a
                  href="mailto:hello@titanprotocol.app"
                  className="text-[14px] text-white/70 hover:text-white transition-colors duration-700"
                >
                  Contact
                </a>
              </li>
              <li>
                <Link
                  to="/auth/login?mode=signup"
                  className="text-[14px] text-white/70 hover:text-white transition-colors duration-700"
                >
                  Start free
                </Link>
              </li>
              <li>
                <Link
                  to="/auth/login"
                  className="text-[14px] text-white/70 hover:text-white transition-colors duration-700"
                >
                  Sign in
                </Link>
              </li>
              <li>
                <Link
                  to="/privacy"
                  className="text-[14px] text-white/70 hover:text-white transition-colors duration-700"
                >
                  Privacy
                </Link>
              </li>
              <li>
                <Link
                  to="/terms"
                  className="text-[14px] text-white/70 hover:text-white transition-colors duration-700"
                >
                  Terms
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-20 pt-8 border-t border-white/6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="font-sans text-[13px] text-white/40">
            © {new Date().getFullYear()} Titan Protocol. Built with discipline.
          </p>
          <p className="font-sans text-[13px] text-white/40">
            Free during beta ·{" "}
            <Link to="/privacy" className="hover:text-white/70 underline underline-offset-2">
              Privacy
            </Link>{" "}
            ·{" "}
            <Link to="/terms" className="hover:text-white/70 underline underline-offset-2">
              Terms
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
