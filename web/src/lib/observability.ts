/**
 * Observability — Sentry (error tracking) + PostHog (product analytics).
 *
 * Both providers are optional and lazy:
 *   - Set VITE_SENTRY_DSN in web/.env  → @sentry/react init runs at startup
 *   - Set VITE_POSTHOG_KEY in web/.env → posthog-js init runs at startup
 *   - Without either, every function here is a no-op (plus a console line
 *     for errors). The empty-key bundle stays light because the provider
 *     packages are dynamic-imported only when keys exist.
 *
 * Wire-up checklist (when you're ready to turn observability on):
 *   1. `npm i @sentry/react` (and/or `npm i posthog-js`)
 *   2. Add the env var(s) in web/.env + the Vercel project's env settings
 *   3. Restart the dev server / redeploy — that's it. No code changes here.
 *
 * Usage:
 *   import { captureException, captureEvent, identifyUser, resetUser } from "@/lib/observability";
 *   captureException(err, { source: "backup.upsert", table: "tasks" });
 *   captureEvent("task.created", { engine: "body" });
 *   identifyUser({ id: user.id, email: user.email });
 *   resetUser();  // on sign-out
 */

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com";

// Adapters are stored as `any` so this file doesn't hard-depend on the
// provider packages' types. The adapter shape we lean on is small and
// stable across versions.
let sentryAdapter: SentryAdapter | null = null;
let posthogAdapter: PosthogAdapter | null = null;
let initStarted = false;

interface SentryAdapter {
  captureException: (err: unknown, context?: Record<string, unknown>) => void;
  setUser: (user: { id: string; email?: string } | null) => void;
}

interface PosthogAdapter {
  capture: (event: string, props?: Record<string, unknown>) => void;
  identify: (userId: string, traits?: Record<string, unknown>) => void;
  reset: () => void;
}

/** Call once at app startup. Idempotent — safe to call multiple times. */
export async function initObservability(): Promise<void> {
  if (initStarted) return;
  initStarted = true;

  if (SENTRY_DSN) {
    try {
      // Optional dependency: TypeScript can't resolve the type without the
      // package installed. We funnel through a variable so tsc treats it as
      // a dynamic specifier; Vite's `@vite-ignore` keeps the bundler from
      // trying to follow it at build time.
      const specifier: string = "@sentry/react";
      const Sentry = (await import(/* @vite-ignore */ specifier)) as {
        init: (opts: Record<string, unknown>) => void;
        captureException: (e: unknown, ctx?: unknown) => void;
        setUser: (u: unknown) => void;
      };
      Sentry.init({
        dsn: SENTRY_DSN,
        tracesSampleRate: 0.1,
        environment: import.meta.env.MODE,
      });
      sentryAdapter = {
        captureException: (err, ctx) =>
          Sentry.captureException(err, ctx ? { contexts: { extra: ctx } } : undefined),
        setUser: (user) => Sentry.setUser(user),
      };
    } catch (err) {
      console.warn(
        "[observability] VITE_SENTRY_DSN is set but @sentry/react isn't installed; run `npm i @sentry/react`",
        err,
      );
    }
  }

  if (POSTHOG_KEY) {
    try {
      const specifier: string = "posthog-js";
      const mod = (await import(/* @vite-ignore */ specifier)) as {
        default: {
          init: (key: string, opts: Record<string, unknown>) => void;
          capture: (e: string, p?: Record<string, unknown>) => void;
          identify: (id: string, t?: Record<string, unknown>) => void;
          reset: () => void;
        };
      };
      const posthog = mod.default;
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        capture_pageview: true,
        autocapture: false,
      });
      posthogAdapter = {
        capture: (event, props) => posthog.capture(event, props),
        identify: (userId, traits) => posthog.identify(userId, traits),
        reset: () => posthog.reset(),
      };
    } catch (err) {
      console.warn(
        "[observability] VITE_POSTHOG_KEY is set but posthog-js isn't installed; run `npm i posthog-js`",
        err,
      );
    }
  }
}

/** Capture an error. Routes to Sentry if configured; always logs to console. */
export function captureException(
  err: unknown,
  context?: Record<string, unknown>,
): void {
  if (context !== undefined) {
    console.error("[capture]", err, context);
  } else {
    console.error("[capture]", err);
  }
  sentryAdapter?.captureException(err, context);
}

/** Track a product-analytics event (no-op without PostHog key). */
export function captureEvent(
  name: string,
  props?: Record<string, unknown>,
): void {
  posthogAdapter?.capture(name, props);
}

/** Tag this session with the signed-in user. Call on sign-in. */
export function identifyUser(user: { id: string; email?: string }): void {
  sentryAdapter?.setUser(user);
  posthogAdapter?.identify(
    user.id,
    user.email ? { email: user.email } : undefined,
  );
}

/** Forget the user. Call on sign-out. */
export function resetUser(): void {
  sentryAdapter?.setUser(null);
  posthogAdapter?.reset();
}
