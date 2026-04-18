import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "../stores/useAuthStore";
import { hasSeeded, initialSeed, type SeedProgress } from "../sync/seed";
import { SyncingScreen, SyncingScreenError } from "./SyncingScreen";
import { logError } from "../lib/error-log";

type State =
  | { phase: "checking" }
  | { phase: "seeding"; progress: SeedProgress }
  | { phase: "seeded" }
  | { phase: "error"; error: string; errorTable?: string };

/**
 * First-install / cross-device seed gate. Sits between auth and the
 * rest of the authenticated app tree. On mount it checks if any sync
 * has ever completed on this device (via `sync_meta.table_name`
 * presence). If not, it runs `initialSeed()` which pulls every table
 * from Supabase in dependency order; meanwhile the app shows a
 * blocking SyncingScreen with per-table progress.
 *
 * Once seeded, the gate is a pass-through for the rest of the session
 * — the sync engine's background pulls handle incremental updates
 * from that point.
 *
 * Fresh sign-ups: the seed pulls 0 rows but still marks sync_meta so
 * subsequent launches skip the gate immediately.
 */
export function SeedGate({ children }: { children: React.ReactNode }) {
  const userId = useAuthStore((s) => s.user?.id);
  const [state, setState] = useState<State>({ phase: "checking" });
  // Tracks which userId we've seeded for. When the user changes (sign
  // out / sign in to a different account), re-check — we don't want to
  // show user A's data to user B while pulls catch up.
  const seededFor = useRef<string | null>(null);

  const runSeed = useCallback(async () => {
    setState({
      phase: "seeding",
      progress: {
        currentTable: null,
        tablesCompleted: 0,
        tablesTotal: 0,
        totalRowsPulled: 0,
      },
    });
    const res = await initialSeed((p) => {
      setState((prev) =>
        prev.phase === "seeding" ? { phase: "seeding", progress: p } : prev,
      );
    });
    if (res.success) {
      setState({ phase: "seeded" });
      seededFor.current = userId ?? null;
    } else {
      setState({
        phase: "error",
        error: res.error,
        errorTable: res.errorTable,
      });
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setState({ phase: "checking" });
      seededFor.current = null;
      return;
    }

    // Already confirmed seeded for this user — pass through.
    if (seededFor.current === userId) {
      setState({ phase: "seeded" });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        if (await hasSeeded()) {
          if (cancelled) return;
          seededFor.current = userId;
          setState({ phase: "seeded" });
          return;
        }
        await runSeed();
      } catch (e) {
        if (cancelled) return;
        logError("seedGate.unexpected", e);
        setState({
          phase: "error",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, runSeed]);

  if (state.phase === "checking") return null; // show splash

  if (state.phase === "seeding") {
    return <SyncingScreen progress={state.progress} />;
  }

  if (state.phase === "error") {
    return (
      <SyncingScreenError
        error={state.error}
        errorTable={state.errorTable}
        onRetry={runSeed}
      />
    );
  }

  return <>{children}</>;
}
