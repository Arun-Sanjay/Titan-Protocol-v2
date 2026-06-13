/**
 * Terms of service. Plain-English, accurate to the product's beta state.
 * Bracketed [placeholders] must be filled in before charging money
 * (operator legal name + governing law) — flagged in RELEASE_READINESS.
 */
import { Link } from "react-router-dom";

const LAST_UPDATED = "June 10, 2026";
const CONTACT_EMAIL = "titanprotocol.os@gmail.com";

export default function TermsPage() {
  return (
    <>
      <section className="mk-page-hero">
        <p className="mk-section-kicker">Legal</p>
        <h1 className="mk-page-title">Terms of Service</h1>
        <p className="mk-page-lede">
          The deal between you and Titan Protocol, in plain English. Last
          updated {LAST_UPDATED}.
        </p>
      </section>

      <section className="mk-section" style={{ borderTop: "none", paddingTop: 0 }}>
        <div className="mk-prose">
          <h2>1. The agreement</h2>
          <p>
            By creating an account or using Titan Protocol (the web app,
            desktop app, or mobile app — together, "the service"), you agree
            to these terms and to the{" "}
            <Link
              to="/privacy"
              style={{
                color: "rgba(180,200,255,0.85)",
                textDecoration: "underline",
              }}
            >
              Privacy Policy
            </Link>
            . The service is operated by [operator legal name] ("we",
            "us").
          </p>

          <h2>2. The service</h2>
          <p>
            Titan Protocol is a personal tracking and gamification tool:
            tasks, habits, goals, focus sessions, journaling, body metrics,
            money tracking, and a daily score with XP, ranks, and streaks,
            synced across your devices. It is currently in <strong>beta</strong>:
            features change, and despite real care for data integrity we
            can't promise zero bugs. Keep that in mind for anything
            irreplaceable.
          </p>

          <h2>3. Your account</h2>
          <ul>
            <li>You must be 16 or older.</li>
            <li>
              You're responsible for your credentials and everything done
              under your account. One account per person.
            </li>
            <li>
              You can delete your account at any time in Settings → Danger
              zone; deletion is immediate and permanent.
            </li>
          </ul>

          <h2>4. Your content</h2>
          <p>
            Everything you enter stays yours. You grant us only the limited
            license needed to operate the service — storing your data,
            syncing it between your devices, and computing your scores. We
            claim no other rights to it.
          </p>

          <h2>5. Acceptable use</h2>
          <p>
            Don't abuse the service: no attempts to access other users'
            data, probe or overload the infrastructure, reverse-engineer the
            sync protocol to tamper with other accounts, or use the service
            for anything unlawful. We may suspend or terminate accounts that
            do.
          </p>

          <h2>6. Not medical or financial advice</h2>
          <p>
            The body trackers (weight, sleep, nutrition, workouts) and the
            money trackers are journaling tools, not professional advice.
            Scores, streaks, and any numbers the service computes are
            motivational mechanics — not medical, health, dietary, or
            financial guidance. Talk to a professional for those.
          </p>

          <h2>7. Pricing</h2>
          <p>
            The service is free during beta. Paid plans are planned; when
            they arrive, pricing will be shown clearly before you're charged
            and these terms will be updated. We won't silently convert a
            free account into a paying one.
          </p>

          <h2>8. Availability and warranty</h2>
          <p>
            The service is provided "as is" and "as available", without
            warranties of any kind, express or implied. We work hard on
            reliability and sync correctness, but we don't guarantee
            uninterrupted service or that every defect will be fixed.
          </p>

          <h2>9. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, we are not liable for
            indirect, incidental, or consequential damages, or for loss of
            data, profits, or goodwill. Our total liability for any claim is
            capped at the greater of the amount you paid us in the twelve
            months before the claim, or USD $10.
          </p>

          <h2>10. Termination</h2>
          <p>
            You can stop using the service or delete your account at any
            time. We may suspend or terminate accounts that violate these
            terms, with notice where practical. Sections 4, 8, 9, and 11
            survive termination.
          </p>

          <h2>11. Governing law</h2>
          <p>
            These terms are governed by the laws of [jurisdiction], and
            disputes belong to the courts of [jurisdiction].
          </p>

          <h2>12. Changes</h2>
          <p>
            We may update these terms; material changes will be announced in
            the app, and the date at the top always reflects the current
            version. Continued use after a change means you accept it.
          </p>

          <h2>13. Contact</h2>
          <p>
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </div>
      </section>
    </>
  );
}
