/**
 * Set a new password. Reached from the recovery email link: the PKCE
 * `?code=` is exchanged into a recovery session at boot
 * (`detectSessionInUrl`), so by the time this page settles the user is
 * signed in and `updateUser({ password })` is allowed. Without a session
 * the link was invalid/expired — offer to request a new one.
 */
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWebAuth } from "@/lib/auth";
import { TitanButton, TitanPanel } from "@/components/ui/titan-primitives";

export default function ResetPasswordPage() {
  const { user, loading, updatePassword } = useWebAuth();
  const navigate = useNavigate();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await updatePassword(password);
      if (err) {
        setError(err.message);
        return;
      }
      setDone(true);
      window.setTimeout(() => navigate("/app", { replace: true }), 1200);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update the password",
      );
    } finally {
      setBusy(false);
    }
  }

  // Recovery-code exchange may still be in flight on first paint.
  if (loading) {
    return (
      <main style={splashStyle}>VERIFYING LINK…</main>
    );
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
            {user ? "Set a new password" : "Link expired"}
          </h1>
        </header>

        {!user ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p
              className="tx-muted"
              style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}
            >
              This reset link is invalid or has expired. Request a fresh one
              and open it on this device.
            </p>
            <Link to="/auth/forgot" style={{ textDecoration: "none" }}>
              <TitanButton type="button" style={{ width: "100%" }}>
                Request a new link
              </TitanButton>
            </Link>
            <Link
              to="/auth/login"
              style={{
                fontSize: 12,
                color: "var(--muted, #808080)",
                textDecoration: "underline",
                textUnderlineOffset: 3,
                alignSelf: "center",
              }}
            >
              Back to sign in
            </Link>
          </div>
        ) : done ? (
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--status-success, #34d399)",
              margin: 0,
            }}
          >
            Password updated — taking you to your protocol…
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <label
              style={{ display: "flex", flexDirection: "column", gap: 6 }}
            >
              <span style={labelStyle}>New password</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
              />
            </label>
            <label
              style={{ display: "flex", flexDirection: "column", gap: 6 }}
            >
              <span style={labelStyle}>Repeat new password</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                style={inputStyle}
              />
            </label>

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

            <TitanButton type="submit" disabled={busy} style={{ width: "100%" }}>
              {busy ? "…" : "Update password"}
            </TitanButton>
          </form>
        )}
      </TitanPanel>
    </main>
  );
}

const splashStyle: React.CSSProperties = {
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
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 1.5,
  color: "var(--muted, #808080)",
  textTransform: "uppercase",
};

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
