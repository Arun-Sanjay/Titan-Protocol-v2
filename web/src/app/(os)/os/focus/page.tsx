import * as React from "react";
import {
  useFocusSessions,
  useFocusSettings,
  useUpsertFocusSettings,
  useRecordFocusSession,
} from "@/hooks/queries/useFocus";
import { todayISO } from "../../../../lib/date";

// ---------- helpers ----------

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(Math.max(0, totalSeconds) / 60);
  const s = Math.max(0, totalSeconds) % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

function playBeep() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine"; osc.frequency.value = 880; gain.gain.value = 0.05;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.15);
    osc.onended = () => ctx.close();
  } catch (err) { console.warn("Focus beep failed", err); }
}

const RING_SIZE = 200;
const RING_STROKE = 8;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

type TimerPhase = "focus" | "break" | "long";
type TimerStatus = "idle" | "running" | "paused";

const PHASE_COLORS: Record<TimerPhase, string> = { focus: "#34d399", break: "#60a5fa", long: "#a78bfa" };

export default function FocusPage() {
  const todayKey = React.useMemo(() => todayISO(), []);

  // data hooks (local React Query)
  const { data: settingsData } = useFocusSettings();
  const { data: allSessions } = useFocusSessions();
  const updateSettings = useUpsertFocusSettings();
  const recordSession = useRecordFocusSession();

  // Schema field names (focus_settings table): pomodoro_minutes, break_minutes,
  // long_break_minutes, long_break_after, daily_target_sessions. The earlier
  // `focus_minutes` / `daily_target` reads silently fell through to defaults
  // because the underlying columns don't exist — saves went to unknown
  // columns and reloads showed the defaults again.
  const focusMinutes = settingsData?.pomodoro_minutes ?? 50;
  const breakMinutes = settingsData?.break_minutes ?? 10;
  const longBreakMinutes = settingsData?.long_break_minutes ?? 15;
  const longBreakAfter = settingsData?.long_break_after ?? 4;
  const dailyTarget = settingsData?.daily_target_sessions ?? 4;

  const completedToday = React.useMemo(() => {
    return (allSessions ?? []).filter((s: any) => s.date_key === todayKey).length;
  }, [allSessions, todayKey]);

  // Timer state
  const [phase, setPhase] = React.useState<TimerPhase>("focus");
  const [status, setStatus] = React.useState<TimerStatus>("idle");
  const [secondsLeft, setSecondsLeft] = React.useState(focusMinutes * 60);
  const [focusSinceLong, setFocusSinceLong] = React.useState(0);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const getDuration = React.useCallback((p: TimerPhase) => {
    if (p === "focus") return focusMinutes * 60;
    if (p === "break") return breakMinutes * 60;
    return longBreakMinutes * 60;
  }, [focusMinutes, breakMinutes, longBreakMinutes]);

  React.useEffect(() => {
    if (status === "idle") setSecondsLeft(getDuration(phase));
  }, [focusMinutes, breakMinutes, longBreakMinutes, phase, status, getDuration]);

  const [showSettings, setShowSettings] = React.useState(false);
  const [editFocus, setEditFocus] = React.useState(String(focusMinutes));
  const [editBreak, setEditBreak] = React.useState(String(breakMinutes));
  const [editLongBreak, setEditLongBreak] = React.useState(String(longBreakMinutes));
  const [editLongAfter, setEditLongAfter] = React.useState(String(longBreakAfter));
  const [editTarget, setEditTarget] = React.useState(String(dailyTarget));

  React.useEffect(() => {
    setEditFocus(String(focusMinutes)); setEditBreak(String(breakMinutes));
    setEditLongBreak(String(longBreakMinutes)); setEditLongAfter(String(longBreakAfter));
    setEditTarget(String(dailyTarget));
  }, [focusMinutes, breakMinutes, longBreakMinutes, longBreakAfter, dailyTarget]);

  const clearTick = React.useCallback(() => {
    if (intervalRef.current !== null) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const handleSessionComplete = React.useCallback(async () => {
    clearTick(); playBeep();
    if (phase === "focus") {
      recordSession.mutate({ date_key: todayISO(), duration_minutes: focusMinutes });
      const nextCount = focusSinceLong + 1;
      setFocusSinceLong(nextCount);
      const nextPhase: TimerPhase = nextCount % longBreakAfter === 0 ? "long" : "break";
      setPhase(nextPhase);
      setSecondsLeft(nextPhase === "long" ? longBreakMinutes * 60 : breakMinutes * 60);
      setStatus("running");
    } else {
      setPhase("focus"); setSecondsLeft(focusMinutes * 60); setStatus("idle");
    }
  }, [phase, breakMinutes, focusMinutes, longBreakMinutes, longBreakAfter, focusSinceLong, clearTick, recordSession]);

  const handleSessionCompleteRef = React.useRef(handleSessionComplete);
  React.useEffect(() => { handleSessionCompleteRef.current = handleSessionComplete; }, [handleSessionComplete]);

  const startTick = React.useCallback(() => {
    clearTick();
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => { if (prev <= 1) { handleSessionCompleteRef.current(); return 0; } return prev - 1; });
    }, 1000);
  }, [clearTick]);

  React.useEffect(() => {
    if (status === "running") startTick();
    return clearTick;
  }, [status, startTick, clearTick]);

  function handleStart() { if (status === "idle" || status === "paused") setStatus("running"); }
  function handlePause() { if (status === "running") { clearTick(); setStatus("paused"); } }
  function handleReset() { clearTick(); setPhase("focus"); setStatus("idle"); setSecondsLeft(focusMinutes * 60); setFocusSinceLong(0); }
  function handleModeSwitch(nextPhase: TimerPhase) { clearTick(); setPhase(nextPhase); setStatus("idle"); setSecondsLeft(getDuration(nextPhase)); }

  async function handleSaveSettings() {
    const fm = Math.max(1, Math.min(120, Number(editFocus) || 50));
    const bm = Math.max(1, Math.min(60, Number(editBreak) || 10));
    const lbm = Math.max(1, Math.min(60, Number(editLongBreak) || 15));
    const lba = Math.max(1, Math.min(10, Number(editLongAfter) || 4));
    const dt = Math.max(1, Math.min(20, Number(editTarget) || 4));
    updateSettings.mutate({
      pomodoro_minutes: fm,
      break_minutes: bm,
      long_break_minutes: lbm,
      long_break_after: lba,
      daily_target_sessions: dt,
    });
    setShowSettings(false);
    if (status === "idle") { setPhase("focus"); setSecondsLeft(fm * 60); }
  }

  const totalSeconds = getDuration(phase);
  const progress = totalSeconds > 0 ? 1 - secondsLeft / totalSeconds : 0;
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress);
  const ringColor = PHASE_COLORS[phase];
  const currentCycle = focusSinceLong % longBreakAfter;
  const phaseLabel = phase === "focus" ? "Focus" : phase === "break" ? "Break" : "Long Break";

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      <header>
        <h1 className="tp-title text-3xl font-bold md:text-4xl">FOCUS TIMER</h1>
        <p className="tp-subtitle mt-1 text-sm text-white/70">{phaseLabel} · {todayKey}</p>
      </header>

      <div className="mt-4 flex items-center justify-center">
        <div className="tp-timer-modes">
          {(["focus", "break", "long"] as const).map((item) => (
            <button key={item} type="button" onClick={() => handleModeSwitch(item)} className={`tp-timer-mode-btn${phase === item ? " is-active" : ""}`}>
              {item === "focus" ? "Focus" : item === "break" ? "Break" : "Long Break"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center">
        <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
          <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} className="rotate-[-90deg]">
            <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={RING_STROKE} />
            <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} fill="none" stroke={ringColor} strokeWidth={RING_STROKE} strokeLinecap="round" strokeDasharray={RING_CIRCUMFERENCE} strokeDashoffset={dashOffset} style={{ transition: "stroke-dashoffset 0.35s ease" }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-mono font-bold tracking-wider text-white">{formatTime(secondsLeft)}</span>
            <span className="mt-1 text-xs font-medium uppercase tracking-widest" style={{ color: ringColor }}>{phaseLabel}</span>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          {status !== "running" ? (
            <button type="button" onClick={handleStart} className="tp-button tp-button-inline inline-flex w-auto px-8">{status === "paused" ? "Resume" : "Start"}</button>
          ) : (
            <button type="button" onClick={handlePause} className="tp-button tp-button-inline inline-flex w-auto px-8">Pause</button>
          )}
          <button type="button" onClick={handleReset} className="tp-button tp-button-inline inline-flex w-auto px-5">Reset</button>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="tp-panel p-4 text-center"><p className="tp-kicker">Today</p><p className="tp-score-value mt-1 text-2xl">{completedToday}<span className="text-base text-white/50">/{dailyTarget}</span></p></div>
        <div className="tp-panel p-4 text-center"><p className="tp-kicker">Cycle</p><p className="tp-score-value mt-1 text-2xl">{currentCycle}<span className="text-base text-white/50">/{longBreakAfter}</span></p></div>
      </div>

      <div className="mt-6">
        <button type="button" onClick={() => setShowSettings((v) => !v)} className="tp-button tp-button-inline inline-flex w-auto px-4 text-sm">{showSettings ? "Hide Settings" : "Settings"}</button>
      </div>

      {showSettings && (
        <section className="tp-panel mt-4 p-5">
          <p className="tp-kicker mb-4">Timer Settings</p>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <div><label className="body-label">Focus (min)</label><input type="number" min={1} max={120} value={editFocus} onChange={(e) => setEditFocus(e.target.value)} className="body-input" /></div>
            <div><label className="body-label">Break (min)</label><input type="number" min={1} max={60} value={editBreak} onChange={(e) => setEditBreak(e.target.value)} className="body-input" /></div>
            <div><label className="body-label">Long Break (min)</label><input type="number" min={1} max={60} value={editLongBreak} onChange={(e) => setEditLongBreak(e.target.value)} className="body-input" /></div>
            <div><label className="body-label">Long Break After</label><input type="number" min={1} max={10} value={editLongAfter} onChange={(e) => setEditLongAfter(e.target.value)} className="body-input" /></div>
            <div><label className="body-label">Daily Target</label><input type="number" min={1} max={20} value={editTarget} onChange={(e) => setEditTarget(e.target.value)} className="body-input" /></div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={handleSaveSettings} className="tp-button inline-flex w-auto px-5">Save</button>
            <button type="button" onClick={() => setShowSettings(false)} className="tp-button tp-button-inline inline-flex w-auto px-5">Cancel</button>
          </div>
        </section>
      )}
    </main>
  );
}
