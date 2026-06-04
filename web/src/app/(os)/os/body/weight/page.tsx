import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { MiniLineChart } from "@/components/ui/MiniCharts";

import {
  useWeightLogs,
  useCreateWeightLog,
  useDeleteWeightLog,
} from "@/hooks/queries/useWeight";
import { todayISO } from "../../../../../lib/date";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateFull(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function WeightPage() {
  const { pathname } = useLocation();
  const today = React.useMemo(() => todayISO(), []);

  // Form state
  const [selectedDate, setSelectedDate] = React.useState(today);
  const [weightInput, setWeightInput] = React.useState("");

  // data hooks (local React Query)
  const { data: rawEntries } = useWeightLogs();
  const createWeight = useCreateWeightLog();
  const deleteWeight = useDeleteWeightLog();

  const allEntries = React.useMemo(() => {
    return [...(rawEntries ?? [])].sort((a: any, b: any) => (a.date_key ?? "").localeCompare(b.date_key ?? ""));
  }, [rawEntries]);

  const latestEntry = React.useMemo(() => {
    if (allEntries.length === 0) return null;
    return allEntries[allEntries.length - 1];
  }, [allEntries]);

  const entryForSelectedDate = React.useMemo(() => {
    return allEntries.find((e: any) => e.date_key === selectedDate) ?? null;
  }, [allEntries, selectedDate]);

  // Pre-fill weight input when entry exists for selected date
  React.useEffect(() => {
    if (entryForSelectedDate) {
      setWeightInput(String((entryForSelectedDate as any).weight_kg));
    } else {
      setWeightInput("");
    }
  }, [entryForSelectedDate]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  async function handleLogWeight() {
    const kg = parseFloat(weightInput);
    if (!Number.isFinite(kg) || kg <= 0) return;
    createWeight.mutate({ date_key: selectedDate, weight_kg: kg } as any);
    setWeightInput(String(kg));
  }

  async function handleDelete(id: string) {
    deleteWeight.mutate(id);
  }

  // ─── Derived data ────────────────────────────────────────────────────────

  const chartData = React.useMemo(
    () =>
      allEntries.map((entry: any) => ({
        dateKey: entry.date_key,
        weightKg: entry.weight_kg,
        label: formatDateLabel(entry.date_key),
      })),
    [allEntries],
  );

  const recentEntries = React.useMemo(() => {
    return [...allEntries].reverse().slice(0, 30);
  }, [allEntries]);

  function formatChange(value: number | null): React.ReactNode {
    if (value === null) return <span className="tp-muted">--</span>;
    const sign = value > 0 ? "+" : "";
    const color = value < 0 ? "#34d399" : value > 0 ? "#f87171" : "rgba(255,255,255,0.5)";
    return (
      <span style={{ color, fontWeight: 600 }}>
        {sign}
        {value.toFixed(1)} kg
      </span>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      {/* Header */}
      <header>
        <h1 className="tp-title text-3xl font-bold md:text-4xl">BODY ENGINE</h1>
        <p className="tp-subtitle mt-3 text-sm text-white/70">
          Weight Tracker
        </p>
      </header>

      {/* Tab Navigation */}
      <div className="mt-4 flex items-center justify-between">
        <div className="tp-tabs">
          <Link to="/app/body" className={`tp-tab ${pathname === "/app/body" ? "is-active" : ""}`}>
            Body Engine
          </Link>
          <Link to="/app/body/nutrition" className={`tp-tab ${pathname?.startsWith("/app/body/nutrition") ? "is-active" : ""}`}>
            Nutrition
          </Link>
          <Link to="/app/body/workouts" className={`tp-tab ${pathname?.startsWith("/app/body/workouts") ? "is-active" : ""}`}>
            Workouts
          </Link>
          <Link to="/app/body/weight" className={`tp-tab ${pathname?.startsWith("/app/body/weight") ? "is-active" : ""}`}>
            Weight
          </Link>
        </div>
      </div>

      {/* Weight Entry Form */}
      <section className="tp-panel mt-6 p-5 sm:p-6">
        <div className="tp-panel-head">
          <p className="tp-kicker">Log Weight</p>
          {entryForSelectedDate ? (
            <p className="tp-muted">
              Logged: {(entryForSelectedDate as any).weight_kg?.toFixed(1)} kg
            </p>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="body-label">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="body-input"
            />
          </div>
          <div>
            <label className="body-label">Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              placeholder="e.g. 75.5"
              className="body-input"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleLogWeight}
              className="tp-button mt-0 w-auto px-6"
              disabled={
                !weightInput ||
                !Number.isFinite(parseFloat(weightInput)) ||
                parseFloat(weightInput) <= 0
              }
            >
              Log Weight
            </button>
          </div>
        </div>
      </section>

      {/* Weight Graph */}
      <section className="tp-panel mt-6 p-5 sm:p-6">
        <p className="tp-kicker">Weight Trend</p>
        {chartData.length === 0 ? (
          <div className="body-empty mt-4">
            No weight entries yet. Log your first weight above.
          </div>
        ) : (
          <div className="mt-4">
            <MiniLineChart
              data={chartData}
              dataKey="weightKg"
              xKey="label"
              height={250}
              stroke="#5cc9a0"
              strokeWidth={2}
              showDots
              showAxes
              showGrid
              showTooltip
            />
          </div>
        )}
      </section>

      {/* Stats Panel */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <section className="tp-panel p-5">
          <p className="tp-kicker">Current Weight</p>
          {latestEntry ? (
            <>
              <p className="tp-score-value mt-2 text-2xl">
                {(latestEntry as any).weight_kg?.toFixed(1)}{" "}
                <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>
                  kg
                </span>
              </p>
              <p className="tp-muted mt-1">{formatDateFull((latestEntry as any).date_key)}</p>
            </>
          ) : (
            <p className="tp-muted mt-2">No entries</p>
          )}
        </section>
      </div>

      {/* Weight History Table */}
      <section className="tp-panel mt-6 p-5 sm:p-6">
        <div className="tp-panel-head">
          <p className="tp-kicker">Weight History</p>
          <p className="tp-muted">Last 30 entries</p>
        </div>

        {recentEntries.length === 0 ? (
          <div className="body-empty mt-4">No entries logged yet.</div>
        ) : (
          <div className="mt-4 space-y-2">
            {recentEntries.map((entry: any) => (
              <div key={entry.id ?? entry.date_key} className="body-task-row">
                <div className="flex items-center gap-4">
                  <span
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.6)",
                      minWidth: 100,
                    }}
                  >
                    {formatDateFull(entry.date_key)}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.9)",
                    }}
                  >
                    {entry.weight_kg?.toFixed(1)} kg
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(entry.id)}
                  className="tp-button tp-button-inline"
                  style={{ color: "#f87171" }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
