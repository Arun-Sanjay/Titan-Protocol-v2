/**
 * Login + signup screen. Tabs between the two modes; email + password
 * first, Google OAuth second. No external chrome — the whole screen is
 * this component.
 */
import * as React from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useWebAuth } from "@/lib/auth";
import { TitanButton, TitanPanel } from "@/components/ui/titan-primitives";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, signIn, signUp, signInWithGoogle } = useWebAuth();
  const [searchParams] = useSearchParams();

  // ?mode=signup deep-links from the marketing site's "Start free" CTAs.
  const initialMode: Mode =
    searchParams.get("mode") === "signup" ? "signup" : "signin";
  const [mode, setMode] = React.useState<Mode>(initialMode);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  // If a session already exists (e.g. the user navigated back here
  // after signing in), bounce them home.
  if (user) {
    return <Navigate to="/app" replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const trimmedEmail = email.trim();
      if (mode === "signin") {
        const { error: err } = await signIn(trimmedEmail, password);
        if (err) {
          setError(err.message);
          return;
        }
        navigate("/app", { replace: true });
      } else {
        const { data, error: err } = await signUp(trimmedEmail, password);
        if (err) {
          setError(err.message);
          return;
        }
        if (data.session) {
          navigate("/app", { replace: true });
          return;
        }
        // signUp returned no session (the project keeps "confirm email" on).
        // New accounts are auto-confirmed server-side, so sign in right away
        // for a frictionless create → in-app flow — no inbox round-trip.
        const { data: signInData, error: signInErr } = await signIn(
          trimmedEmail,
          password,
        );
        if (signInData?.session) {
          navigate("/app", { replace: true });
          return;
        }
        // Fallback: account exists but immediate sign-in didn't take. Surface
        // a clear message instead of a dead end.
        setError(
          signInErr?.message ??
            "Account created, but automatic sign-in failed — try signing in.",
        );
        setMode("signin");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await signInWithGoogle();
      if (err) {
        setError(err.message);
        setBusy(false);
      }
      // Success path: browser is being redirected to Google. No reset
      // needed — we won't be on this page much longer.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        backgroundColor: "var(--bg0, #0a0a0a)",
      }}
    >
      <TitanPanel
        tone="hero"
        style={{
          width: "100%",
          maxWidth: 440,
          padding: 32,
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p className="tx-kicker">Titan Protocol</p>
          <h1
            className="tx-title tx-display"
            style={{ fontSize: 28, lineHeight: 1.1 }}
          >
            {mode === "signin" ? "Sign in" : "Create account"}
          </h1>
          <p className="tx-muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
            {mode === "signin"
              ? "Sign in to restore your protocol from cloud, or start a new device."
              : "One account holds the cloud backups for every device you use."}
          </p>
        </header>

        {/* Mode toggle */}
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: 4,
            border: "1px solid var(--stroke, #2a2a2a)",
            borderRadius: 8,
          }}
        >
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
                setInfo(null);
              }}
              style={{
                flex: 1,
                padding: "8px 12px",
                fontSize: 12,
                letterSpacing: 1.5,
                fontWeight: 600,
                textTransform: "uppercase",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                background:
                  mode === m
                    ? "var(--panel, rgba(255,255,255,0.08))"
                    : "transparent",
                color:
                  mode === m
                    ? "var(--text, #e6e6e6)"
                    : "var(--muted, #808080)",
                transition: "background 120ms, color 120ms",
              }}
            >
              {m === "signin" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span
              style={{
                fontSize: 11,
                letterSpacing: 1.5,
                color: "var(--muted, #808080)",
                textTransform: "uppercase",
              }}
            >
              Email
            </span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span
              style={{
                fontSize: 11,
                letterSpacing: 1.5,
                color: "var(--muted, #808080)",
                textTransform: "uppercase",
              }}
            >
              Password
            </span>
            <input
              type="password"
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              required
              minLength={mode === "signup" ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
          </label>

          {mode === "signin" && (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: -8,
              }}
            >
              <button
                type="button"
                onClick={() => navigate("/auth/forgot")}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  fontSize: 12,
                  color: "var(--muted, #808080)",
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
              >
                Forgot password?
              </button>
            </div>
          )}

          {error && (
            <p
              role="alert"
              style={{
                fontSize: 12,
                color: "#ff6b6b",
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              {error}
            </p>
          )}
          {info && (
            <p
              style={{
                fontSize: 12,
                color: "var(--status-success, #34d399)",
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              {info}
            </p>
          )}

          <TitanButton
            type="submit"
            disabled={busy}
            style={{ width: "100%" }}
          >
            {busy
              ? "…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </TitanButton>
        </form>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            color: "var(--muted, #808080)",
            fontSize: 11,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          <span
            style={{ flex: 1, height: 1, background: "var(--stroke, #2a2a2a)" }}
          />
          or
          <span
            style={{ flex: 1, height: 1, background: "var(--stroke, #2a2a2a)" }}
          />
        </div>

        <TitanButton
          type="button"
          tone="ghost"
          disabled={busy}
          onClick={handleGoogle}
          style={{ width: "100%" }}
        >
          Continue with Google
        </TitanButton>
      </TitanPanel>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "inherit",
  color: "var(--text, #e6e6e6)",
  background: "var(--bg0, #0a0a0a)",
  border: "1px solid var(--stroke, #2a2a2a)",
  borderRadius: 6,
  outline: "none",
};
