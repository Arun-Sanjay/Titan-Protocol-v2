/**
 * About / manifesto page. Short, sharp, no "founder story." The point is
 * to communicate the worldview behind the product to the right audience.
 */
import { Link } from "react-router-dom";

export default function AboutPage() {
  return (
    <>
      <section className="mk-page-hero">
        <p className="mk-section-kicker">About</p>
        <h1 className="mk-page-title">Most people drift. We don't.</h1>
        <p className="mk-page-lede">
          Titan Protocol exists because most "productivity" tools optimize
          for the wrong loop — capture more, organize harder, never actually
          ship the life you said you wanted. We built a different shape.
        </p>
      </section>

      <section className="mk-section" style={{ borderTop: "none", paddingTop: 0 }}>
        <div className="mk-prose">
          <h2>The premise</h2>
          <p>
            You don't get the life you want by trying harder this week.
            You get it by running the same daily protocol for a year. A few
            non-negotiable actions per domain — body, mind, money, charisma —
            performed every day, scored every day, audited every week.
          </p>
          <p>
            That's it. No tactic stack. No tool stack. No system to maintain.
            Just a loop you can't talk yourself out of.
          </p>

          <h2>Why scoring</h2>
          <p>
            Self-honesty is hard. The whole point of the Titan Score is to
            collapse "how am I doing?" into a single number you can't argue
            with. 87 today. 72 yesterday. A 5-day average of 81. The number
            shows you exactly where you're drifting before you've had a chance
            to rationalize it.
          </p>

          <h2>Why identity</h2>
          <p>
            We don't believe in "balanced." Balanced is what people who lack
            conviction call indecision. Pick an archetype — Athlete, Scholar,
            Hustler, Showman, Warrior, Founder, Charmer, Titan — and run the
            protocol as that operator. The system meets you where you are.
          </p>

          <h2>What we won't do</h2>
          <ul>
            <li>Sell your data. Train models on it. Ship dark-pattern nudges.</li>
            <li>Add ten more "AI" features that don't change your behavior.</li>
            <li>
              Lock you in. Deleting your account erases every byte, instantly
              — and a one-click export is on the roadmap.
            </li>
            <li>Ship features that make the score easier to fake.</li>
          </ul>

          <h2>The roadmap</h2>
          <p>
            We ship in phases — see{" "}
            <Link to="/changelog" style={{ color: "rgba(180,200,255,0.85)", textDecoration: "underline" }}>
              changelog
            </Link>
            . Web + desktop today. Native mobile next. Billing after that.
            We'd rather ship one phase well than four phases sloppily.
          </p>

          <h2>The honest part</h2>
          <p>
            We're early. Bugs happen. The mobile app is still being built.
            Pricing isn't finalized. But the core loop — the engines, the
            score, the ranks, the sync — that part works, today.
          </p>

          <p style={{ marginTop: 32 }}>
            <Link to="/auth/login?mode=signup" className="mk-btn mk-btn-primary">
              Start running it →
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
