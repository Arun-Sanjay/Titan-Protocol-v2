import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { useOnboarding } from "@/components/onboarding/OnboardingWizard";
import { useTheme } from "@/components/ui/ThemeProvider";
import type { TitanTheme } from "@/lib/theme";
import { useWebAuth } from "@/lib/auth";
import {
  restoreFromCloud,
  type RestoreProgress,
  type RestoreResult,
} from "@/sync/restore";

// Dev escape hatch — force a full re-pull from cloud. Reachable by adding
// ?dev=1 to /os/settings. Most users never see this. Kept because if a
// Realtime event was missed (e.g. the user was offline for a while), a
// manual nudge can recover faster than waiting for the next mutation to
// surface drift.
function useIsDevEscapeHatch(): boolean {
  return typeof window !== "undefined"
    && new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("dev") === "1";
}

type FlowState =
  | { phase: "idle" }
  | { phase: "restoring"; progress: RestoreProgress }
  | { phase: "done"; title: string; message: string }
  | { phase: "error"; title: string; error: string; errorTable?: string };

export default function SettingsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user, signOut } = useWebAuth();
  const { theme, setTheme } = useTheme();
  const { reset: resetOnboarding } = useOnboarding();
  const showDevEscapeHatch = useIsDevEscapeHatch();

  const [flow, setFlow] = React.useState<FlowState>({ phase: "idle" });

  async function handleForceRestore() {
    const ok = window.confirm(
      "Force re-pull from cloud?\n\nThis hard-replaces every row on this device with the copy in your account. Use only if you suspect sync drift — normal operation keeps you in sync automatically.",
    );
    if (!ok) return;

    setFlow({
      phase: "restoring",
      progress: {
        currentTable: null,
        tablesCompleted: 0,
        tablesTotal: 0,
        rowsDownloaded: 0,
      },
    });
    const res: RestoreResult = await restoreFromCloud((progress) =>
      setFlow({ phase: "restoring", progress }),
    );
    if (res.success) {
      await qc.invalidateQueries();
      setFlow({
        phase: "done",
        title: "RE-PULL COMPLETE",
        message: `${res.rowsDownloaded.toLocaleString()} rows pulled across ${res.tablesRestored} tables.`,
      });
    } else {
      setFlow({
        phase: "error",
        title: "RE-PULL FAILED",
        error: res.error,
        errorTable: res.errorTable,
      });
    }
  }

  async function handleSignOut() {
    const ok = window.confirm(
      "Sign out?\n\nThis device's local cache will be cleared. You can sign in again from any device — your data lives in the cloud.",
    );
    if (!ok) return;
    await signOut();
    navigate("/auth/login", { replace: true });
  }

  function dismissModal() {
    setFlow({ phase: "idle" });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <header>
        <p className="tp-kicker">Configuration</p>
        <h1 className="tp-title text-3xl font-bold md:text-4xl">SETTINGS</h1>
      </header>

      {/* ── Appearance ─────────────────────────────────────────────────── */}
      <section className="tp-panel p-5">
        <p className="tp-kicker mb-4">Appearance</p>
        <div className="flex gap-3">
          {(
            [
              {
                key: "hud" as TitanTheme,
                label: "Black Metallic",
                desc: "Clean silver-on-black, minimal glow",
                gradient:
                  "linear-gradient(135deg, #0b0b0b 0%, #1a1a1a 50%, #0b0b0b 100%)",
              },
              {
                key: "cyberpunk" as TitanTheme,
                label: "Cyberpunk",
                desc: "Cyan accents, neon glow, dense HUD",
                gradient:
                  "linear-gradient(135deg, #050607 0%, #0c1a2a 50%, #050607 100%)",
              },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setTheme(opt.key)}
              className="flex-1 rounded-xl border p-4 text-left transition-all duration-150"
              style={{
                borderColor:
                  theme === opt.key
                    ? opt.key === "cyberpunk"
                      ? "rgba(56, 189, 248, 0.5)"
                      : "rgba(255, 255, 255, 0.3)"
                    : "rgba(255, 255, 255, 0.08)",
                background: opt.gradient,
                boxShadow:
                  theme === opt.key
                    ? opt.key === "cyberpunk"
                      ? "0 0 20px rgba(56, 189, 248, 0.15)"
                      : "0 0 20px rgba(255, 255, 255, 0.05)"
                    : "none",
              }}
            >
              <span
                className="mb-1 block text-sm font-semibold"
                style={{
                  color:
                    theme === opt.key
                      ? opt.key === "cyberpunk"
                        ? "#38bdf8"
                        : "rgba(245, 248, 255, 0.92)"
                      : "rgba(245, 248, 255, 0.6)",
                }}
              >
                {opt.label}
              </span>
              <span
                className="block text-xs"
                style={{ color: "rgba(210, 216, 230, 0.5)" }}
              >
                {opt.desc}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Account ────────────────────────────────────────────────────── */}
      <section className="tp-panel p-5">
        <p className="tp-kicker mb-2">Account</p>
        {user && (
          <p className="tp-muted text-sm">
            Signed in as{" "}
            <span className="text-white/80">{user.email ?? user.id}</span>
          </p>
        )}
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span
            aria-hidden="true"
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: "var(--status-success, #34d399)",
              boxShadow: "0 0 8px var(--status-success, #34d399)",
              display: "inline-block",
            }}
          />
          <span className="tp-muted uppercase tracking-widest">
            Cloud sync active
          </span>
        </div>
        <button
          type="button"
          className="tp-button tp-button-inline mt-4"
          onClick={handleSignOut}
        >
          Sign Out
        </button>

        {showDevEscapeHatch && (
          <div className="mt-4 border-t border-white/10 pt-3">
            <p className="tp-muted mb-2 text-xs uppercase tracking-widest">
              Developer · ?dev=1
            </p>
            <button
              type="button"
              className="tp-button tp-button-inline"
              onClick={handleForceRestore}
              disabled={flow.phase !== "idle"}
            >
              Force re-pull from cloud
            </button>
            <p className="tp-muted mt-2 text-xs">
              Cross-device sync is automatic. Use this only if you suspect
              the local cache has drifted.
            </p>
          </div>
        )}
      </section>

      {/* ── Onboarding ─────────────────────────────────────────────────── */}
      <section className="tp-panel p-5">
        <p className="tp-kicker mb-4">Onboarding</p>
        <button
          type="button"
          className="tp-button tp-button-inline"
          onClick={() => {
            resetOnboarding();
            window.location.reload();
          }}
        >
          Replay Onboarding Tutorial
        </button>
        <p className="tp-muted mt-2 text-xs">
          Re-show the welcome wizard on next page load.
        </p>
      </section>

      {/* ── Progress Modal ──────────────────────────────────────────────── */}
      {flow.phase !== "idle" && (
        <SyncModal flow={flow} onDismiss={dismissModal} />
      )}
    </div>
  );
}

