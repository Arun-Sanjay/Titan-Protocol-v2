/**
 * Shared chrome for unauthenticated marketing pages — top nav + footer.
 * The auth state is read so the nav's right-side CTA flips between
 * "Sign in / Start free" and "Open the app" without forcing a sign-out.
 *
 * HashRouter constraint: marketing URLs look like `domain/#/`, `domain/#/pricing`.
 * Once we switch to BrowserRouter (or set up a Vercel rewrite for the
 * static landing), they'll be clean. For now, the routes work but the
 * `/#/` prefix is visible in the address bar.
 */
import { Link, Outlet } from "react-router-dom";
import { useWebAuth } from "../../lib/auth";
import "./marketing.css";

export function MarketingLayout() {
  return (
    <div className="mk-root">
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

  return (
    <header className="mk-nav">
      <div className="mk-nav-inner">
        <Link to="/" className="mk-brand" aria-label="Titan Protocol home">
          <span className="mk-brand-mark" aria-hidden="true">◆</span>
          <span className="mk-brand-text">TITAN PROTOCOL</span>
        </Link>

        <nav className="mk-nav-links" aria-label="Primary">
          <Link to="/features" className="mk-nav-link">Features</Link>
          <Link to="/pricing" className="mk-nav-link">Pricing</Link>
          <Link to="/changelog" className="mk-nav-link">Changelog</Link>
          <Link to="/about" className="mk-nav-link">About</Link>
        </nav>

        <div className="mk-nav-cta">
          {loading ? null : user ? (
            <Link to="/app" className="mk-btn mk-btn-primary">
              Open the app →
            </Link>
          ) : (
            <>
              <Link to="/auth/login" className="mk-nav-link">Sign in</Link>
              <Link to="/auth/login?mode=signup" className="mk-btn mk-btn-primary">
                Start free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function MarketingFooter() {
  return (
    <footer className="mk-footer">
      <div className="mk-footer-inner">
        <div className="mk-footer-brand">
          <span className="mk-brand-mark" aria-hidden="true">◆</span>
          <span className="mk-brand-text">TITAN PROTOCOL</span>
          <p className="mk-footer-tagline">
            Your personal OS for relentless execution.
          </p>
        </div>

        <div className="mk-footer-cols">
          <div className="mk-footer-col">
            <p className="mk-footer-h">Product</p>
            <Link to="/features" className="mk-footer-link">Features</Link>
            <Link to="/pricing" className="mk-footer-link">Pricing</Link>
            <Link to="/changelog" className="mk-footer-link">Changelog</Link>
          </div>

          <div className="mk-footer-col">
            <p className="mk-footer-h">Company</p>
            <Link to="/about" className="mk-footer-link">About</Link>
            <a
              href="mailto:hello@titanprotocol.app"
              className="mk-footer-link"
            >
              Contact
            </a>
          </div>

          <div className="mk-footer-col">
            <p className="mk-footer-h">Classic editions</p>
            <span className="mk-footer-link mk-footer-link-muted">
              Desktop (Tauri) · standalone
            </span>
            <span className="mk-footer-link mk-footer-link-muted">
              Android APK · standalone
            </span>
          </div>

          <div className="mk-footer-col">
            <p className="mk-footer-h">Account</p>
            <Link to="/auth/login" className="mk-footer-link">Sign in</Link>
            <Link to="/auth/login?mode=signup" className="mk-footer-link">
              Start free
            </Link>
          </div>
        </div>
      </div>

      <div className="mk-footer-strip">
        <span className="mk-footer-meta">
          © {new Date().getFullYear()} Titan Protocol
        </span>
        <span className="mk-footer-meta">
          v1.0 · System online ●
        </span>
      </div>
    </footer>
  );
}
