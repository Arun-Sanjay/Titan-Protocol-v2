import { Navigate, Outlet } from "react-router-dom";
import { OSShell } from "../app/(os)/components/OSShell";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ThemeProvider } from "../components/ui/ThemeProvider";
import { DailyPlanningProvider } from "../app/(os)/components/DailyPlanningProvider";
import { FirstRunPullGate } from "../components/FirstRunPullGate";
import { StreakSettlementGate } from "../app/(os)/components/StreakSettlementGate";
import { RankUpWatcher } from "../app/(os)/components/RankUpWatcher";
import { CelebrationProvider } from "../components/ui/Celebration";
import { UpdateChecker } from "../components/UpdateChecker";
import { useWebAuth } from "../lib/auth";

export function OSLayout() {
  const { user, loading } = useWebAuth();
  if (loading) return <AuthSplash />;
  if (!user) return <Navigate to="/auth/login" replace />;

  return (
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
          </CelebrationProvider>
        </DailyPlanningProvider>
      </ThemeProvider>
    </FirstRunPullGate>
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
