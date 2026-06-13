/**
 * Wraps `<Outlet />` (or any children). After auth lands, checks whether
 * this user has rows in the local SQLite cache. If not, runs a first-run
 * pull from Supabase before letting the children render — so a freshly
 * signed-in user on a new device sees their data on the first render
 * instead of an empty dashboard that fills in seconds later.
 *
 * Idempotent: a user who already has cache data passes through instantly.
 * The pull runs at most once per session per user.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { pullIfEmpty } from "../sync/first-run-pull";
import type { RestoreProgress } from "../sync/restore";

interface Props {
  userId: string;
  children: React.ReactNode;
}

export function FirstRunPullGate({ userId, children }: Props) {
  const [status, setStatus] = useState<
    "checking" | "syncing" | "error" | "ready"
  >("checking");
  const [progress, setProgress] = useState<RestoreProgress | null>(null);

  // Guard against double-fire in React StrictMode and against the same user
  // re-mounting the gate (e.g. parent re-render). It only blocks the
  // effect's auto-run; the Retry button calls runPull directly.
  const ranForRef = useRef<string | null>(null);

  const runPull = useCallback(async () => {
    setStatus("checking");
    setProgress(null);
    let ok = false;
    try {
      const res = await pullIfEmpty(userId, (p) => {
        setStatus("syncing");
        setProgress(p);
      });
      ok = res.ok;
    } catch {
      ok = false;
    }
    // On failure, show an error + Retry rather than rendering the app over an
    // empty cache: an unsurfaced first-run pull failure looks identical to
    // total data loss, and on a fresh device the cloud is the only copy.
    setStatus(ok ? "ready" : "error");
  }, [userId]);

  useEffect(() => {
    // ranForRef guards the userId so we only auto-run the pull once per user
    // — even under StrictMode's mount → unmount → remount cycle (the remount
    // returns early because ranForRef.current === userId from the first
    // mount). setState on an unmounted component is a no-op in React 19, so
    // an in-flight pull settling after a StrictMode unmount is harmless.
    if (ranForRef.current === userId) return;
    ranForRef.current = userId;
    void runPull();
  }, [userId, runPull]);

  if (status === "syncing") {
    return <PullSplash progress={progress} />;
  }
  if (status === "error") {
    return <PullError onRetry={() => void runPull()} />;
  }
  if (status === "checking") {
    // Quick check — usually < 50ms. Don't flash a splash for this.
    return null;
  }
  return <>{children}</>;
}

function PullSplash({ progress }: { progress: RestoreProgress | null }) {
  const tablesTotal = progress?.tablesTotal ?? 0;
  const tablesDone = progress?.tablesCompleted ?? 0;
  const pct = tablesTotal ? Math.floor((tablesDone / tablesTotal) * 100) : 0;
  const currentTable = progress?.currentTable ?? "…";
  const rows = progress?.rowsDownloaded ?? 0;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--bg0, #0a0a0a)",
        color: "var(--text, #e0e0e0)",
        fontFamily: "var(--font-mono, ui-monospace, monospace)",
        gap: 20,
        padding: 24,
      }}
    >
      <div
        style={{
          fontSize: 12,
          letterSpacing: 3,
          color: "var(--muted, #808080)",
        }}
      >
        SYNCING YOUR DATA
      </div>
      <div style={{ fontSize: 14, color: "var(--text, #e0e0e0)" }}>
        Restoring from cloud · {pct}%
      </div>
      <div
        style={{
          width: "min(320px, 80vw)",
          height: 4,
          background: "var(--chrome2, #1a1a1a)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "var(--accent, #4a9eff)",
            transition: "width 220ms ease-out",
          }}
        />
      </div>
      <div
        style={{
          fontSize: 11,
          letterSpacing: 1.5,
          color: "var(--muted, #808080)",
        }}
      >
        {currentTable} · {rows} rows
      </div>
    </div>
  );
}

function PullError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--bg0, #0a0a0a)",
        color: "var(--text, #e6e6e6)",
        fontFamily: "var(--font-mono, ui-monospace, monospace)",
        gap: 12,
        padding: 24,
      }}
    >
      <div style={{ fontSize: 12, letterSpacing: 2, color: "#ff6b6b" }}>
        SYNC FAILED
      </div>
      <div
        style={{
          fontSize: 13,
          maxWidth: 460,
          textAlign: "center",
          lineHeight: 1.5,
          color: "var(--muted, #808080)",
        }}
      >
        We could not load your data from the cloud. Check your connection and
        try again — your data is safe in the cloud.
      </div>
      <button
        type="button"
        onClick={onRetry}
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
