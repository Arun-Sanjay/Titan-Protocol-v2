/**
 * Public landing page at `/`. The front door — premium dark HUD styling
 * that mirrors the in-app aesthetic, so the visual identity feels
 * continuous between marketing and product.
 *
 * Sections:
 *   1. Hero — value proposition + dual CTA
 *   2. Engine system overview — Body / Mind / Money / Charisma
 *   3. How it works — 3-step rhythm
 *   4. Daily Titan Score — 0-100 explainer
 *   5. Rank ladder — Initiate → Titan
 *   6. Cross-device sync block
 *   7. Pricing teaser
 *   8. CTA tail
 */
import { Link } from "react-router-dom";
import { useWebAuth } from "../../lib/auth";

export default function LandingPage() {
  const { user } = useWebAuth();
  const primaryCtaHref = user ? "/app" : "/auth/login?mode=signup";
  const primaryCtaLabel = user ? "Open the app →" : "Start free →";

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="mk-hero">
        <span className="mk-hero-pill">
          <span className="mk-hero-pill-dot" />
          System v1 · Free during beta
        </span>

        <h1 className="mk-hero-title">
          Run your life
          <br />
          <span className="mk-hero-title-accent">like a system.</span>
        </h1>

        <p className="mk-hero-subtitle">
          Titan Protocol is the personal OS for people who refuse to drift.
          Track every domain — body, mind, money, charisma — with the
          discipline of a system. Daily scores. Identity-driven ranks.
          Synced across web, desktop, and mobile.
        </p>

        <div className="mk-hero-ctas">
          <Link to={primaryCtaHref} className="mk-btn mk-btn-primary">
            {primaryCtaLabel}
          </Link>
          <Link to="/features" className="mk-btn mk-btn-ghost">
            See the system
          </Link>
        </div>

        <div className="mk-hero-meta">
          <span className="mk-hero-meta-item">
            <span className="mk-hero-meta-bullet" /> No card. No trial timer.
          </span>
          <span className="mk-hero-meta-item">
            <span className="mk-hero-meta-bullet" /> Sync across devices
          </span>
          <span className="mk-hero-meta-item">
            <span className="mk-hero-meta-bullet" /> Your data, your control
          </span>
        </div>
      </section>

      {/* ── Engine system ────────────────────────────────────── */}
      <section className="mk-section">
        <p className="mk-section-kicker">The four engines</p>
        <h2 className="mk-section-title">A system, not a notebook.</h2>
        <p className="mk-section-lede">
          Most "second brain" tools collect — Titan Protocol executes.
          Every task you add belongs to one of four engines. Each engine
          tracks its own progress, score, and rank. You see exactly which
          domain of your life is on fire and which one's been ignored.
        </p>

        <div className="mk-grid mk-grid-4">
          {ENGINES.map((e) => (
            <article key={e.key} className="mk-card">
              <p className="mk-card-mark">{e.mark}</p>
              <h3 className="mk-card-title">{e.title}</h3>
              <p className="mk-card-text">{e.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────── */}
      <section className="mk-section">
        <p className="mk-section-kicker">How it works</p>
        <h2 className="mk-section-title">Three-step rhythm. Every day.</h2>
        <p className="mk-section-lede">
          The whole system collapses to a daily loop. No setup ceremony,
          no methodology to memorize. Just three motions.
        </p>

        <div className="mk-grid-3">
          {STEPS.map((s, i) => (
            <article key={s.title} className="mk-step">
              <p className="mk-step-num">0{i + 1}</p>
              <h3 className="mk-card-title">{s.title}</h3>
              <p className="mk-card-text">{s.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Daily Titan Score ────────────────────────────────── */}
      <section className="mk-section">
        <p className="mk-section-kicker">Daily scoring</p>
        <h2 className="mk-section-title">A number you cannot fake.</h2>
        <p className="mk-section-lede">
          Your Titan Score (0–100) is the archetype-weighted average of all
          four engine scores for the day. Hit your main tasks, score climbs.
          Drift, and it tells you exactly which engine fell behind.
        </p>

        <div className="mk-stat">
          <span className="mk-stat-value">87</span>
          <div className="mk-stat-body">
            <p className="mk-stat-title">Today · Grade A</p>
            <p className="mk-stat-desc">
              Body 92 · Mind 84 · Money 81 · Charisma 90.
              The score updates live as you complete tasks. SS ≥ 95 ·
              S ≥ 85 · A ≥ 70 · B ≥ 50 · C ≥ 30 · D ≥ 0.
            </p>
          </div>
        </div>
      </section>

      {/* ── Rank ladder ─────────────────────────────────────── */}
      <section className="mk-section">
        <p className="mk-section-kicker">Progression</p>
        <h2 className="mk-section-title">Six ranks. One identity.</h2>
        <p className="mk-section-lede">
          XP rewards stack across daily completions. Cross level
          thresholds and your rank advances — Initiate to Titan. Your
          archetype shapes which engines weight heaviest.
        </p>

        <div className="mk-ranks">
          {RANKS.map((r, i) => (
            <div key={r.name} className="mk-rank">
              <p className="mk-rank-name">{r.name}</p>
              <p className="mk-rank-tier">Tier 0{i + 1} · Lv {r.minLevel}+</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Sync block ─────────────────────────────────────── */}
      <section className="mk-section">
        <p className="mk-section-kicker">Cross-device</p>
        <h2 className="mk-section-title">One account. Every screen.</h2>
        <p className="mk-section-lede">
          Sign in anywhere — web, Mac, Windows, mobile — and your data is
          there in seconds. Edits propagate live: tick a task on your phone
          while you're on a run, and it's checked off on your laptop before
          you sit down.
        </p>

        <div className="mk-grid-3">
          <article className="mk-step">
            <p className="mk-step-num">⌘</p>
            <h3 className="mk-card-title">Web</h3>
            <p className="mk-card-text">
              titanprotocol.app · works in any modern browser. Local cache
              means reads are instant; cloud sync runs in the background.
            </p>
          </article>
          <article className="mk-step">
            <p className="mk-step-num">⊞</p>
            <h3 className="mk-card-title">Desktop</h3>
            <p className="mk-card-text">
              Native installer for macOS &amp; Windows. Auto-updates. Lives
              in your dock or system tray. Same UI, same data.
            </p>
          </article>
          <article className="mk-step">
            <p className="mk-step-num">▢</p>
            <h3 className="mk-card-title">Mobile</h3>
            <p className="mk-card-text">
              iOS &amp; Android. Push notifications when a streak's at risk.
              Touch-first UI. Offline reads, live sync when back online.
            </p>
          </article>
        </div>
      </section>

      {/* ── Pricing teaser ─────────────────────────────────── */}
      <section className="mk-section">
        <div className="mk-price">
          <span className="mk-price-pill">Beta access</span>
          <p className="mk-price-big">Free, no strings.</p>
          <p className="mk-price-sub">
            Every feature is unlocked during the beta. Paid tiers arrive
            later. Classic Tauri / APK customers get 6–12 months Pro on us
            when billing turns on.
          </p>
          <Link to={primaryCtaHref} className="mk-btn mk-btn-primary">
            {primaryCtaLabel}
          </Link>
        </div>
      </section>

      {/* ── Tail CTA ───────────────────────────────────────── */}
      <section className="mk-section" style={{ borderTop: "none", textAlign: "center", paddingBottom: 96 }}>
        <h2 className="mk-section-title" style={{ marginBottom: 24 }}>
          Build the protocol. <br />Then run it.
        </h2>
        <Link to={primaryCtaHref} className="mk-btn mk-btn-primary">
          {primaryCtaLabel}
        </Link>
      </section>
    </>
  );
}

// ────────────────────────── Data ──────────────────────────

const ENGINES = [
  {
    key: "body",
    mark: "ENG.01 // BODY",
    title: "Body",
    desc: "Strength, cardio, sleep, weight, nutrition. The substrate that everything else depends on.",
  },
  {
    key: "mind",
    mark: "ENG.02 // MIND",
    title: "Mind",
    desc: "Reading, learning, deep focus, mental drills. The compounding interest of your cognition.",
  },
  {
    key: "money",
    mark: "ENG.03 // MONEY",
    title: "Money",
    desc: "Deep work, budgets, cashflow, runway. Income up; obligations down; optionality climbing.",
  },
  {
    key: "charisma",
    mark: "ENG.04 // CHARISMA",
    title: "Charisma",
    desc: "Voice, presence, social reps, network. The skill that scales every other one you've built.",
  },
];

const STEPS = [
  {
    title: "Set the protocol",
    desc: "Pick your archetype. Define your main tasks per engine. The system locks the day's score formula to match how you actually want to win.",
  },
  {
    title: "Run the day",
    desc: "Tick tasks as you finish them. The Titan Score updates in real time. Habit chains build. Streaks compound. Your dashboard tells you where you stand.",
  },
  {
    title: "Review &amp; advance",
    desc: "Daily letter grade. Weekly debrief. XP into the next rank. Identity-shaped feedback. Every loop nudges you toward the operator you said you wanted to be.",
  },
];

const RANKS = [
  { name: "INITIATE",   minLevel: 1 },
  { name: "OPERATOR",   minLevel: 2 },
  { name: "SPECIALIST", minLevel: 4 },
  { name: "VANGUARD",   minLevel: 8 },
  { name: "SENTINEL",   minLevel: 15 },
  { name: "TITAN",      minLevel: 31 },
];
