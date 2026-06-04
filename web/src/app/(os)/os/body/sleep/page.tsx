import * as React from "react";
import {
  useSleepLogs,
  useUpsertSleepLog,
  useDeleteSleepLog,
} from "@/hooks/queries/useSleep";
import { todayISO } from "@/lib/date";
import { MiniLineChart } from "@/components/ui/MiniCharts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function formatDateShort(dateKey: string): string {
  const [y, mo, d] = dateKey.split("-").map(Number);
  const date = new Date(y, mo - 1, d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function computeDuration(bedtime: string, wakeTime: string): number {
  const [bh, bm] = bedtime.split(":").map(Number);
  const [wh, wm] = wakeTime.split(":").map(Number);
  let bedMin = bh * 60 + bm;
  let wakeMin = wh * 60 + wm;
  if (wakeMin <= bedMin) wakeMin += 24 * 60;
  return wakeMin - bedMin;
}

const QUALITY_LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];
const QUALITY_COLORS = ["", "#ef4444", "#f97316", "#eab308", "#34d399", "#22d3ee"];

// ─── Component ───────────────────────────────────────────────────────────────

export default function SleepPage() {
  const today = React.useMemo(() => todayISO(), []);

  // ── Form state ────────────────────────────────────────────────────────────
  const [bedtime, setBedtime] = React.useState("23:00");
  const [wakeTime, setWakeTime] = React.useState("07:00");
  const [quality, setQuality] = React.useState<1 | 2 | 3 | 4 | 5>(3);
  const [notes, setNotes] = React.useState("");
  const [dateKey, setDateKey] = React.useState(today);

  // ── data hooks (local React Query) ───────────────────────────────────────────────────
  const { data: allEntries } = useSleepLogs();
  const entries = React.useMemo(
    () => [...(allEntries ?? [])].sort((a: any, b: any) => (b.date_key ?? "").localeCompare(a.date_key ?? "")).slice(0, 30),
    [allEntries],
  );
  const upsertSleep = useUpsertSleepLog();
  const deleteSleep = useDeleteSleepLog();

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = React.useMemo(() => {
    if (!entries || entries.length === 0) return null;
    const recent = entries.slice(0, 7);
    const avgDuration = Math.round(recent.reduce((s: number, e: any) => s + (e.duration_minutes ?? 0), 0) / recent.length);
    const avgQuality = Math.round(recent.reduce((s: number, e: any) => s + (e.quality ?? 0), 0) / recent.length * 10) / 10;
    return { avgDuration, avgQuality, totalEntries: recent.length, avgBedtime: "", avgWakeTime: "" };
  }, [entries]);

  // ── Chart data ────────────────────────────────────────────────────────────
  const chartData = React.useMemo(() => {
    if (!entries) return [];
    return [...entries]
      .reverse()
      .slice(-14)
      .map((e: any) => ({
        dateKey: formatDateShort(e.date_key),
        hours: Math.round(((e.duration_minutes ?? 0) / 60) * 10) / 10,
        quality: e.quality ?? 0,
      }));
  }, [entries]);

  // ── Auto-calculate duration ───────────────────────────────────────────────
  const duration = React.useMemo(
    () => computeDuration(bedtime, wakeTime),
    [bedtime, wakeTime],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleSave() {
    upsertSleep.mutate({
      date_key: dateKey,
      bedtime,
      wake_time: wakeTime,
      duration_minutes: duration,
      quality,
      notes: notes.trim(),
    } as any);
    setNotes("");
  }

  async function handleDelete(id: string) {
    deleteSleep.mutate(id);
  }

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      {/* Header */}
      <header>
        <p className="tp-kicker">Body Engine</p>
        <h1 className="tp-title">Sleep Tracker</h1>
        <p className="tp-subtitle mt-1">
          Track your sleep patterns and optimize recovery.
        </p>
      </header>

      {/* Stats cards */}
      {stats && stats.totalEntries > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="tp-panel p-4 text-center">
            <p className="tp-kicker">Avg Duration</p>
            <p className="tp-score-value mt-1 text-xl">
              {formatDuration(stats.avgDuration)}
            </p>
          </div>
          <div className="tp-panel p-4 text-center">
            <p className="tp-kicker">Avg Quality</p>
            <p className="tp-score-value mt-1 text-xl">
              {stats.avgQuality}
              <span className="text-sm text-white/40">/5</span>
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        {/* Log form */}
        <section className="tp-panel p-5">
          <p className="tp-kicker mb-4">Log Sleep</p>

          <div className="space-y-4">
            <div>
              <label className="body-label">Date</label>
              <input
                type="date"
                className="body-input"
                value={dateKey}
                onChange={(e) => setDateKey(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="body-label">Bedtime</label>
                <input
                  type="time"
                  className="body-input"
                  value={bedtime}
                  onChange={(e) => setBedtime(e.target.value)}
                />
              </div>
              <div>
                <label className="body-label">Wake Time</label>
                <input
                  type="time"
                  className="body-input"
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="body-label">
                Duration:{" "}
                <span className="text-[#34d399] font-semibold">
                  {formatDuration(duration)}
                </span>
              </label>
            </div>

            <div>
              <label className="body-label">Quality</label>
              <div className="flex gap-2 mt-1">
                {([1, 2, 3, 4, 5] as const).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuality(q)}
                    className="flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-all"
                    style={{
                      border:
                        quality === q
                          ? `1px solid ${QUALITY_COLORS[q]}80`
                          : "1px solid rgba(255,255,255,0.08)",
                      background:
                        quality === q
                          ? `${QUALITY_COLORS[q]}15`
                          : "rgba(255,255,255,0.03)",
                    }}
                  >
                    <span className="text-lg">{q}</span>
                    <span className="text-[9px] text-white/50">
                      {QUALITY_LABELS[q]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="body-label">Notes</label>
              <textarea
                className="body-input"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="How did you sleep?"
              />
            </div>

            <button
              type="button"
              onClick={handleSave}
              className="tp-button w-full"
            >
              Save Entry
            </button>
          </div>
        </section>

        {/* Chart */}
        <section className="tp-panel p-5">
          <p className="tp-kicker mb-4">Sleep Duration (last 14 days)</p>
          {chartData.length === 0 ? (
            <div className="body-empty">
              No sleep data yet. Log your first night to see trends.
            </div>
          ) : (
            <MiniLineChart
              data={chartData}
              dataKey="hours"
              xKey="dateKey"
              height={200}
              stroke="#5cc9a0"
              strokeWidth={2}
              showAxes
              showGrid
              showTooltip
              lines={[{ dataKey: "quality", stroke: "#60a5fa", strokeWidth: 1.5, strokeDasharray: "4 2" }]}
            />
          )}
        </section>
      </div>

      {/* History */}
      <section className="mt-6 tp-panel p-5">
        <p className="tp-kicker mb-4">Recent Entries</p>
        {!entries || entries.length === 0 ? (
          <div className="body-empty">No entries yet.</div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry: any) => (
              <div key={entry.id ?? entry.date_key} className="body-task-row">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm font-medium text-white/90">
                      {entry.date_key}
                    </p>
                    <p className="text-xs text-white/50">
                      {entry.bedtime} → {entry.wake_time} •{" "}
                      {formatDuration(entry.duration_minutes ?? 0)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: QUALITY_COLORS[entry.quality ?? 0] }}
                  >
                    {QUALITY_LABELS[entry.quality ?? 0]}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(entry.id)}
                    className="text-white/30 hover:text-red-400 transition-colors text-xs"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
