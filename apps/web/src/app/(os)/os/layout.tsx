import { OSShell } from "../components/OSShell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { DailyPlanningProvider } from "../components/DailyPlanningProvider";
import "../dashboard.css";
import "../premium-ui.css";

export default function OSRouteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ThemeProvider>
      <DailyPlanningProvider>
        <main className="osCanvas">
          <div className="osStage">
            <OSShell>
              <ErrorBoundary>{children}</ErrorBoundary>
            </OSShell>
          </div>
        </main>
      </DailyPlanningProvider>
    </ThemeProvider>
  );
}
