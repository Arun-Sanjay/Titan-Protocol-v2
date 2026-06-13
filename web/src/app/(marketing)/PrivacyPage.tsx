/**
 * Privacy policy. Plain-English, accurate to what the product actually
 * does. Bracketed [placeholders] must be filled in before charging money
 * (operator legal name + jurisdiction) — flagged in RELEASE_READINESS.
 */
import { Link } from "react-router-dom";

const LAST_UPDATED = "June 10, 2026";
const CONTACT_EMAIL = "titanprotocol.os@gmail.com";

export default function PrivacyPage() {
  return (
    <>
      <section className="mk-page-hero">
        <p className="mk-section-kicker">Legal</p>
        <h1 className="mk-page-title">Privacy Policy</h1>
        <p className="mk-page-lede">
          What we collect, why we collect it, where it lives, and how to get
          rid of it. Last updated {LAST_UPDATED}.
        </p>
      </section>

      <section className="mk-section" style={{ borderTop: "none", paddingTop: 0 }}>
        <div className="mk-prose">
          <h2>Who we are</h2>
          <p>
            Titan Protocol ("we", "us") is a personal operating system for
            discipline — tasks, habits, goals, focus sessions, journaling,
            body metrics, and money tracking, scored daily. It is operated
            by [operator legal name]. Questions about this policy:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>

          <h2>What we collect</h2>
          <ul>
            <li>
              <strong>Account data.</strong> Your email address and a
              password (stored only as a salted hash by our authentication
              provider). If you sign in with Google, we receive your email
              from Google — never your Google password.
            </li>
            <li>
              <strong>Your content.</strong> Everything you put into the
              product: tasks, completions, habits, goals, journal entries,
              focus sessions, and — if you use those trackers — body metrics
              (weight, sleep, nutrition, workouts) and money entries
              (transactions, budgets). This can include sensitive personal
              information; you choose what to enter.
            </li>
            <li>
              <strong>Gamification state.</strong> XP, levels, ranks,
              streaks, and achievement unlocks derived from your activity.
            </li>
            <li>
              <strong>Device push token.</strong> If you enable
              notifications in the mobile app, we store an Expo push token
              so our server can deliver them. Disabling notifications
              removes it.
            </li>
            <li>
              <strong>Diagnostics.</strong> If error reporting and product
              analytics are enabled in a build, crashes and usage events are
              sent to Sentry and PostHog, associated with your account id
              and email. We do not send your journal or tracker content to
              analytics.
            </li>
          </ul>

          <h2>How we use it</h2>
          <p>
            To run the product: storing your data, syncing it between your
            devices in real time, computing your scores, and (if enabled)
            sending you notifications. We also use diagnostics to find and
            fix bugs. That's the whole list.
          </p>

          <h2>What we never do</h2>
          <ul>
            <li>We don't sell your data, ever.</li>
            <li>We don't show ads or share data with ad networks.</li>
            <li>We don't train AI models on your content.</li>
          </ul>

          <h2>Where your data lives</h2>
          <p>
            Your data is stored with Supabase (our database and
            authentication provider) on AWS infrastructure in the
            ap-south-1 (Mumbai) region, encrypted in transit (TLS) and at
            rest, with row-level security so your account can only ever
            read its own rows. A local cache also lives on each device you
            sign in on; it is wiped on sign-out.
          </p>

          <h2>Processors we rely on</h2>
          <ul>
            <li>Supabase — database, authentication, realtime sync.</li>
            <li>Expo — push-notification delivery (mobile).</li>
            <li>Google — only if you choose "Sign in with Google".</li>
            <li>
              Sentry and PostHog — crash reporting and product analytics,
              where enabled.
            </li>
          </ul>

          <h2>Retention and deletion</h2>
          <p>
            We keep your data for as long as you keep your account. Deleting
            your account (Settings → Danger zone, on web or mobile)
            immediately and permanently erases your account and every piece
            of data attached to it from our systems. There is no recovery
            after deletion.
          </p>

          <h2>Your rights</h2>
          <p>
            You can access everything you've stored from inside the app,
            delete your account yourself at any time, and email us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> for a
            copy of your data or any other privacy request. We answer within
            30 days.
          </p>

          <h2>Children</h2>
          <p>
            Titan Protocol is not directed at children and is intended for
            users 16 and older. We don't knowingly collect data from anyone
            younger.
          </p>

          <h2>Changes</h2>
          <p>
            If this policy changes in a way that matters, we'll say so in
            the app and update the date at the top. Continued use after a
            change means you accept it.
          </p>

          <p style={{ marginTop: 32 }}>
            See also the{" "}
            <Link
              to="/terms"
              style={{
                color: "rgba(180,200,255,0.85)",
                textDecoration: "underline",
              }}
            >
              Terms of Service
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
