/**
 * Pricing page. During beta, everything is free. The page stays up so
 * marketing can link to it and so users know what's coming when paid
 * tiers launch (P5 of SAAS_ROADMAP).
 */
import { Link } from "react-router-dom";
import { useWebAuth } from "../../lib/auth";

export default function PricingPage() {
  const { user } = useWebAuth();
  const ctaHref = user ? "/app" : "/auth/login?mode=signup";
  const ctaLabel = user ? "Open the app →" : "Start free →";

  return (
    <>
      <section className="mk-page-hero">
        <p className="mk-section-kicker">Pricing</p>
        <h1 className="mk-page-title">Free during beta.</h1>
        <p className="mk-page-lede">
          Every feature is unlocked. No card. No trial countdown. We'll
          announce paid tiers when the product is mature enough to justify
          one — and existing users get a runway when that day comes.
        </p>
      </section>

      <section className="mk-section" style={{ borderTop: "none", paddingTop: 0 }}>
        <div className="mk-grid-3" style={{ alignItems: "stretch" }}>
          <article className="mk-card" style={{ display: "flex", flexDirection: "column" }}>
            <p className="mk-card-mark">TIER.00 · NOW</p>
            <h3 className="mk-card-title">Beta · Free</h3>
            <p className="mk-card-text" style={{ flex: 1 }}>
              Full access to every engine, every screen, every sync feature.
              No usage caps. Your data, your control.
            </p>
            <Link to={ctaHref} className="mk-btn mk-btn-primary" style={{ marginTop: 20 }}>
              {ctaLabel}
            </Link>
          </article>

          <article className="mk-card" style={{ display: "flex", flexDirection: "column", opacity: 0.55 }}>
            <p className="mk-card-mark">TIER.01 · LATER</p>
            <h3 className="mk-card-title">Pro · TBD</h3>
            <p className="mk-card-text" style={{ flex: 1 }}>
              Higher limits, push notifications, advanced analytics, priority
              support. Pricing not finalized. Subscription, not lifetime.
            </p>
            <span
              className="mk-btn mk-btn-ghost"
              style={{ marginTop: 20, cursor: "not-allowed" }}
              aria-disabled="true"
            >
              Coming with P5
            </span>
          </article>

          <article className="mk-card" style={{ display: "flex", flexDirection: "column", opacity: 0.55 }}>
            <p className="mk-card-mark">TIER.02 · LATER</p>
            <h3 className="mk-card-title">Team · TBD</h3>
            <p className="mk-card-text" style={{ flex: 1 }}>
              Family / household plans. Shared accountability surfaces.
              Not on the immediate roadmap. Tell us if it matters to you.
            </p>
            <span
              className="mk-btn mk-btn-ghost"
              style={{ marginTop: 20, cursor: "not-allowed" }}
              aria-disabled="true"
            >
              Post-launch
            </span>
          </article>
        </div>
      </section>

      <section className="mk-section">
        <p className="mk-section-kicker">For Classic customers</p>
        <h2 className="mk-section-title">You get a runway.</h2>
        <p className="mk-section-lede">
          Bought the Tauri desktop build or the Android APK before the SaaS
          existed? When paid tiers turn on, you get 6–12 months of Pro on the
          house. You don't have to do anything — we'll honor your old
          purchase against your new account's email.
        </p>
      </section>

      <section className="mk-section">
        <p className="mk-section-kicker">FAQ</p>
        <h2 className="mk-section-title">Common questions.</h2>

        <div className="mk-grid-3" style={{ marginTop: 28 }}>
          {FAQ.map((q) => (
            <article key={q.q} className="mk-step">
              <h3 className="mk-card-title" style={{ fontSize: 16 }}>{q.q}</h3>
              <p className="mk-card-text">{q.a}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

const FAQ = [
  {
    q: "Is there a free trial?",
    a: "Better than a trial — the whole product is free during beta. When tiers launch, current users get notice plus the Classic-customer runway.",
  },
  {
    q: "How is my data stored?",
    a: "Local-first SQLite cache on each device, Supabase as the source of truth, RLS so only you can read your rows. We don't sell data; we don't train on it.",
  },
  {
    q: "Can I export everything?",
    a: "Yes. Settings has a full JSON / CSV export. Your data is yours — you can leave anytime.",
  },
  {
    q: "What's the difference vs the Classic apps?",
    a: "Classic Titan Protocol is a single-device standalone (Tauri desktop or APK). The new SaaS syncs across web, desktop, and mobile from one account.",
  },
  {
    q: "Do I need an account?",
    a: "Yes — that's what makes sync work. Email + password or Google sign-in. We send verification but otherwise we leave you alone.",
  },
  {
    q: "Will my data leave my region?",
    a: "Supabase project is in ap-south-1 (Mumbai). When we add regional pinning it'll be opt-in. Until then, everything routes through that region.",
  },
];
