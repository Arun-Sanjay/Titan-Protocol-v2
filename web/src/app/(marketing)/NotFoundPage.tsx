/**
 * Branded 404 page. Wraps in MarketingLayout so the visitor sees the same
 * top nav + footer they'd see anywhere else on the marketing site, with a
 * clear way home or into the app.
 */
import { Link } from "react-router-dom";
import { useWebAuth } from "../../lib/auth";

export default function NotFoundPage() {
  const { user } = useWebAuth();
  return (
    <div className="mk-404">
      <p className="mk-404-line">SIGNAL.LOST · 404</p>
      <p className="mk-404-code">404</p>
      <p className="mk-404-body">
        This route doesn't exist. Either the link is stale, or you typed
        something the system doesn't recognize. The protocol carries on.
      </p>
      <div className="mk-hero-ctas" style={{ marginTop: 12 }}>
        <Link to="/" className="mk-btn mk-btn-primary">Back to home</Link>
        {user ? (
          <Link to="/app" className="mk-btn mk-btn-ghost">Open the app</Link>
        ) : (
          <Link to="/auth/login" className="mk-btn mk-btn-ghost">Sign in</Link>
        )}
      </div>
    </div>
  );
}
