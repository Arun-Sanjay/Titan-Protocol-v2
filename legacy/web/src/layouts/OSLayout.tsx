import { Outlet } from "react-router-dom";
import { OSShell } from "../app/(os)/components/OSShell";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ThemeProvider } from "../components/ui/ThemeProvider";
import { DailyPlanningProvider } from "../app/(os)/components/DailyPlanningProvider";

export function OSLayout() {
  return (
    <ThemeProvider>
      <DailyPlanningProvider>
        <main className="osCanvas">
          <div className="osStage">
            <OSShell>
              <ErrorBoundary>
                <Outlet />
              </ErrorBoundary>
            </OSShell>
          </div>
        </main>
      </DailyPlanningProvider>
    </ThemeProvider>
  );
}
