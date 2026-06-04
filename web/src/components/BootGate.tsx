/**
 * Boot gate. Runs pending SQLite migrations before the app mounts, so
 * every downstream hook/service can assume the schema is ready.
 *
 * Shows a minimal splash while migrations are running (usually <50ms on
 * desktop, <200ms on browser OPFS). On failure, shows the error instead
 * of rendering the app — the user can retry by reloading.
 */

import { useEffect, useState } from "react";
import { runMigrations } from "../db/sqlite/migrator";

type Phase =
  | { kind: "loading" }
  | { kind: "ready"; applied: string[]; skipped: string[] }
  | { kind: "error"; message: string };

export function BootGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await runMigrations();
        if (cancelled) return;
        setPhase({ kind: "ready", ...result });
      } catch (err) {
        if (cancelled) return;
        console.error("[BootGate] migration failed", err);
        setPhase({ kind: "error", message: formatError(err) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (phase.kind === "loading") return <BootSplash />;
  if (phase.kind === "error") return <BootError message={phase.message} />;
  return <>{children}</>;
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    // sqlite-wasm worker error envelope: { result: { message, operation } }
    const r = obj.result as Record<string, unknown> | undefined;
    if (r && typeof r.message === "string") return r.message;
    if (typeof obj.message === "string") return obj.message;
    try {
      return JSON.stringify(err);
    } catch {
      return "[unserializable error]";
    }
  }
  return String(err ?? "unknown");
}

function BootSplash() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        backgroundColor: "var(--bg0, #0a0a0a)",
        color: "var(--muted, #808080)",
        fontFamily: "var(--font-mono, ui-monospace, monospace)",
        fontSize: 12,
        letterSpacing: 2,
      }}
    >
      INITIALIZING LOCAL STORE…
    </div>
  );
}

function BootError({ message }: { message: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: 24,
        backgroundColor: "var(--bg0, #0a0a0a)",
        color: "var(--text, #e6e6e6)",
        fontFamily: "var(--font-mono, ui-monospace, monospace)",
        gap: 12,
      }}
    >
      <div style={{ fontSize: 12, letterSpacing: 2, color: "#ff6b6b" }}>
        STORAGE INIT FAILED
      </div>
      <div style={{ fontSize: 13, maxWidth: 480, textAlign: "center", lineHeight: 1.5 }}>
        {message}
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          marginTop: 16,
          padding: "8px 20px",
          background: "transparent",
          color: "var(--text, #e6e6e6)",
          border: "1px solid var(--stroke, #333)",
          cursor: "pointer",
          fontSize: 11,
          letterSpacing: 2,
          fontFamily: "inherit",
        }}
      >
        RETRY
      </button>
    </div>
  );
}
