/**
 * Features overview. Deeper-dive than the landing page's section blocks —
 * for the visitor who wants the whole system before signing up.
 */
import { Link } from "react-router-dom";
import { useWebAuth } from "../../lib/auth";

export default function FeaturesPage() {
  const { user } = useWebAuth();
  const ctaHref = user ? "/app" : "/auth/login?mode=signup";
  const ctaLabel = user ? "Open the app →" : "Start free →";

  return (
    <>
      <section className="mk-page-hero">
        <p className="mk-section-kicker">Features</p>
        <h1 className="mk-page-title">A complete operating system for the self.</h1>
        <p className="mk-page-lede">
          Titan Protocol isn't a todo app with extra steps. It's an
          identity-driven daily protocol with engines, scoring, ranks, habits,
          skill trees, deep work tracking, focus timers, and a daily debrief —
          all wired into one number you can't fake.
        </p>
      </section>

      <section className="mk-section" style={{ borderTop: "none", paddingTop: 0 }}>
        <div className="mk-grid-3">
          {GROUPS.map((g) => (
            <article key={g.title} className="mk-card" style={{ padding: 28 }}>
              <p className="mk-card-mark">{g.mark}</p>
              <h2 className="mk-card-title">{g.title}</h2>
              <ul style={{ margin: "12px 0 0", padding: 0, listStyle: "none" }}>
                {g.items.map((it) => (
                  <li
                    key={it}
                    style={{
                      padding: "10px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: "rgba(232,234,237,0.72)",
                      fontFamily: "ui-sans-serif, system-ui, sans-serif",
                    }}
                  >
                    {it}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="mk-section">
        <p className="mk-section-kicker">Under the hood</p>
        <h2 className="mk-section-title">Boring tech, on purpose.</h2>
        <p className="mk-section-lede">
          Local-first cache means reads are sub-millisecond. Supabase as the
          source of truth means your data is durable and cross-device sync
          just works. Realtime subscriptions mean changes propagate in
          seconds — not on a refresh, not on a poll.
        </p>

        <div className="mk-grid-3">
          {TECH.map((t) => (
            <article key={t.title} className="mk-step">
              <p className="mk-step-num">{t.icon}</p>
              <h3 className="mk-card-title" style={{ fontSize: 18 }}>{t.title}</h3>
              <p className="mk-card-text">{t.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mk-section" style={{ textAlign: "center", borderTop: "none" }}>
        <h2 className="mk-section-title" style={{ marginBottom: 24 }}>
          Ready to run it?
        </h2>
        <Link to={ctaHref} className="mk-btn mk-btn-primary">
          {ctaLabel}
        </Link>
      </section>
    </>
  );
}

const GROUPS = [
  {
    mark: "GROUP.01",
    title: "Daily protocol",
    items: [
      "Morning + evening protocol sessions",
      "Daily Titan Score (0–100) with archetype weighting",
      "Letter grade — D / C / B / A / S / SS",
      "XP rewards per task, habit, journal entry",
      "Streak tracking + warnings before they break",
      "Audio voice-lines for protocol prompts",
    ],
  },
  {
    mark: "GROUP.02",
    title: "Four engines",
    items: [
      "Body — workouts, sleep, weight, nutrition, water",
      "Mind — reading, learning, drills, focus, journal",
      "Money — deep work, budgets, transactions, loans",
      "Charisma — social ops, recordings, presence drills",
      "Per-engine scoring + monthly heatmaps",
      "Calendar view, week comparisons, analytics",
    ],
  },
  {
    mark: "GROUP.03",
    title: "Habits + tasks",
    items: [
      "Main vs side tasks · weighted scoring",
      "Habit chains with streak protection",
      "Days-per-week scheduling",
      "Skill trees — branching unlocks per engine",
      "Quests + boss challenges",
      "Field operations (one-off long-form efforts)",
    ],
  },
  {
    mark: "GROUP.04",
    title: "Identity",
    items: [
      "Archetype quiz → engine weights",
      "8 archetypes: Titan, Athlete, Scholar, Hustler, Showman, Warrior, Founder, Charmer",
      "Title progression unlocked by rank",
      "Narrative log: 18 day cinematics + milestones",
      "Personalized daily briefings",
    ],
  },
  {
    mark: "GROUP.05",
    title: "Focus + deep work",
    items: [
      "Pomodoro-style focus timer",
      "Deep work session logging (project-scoped)",
      "Per-session minutes → engine score",
      "Distraction tracking",
      "Quiet hours / Do not disturb",
    ],
  },
  {
    mark: "GROUP.06",
    title: "Cross-device sync",
    items: [
      "Web, desktop (Tauri), mobile (Expo) — one account",
      "Supabase as source of truth · RLS-isolated",
      "Local SQLite cache for instant reads",
      "Realtime channel for live cross-device updates",
      "Atomic restore on fresh device sign-in",
      "Wipe on sign-out — no leak between accounts",
    ],
  },
];

const TECH = [
  { icon: "⚙", title: "Hybrid data layer",  desc: "Cloud as source of truth; SQLite as a 1ms read cache. Best of both worlds — fast UX, real sync." },
  { icon: "⌁", title: "Realtime updates",   desc: "Supabase Realtime + postgres_changes on every synced table. Edit one device, see it elsewhere in ~2s." },
  { icon: "▣", title: "Local-first reads",  desc: "Reads never touch the network. Open the app, see your data instantly even on a slow connection." },
];
