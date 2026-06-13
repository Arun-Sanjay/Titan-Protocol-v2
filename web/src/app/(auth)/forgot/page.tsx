/**
 * Forgot-password — request a recovery link. Uses the PKCE flow: the
 * email link returns to `{origin}/?code=…#/auth/reset`; the boot-time
 * `detectSessionInUrl` exchange turns the code into a recovery session
 * before the reset page mounts and collects the new password.
 */
import * as React from "react";
import { Link } from "react-router-dom";
import { useWebAuth } from "@/lib/auth";
import { TitanButton, TitanPanel } from "@/components/ui/titan-primitives";

export default function ForgotPasswordPage() {
  const { resetPassword } = useWebAuth();
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await resetPassword(email.trim());
      if (err) {
        setError(err.message);
        return;
      }
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not send the reset email",
      );
    } finally {
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
            Reset password
          </h1>
          <p className="tx-muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
            {sent
              ? "Check your inbox."
              : "Enter your account email and we'll send a reset link."}
          </p>
        </header>

        {sent ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p
              style={{
                fontSize: 13,
                lineHeight: 1.6,
                color: "var(--text, #e6e6e6)",
                margin: 0,
              }}
            >
              If an account exists for{" "}
              <span style={{ fontWeight: 600 }}>{email.trim()}</span>, a
              password-reset link is on its way. Open it on this device to
              set a new password.
            </p>
            <p
              className="tx-muted"
              style={{ fontSize: 12, lineHeight: 1.5, margin: 0 }}
            >
              Didn't get it? Check spam, or retry in a few minutes — reset
              emails are rate-limited.
            </p>
            <Link
              to="/auth/login"
              style={{
                fontSize: 12,
                color: "var(--muted, #808080)",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <label
              style={{ display: "flex", flexDirection: "column", gap: 6 }}
            >
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
              {busy ? "…" : "Send reset link"}
            </TitanButton>

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
          </form>
        )}
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
