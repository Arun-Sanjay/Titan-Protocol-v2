/**
 * OAuth callback. Supabase client is initialized with
 * `detectSessionInUrl: true`, so the session is picked up automatically
 * from the URL on load. This page just waits for the auth state to
 * resolve, then routes the user into the app.
 */
import * as React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useWebAuth } from "@/lib/auth";

export default function CallbackPage() {
  const { user, loading } = useWebAuth();
  const navigate = useNavigate();
  const [timedOut, setTimedOut] = React.useState(false);

  React.useEffect(() => {
    if (!loading && user) {
      navigate("/app", { replace: true });
    }
  }, [loading, user, navigate]);

  React.useEffect(() => {
    // If Supabase can't recover a session within 5s, something went
    // wrong (bad redirect URL, expired code, user cancelled). Bounce
    // back to the login screen with a visible message rather than
    // leaving them spinning forever.
    const t = window.setTimeout(() => setTimedOut(true), 5000);
    return () => window.clearTimeout(t);
  }, []);

  if (timedOut && !user) {
    return <Navigate to="/auth/login" replace />;
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundColor: "var(--bg0, #0a0a0a)",
        color: "var(--muted, #808080)",
        fontFamily: "var(--font-mono, ui-monospace, monospace)",
        fontSize: 12,
        letterSpacing: 2,
      }}
    >
      COMPLETING SIGN-IN…
    </main>
  );
}