// ─── Sync modal ────────────────────────────────────────────────────────────

type SyncProgress = {
  currentTable: string | null;
  tablesCompleted: number;
  tablesTotal: number;
  rowsMoved: number;
};

function SyncModal({
  flow,
  onDismiss,
}: {
  flow: Exclude<FlowState, { phase: "idle" }>;
  onDismiss: () => void;
}) {
  const isProgress = flow.phase === "restoring";

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          padding: 24,
          borderRadius: 12,
          border: "1px solid var(--stroke, #2a2a2a)",
          background: "var(--panel, #0f0f0f)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <h2
          style={{
            fontSize: 13,
            letterSpacing: 2.5,
            fontWeight: 700,
            color:
              flow.phase === "done"
                ? "var(--status-success, #34d399)"
                : flow.phase === "error"
                  ? "#ff6b6b"
                  : "var(--text, #e6e6e6)",
            margin: 0,
          }}
        >
          {"title" in flow ? flow.title : titleFor(flow.phase)}
        </h2>

        {isProgress && <ProgressBlock progress={toSyncProgress(flow)!} label={labelFor(flow.phase)} />}

        {flow.phase === "done" && (
          <p style={{ fontSize: 13, color: "var(--muted, #808080)", lineHeight: 1.5, margin: 0 }}>
            {flow.message}
          </p>
        )}

        {flow.phase === "error" && (
          <>
            <p style={{ fontSize: 13, color: "#ff9d9d", lineHeight: 1.5, margin: 0 }}>
              {flow.error}
            </p>
            {flow.errorTable && (
              <p style={{ fontSize: 12, color: "var(--muted, #808080)", margin: 0 }}>
                Failed at table: <code>{flow.errorTable}</code>
              </p>
            )}
          </>
        )}

        {(flow.phase === "done" || flow.phase === "error") && (
          <button
            type="button"
            className="tp-button"
            onClick={onDismiss}
            style={{ marginTop: 8 }}
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}

function ProgressBlock({
  progress,
  label,
}: {
  progress: SyncProgress;
  label: string;
}) {
  const pct =
    progress.tablesTotal > 0
      ? Math.round((progress.tablesCompleted / progress.tablesTotal) * 100)
      : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p
        style={{
          fontSize: 12,
          color: "var(--muted, #808080)",
          margin: 0,
          letterSpacing: 1,
        }}
      >
        {label}
        {progress.currentTable ? ` · ${progress.currentTable}` : ""}
      </p>
      <div
        style={{
          width: "100%",
          height: 4,
          background: "var(--stroke, #2a2a2a)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "var(--accent, #5cc9a0)",
            transition: "width 200ms",
          }}
        />
      </div>
      <p
        style={{
          fontSize: 11,
          color: "var(--muted, #808080)",
          margin: 0,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {progress.tablesCompleted}/{progress.tablesTotal} tables ·{" "}
        {progress.rowsMoved.toLocaleString()} rows
      </p>
    </div>
  );
}

function titleFor(phase: FlowState["phase"]): string {
  return phase === "restoring" ? "RE-PULLING…" : "";
}

function labelFor(phase: "restoring"): string {
  void phase;
  return "Pulling from cloud";
}

function toSyncProgress(flow: FlowState): SyncProgress | null {
  if (flow.phase === "restoring") {
    return {
      currentTable: flow.progress.currentTable,
      tablesCompleted: flow.progress.tablesCompleted,
      tablesTotal: flow.progress.tablesTotal,
      rowsMoved: flow.progress.rowsDownloaded,
    };
  }
  return null;
}

// Kept for future "last sync" surfaces — not currently rendered. Safe to
// remove if we never add a sync-status timestamp UI.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _formatBackup(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Never";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}
