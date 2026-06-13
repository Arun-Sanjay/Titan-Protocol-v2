import { Navigate, Outlet } from "react-router-dom";
import { OSShell } from "../app/(os)/components/OSShell";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ThemeProvider } from "../components/ui/ThemeProvider";
import { DailyPlanningProvider } from "../app/(os)/components/DailyPlanningProvider";
import { FirstRunPullGate } from "../components/FirstRunPullGate";
import { BootGate } from "../components/BootGate";
import { StreakSettlementGate } from "../app/(os)/components/StreakSettlementGate";
import { RankUpWatcher } from "../app/(os)/components/RankUpWatcher";
import { CelebrationProvider } from "../components/ui/Celebration";
import { UpdateChecker } from "../components/UpdateChecker";
import { Toaster } from "../components/ui/Toaster";
import { ConfirmHost } from "../components/ui/ConfirmHost";
import { AccessGate } from "../components/ui/AccessGate";
import { useWebAuth } from "../lib/auth";

export function OSLayout() {
  const { user, loading } = useWebAuth();
  if (loading) return <AuthSplash />;
  if (!user) return <Navigate to="/auth/login" replace />;

  // BootGate runs the local-store migrations and gates ONLY the OS subtree
  // (not the global router) so a store-init failure — e.g. OPFS SAH-Pool's
  // single-tab lock when a second tab opens — shows its error here instead
  // of blanking the public marketing site. The global auth provider shares
  // the same migration run via `ensureMigrations`.
  return (
    <BootGate>
      <FirstRunPullGate userId={user.id}>
        <ThemeProvider>
          <DailyPlanningProvider>
            <CelebrationProvider>
              <StreakSettlementGate />
              <RankUpWatcher />
              <main className="osCanvas">
                <div className="osStage">
                  <OSShell>
                    <ErrorBoundary>
                      <Outlet />
                    </ErrorBoundary>
                  </OSShell>
                </div>
              </main>
              {/* Tauri-only auto-update banner — no-op in the browser build. */}
              <UpdateChecker />
              <Toaster />
              <ConfirmHost />
              <AccessGate />
            </CelebrationProvider>
          </DailyPlanningProvider>
        </ThemeProvider>
      </FirstRunPullGate>
    </BootGate>
  );
}

function AuthSplash() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--bg0, #0a0a0a)",
        color: "var(--muted, #808080)",
        fontFamily: "var(--font-mono, ui-monospace, monospace)",
        fontSize: 12,
        letterSpacing: 2,
      }}
    >
      CHECKING SESSION…
    </div>
  );
}
