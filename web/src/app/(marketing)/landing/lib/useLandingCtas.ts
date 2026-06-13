import { useWebAuth } from "../../../../lib/auth";

/**
 * Auth-aware CTA targets for the landing, mirroring MarketingLayout's logic:
 * logged-out visitors are sent to sign-up; logged-in users get "Open the app".
 * Labels omit the trailing arrow so callers can add `iconRight`.
 */
export function useLandingCtas() {
  const { user } = useWebAuth();
  return {
    primaryHref: user ? "/app" : "/auth/login?mode=signup",
    primaryLabel: user ? "Open the app" : "Start free",
    signInHref: "/auth/login",
  } as const;
}
