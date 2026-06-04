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
import { useEffect, useRef, useState } from "react";
import { pullIfEmpty } from "../sync/first-run-pull";
import type { RestoreProgress } from "../sync/restore";

interface Props {
  userId: string;
  children: React.ReactNode;
}

export function FirstRunPullGate({ userId, children }: Props) {
  const [status, setStatus] = useState<"checking" | "syncing" | "ready">(
    "checking",
  );
  const [progress, setProgress] = useState<RestoreProgress | null>(null);

  // Guard against double-fire in React 18 StrictMode and against the same
  // user re-mounting the gate (e.g. parent re-render).
  const ranForRef = useRef<string | null>(null);

  useEffect(() => {
    // ranForRef guards the userId so we only kick off pullIfEmpty once per
    // user — even under React.StrictMode's mount → unmount → remount cycle.
    // The remount returns early here because ranForRef.current === userId
    // from the first mount, so we don't fire a second concurrent pull.
    //
    // Note: we DO NOT use a `cancelled` flag to gate the final setStatus.
    // StrictMode would set cancelled=true on the cleanup between the two
    // mounts; the first mount's async then completes with cancelled=true
    // and skips setStatus, leaving the gate stuck in "checking" forever
    // (rendering null → blank screen). React 19 treats setState on an
    // unmounted component as a no-op, so the unconditional setStatus is
    // safe and prevents that hang.
    if (ranForRef.current === userId) return;
    ranForRef.current = userId;

    void (async () => {
      try {
        await pullIfEmpty(userId, (p) => {
          setStatus("syncing");
          setProgress(p);
        });
      } catch {
        // fall through — the setStatus below still fires so the gate
        // doesn't stay stuck on "checking".
      }
      setStatus("ready");
    })();
  }, [userId]);

  if (status === "syncing") {
    return <PullSplash progress={progress} />;
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
