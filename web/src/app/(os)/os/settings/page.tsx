import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { useOnboarding } from "@/components/onboarding/OnboardingWizard";
import { useTheme } from "@/components/ui/ThemeProvider";
import type { TitanTheme } from "@/lib/theme";
import { useWebAuth } from "@/lib/auth";
import { deleteAccount } from "@/services/account";
import {
  restoreFromCloud,
  type RestoreProgress,
  type RestoreResult,
} from "@/sync/restore";
import { SyncStatusBadge } from "@/components/ui/SyncStatusBadge";
import { downloadDataExport } from "@/sync/export";
import { toast } from "@/lib/toast";
import { useProfile, useUpdateProfile } from "@/hooks/queries/useProfile";
import { useEntitlement } from "@/hooks/queries/useSubscription";
import { startRazorpayCheckout } from "@/lib/razorpay";

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
  const { user, signOut, updatePassword } = useWebAuth();
  const { theme, setTheme } = useTheme();
  const { reset: resetOnboarding } = useOnboarding();
  const showDevEscapeHatch = useIsDevEscapeHatch();

  const [flow, setFlow] = React.useState<FlowState>({ phase: "idle" });
  const [deleteState, setDeleteState] = React.useState<
    "idle" | "confirm" | "deleting" | "error"
  >("idle");
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("");
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  async function handleDeleteAccount() {
    setDeleteState("deleting");
    setDeleteError(null);
    try {
      // Server-side erase (delete-account Edge Function → auth.users
      // delete → FK cascade through every table), local wipe + sign-out
      // included in the service.
      await deleteAccount();
      navigate("/auth/login", { replace: true });
    } catch (e) {
      setDeleteError(
        e instanceof Error
          ? e.message
          : "Account deletion failed — please try again.",
      );
      setDeleteState("error");
    }
  }

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

  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const entitlement = useEntitlement();
  const [subBusy, setSubBusy] = React.useState(false);

  async function handleSubscribe() {
    setSubBusy(true);
    try {
      await startRazorpayCheckout();
      toast.success("You're Pro — thanks for subscribing!");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Payment failed.";
      if (msg !== "Payment cancelled.") toast.error(msg);
    } finally {
      setSubBusy(false);
    }
  }
  const [nameDraft, setNameDraft] = React.useState<string | null>(null);
  const nameValue = nameDraft ?? profile?.display_name ?? "";
  const nameDirty =
    nameDraft !== null && nameDraft.trim() !== (profile?.display_name ?? "");

  async function handleSaveName() {
    const next = nameValue.trim();
    try {
      await updateProfile.mutateAsync({ display_name: next || null });
      setNameDraft(null);
      toast.success("Display name updated.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Couldn't save your name — try again.",
      );
    }
  }

  const [exportBusy, setExportBusy] = React.useState(false);

  async function handleExport() {
    setExportBusy(true);
    try {
      await downloadDataExport();
      toast.success("Your data has been exported.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Export failed — please try again.",
      );
    } finally {
      setExportBusy(false);
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

  const [pwOpen, setPwOpen] = React.useState(false);
  const [pwNew, setPwNew] = React.useState("");
  const [pwConfirm, setPwConfirm] = React.useState("");
  const [pwBusy, setPwBusy] = React.useState(false);
  const [pwMsg, setPwMsg] = React.useState<
    { kind: "ok" | "err"; text: string } | null
  >(null);

  async function handleChangePassword() {
    if (pwNew.length < 8) {
      setPwMsg({ kind: "err", text: "Password must be at least 8 characters." });
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwMsg({ kind: "err", text: "Passwords don't match." });
      return;
    }
    setPwBusy(true);
    setPwMsg(null);
    const { error } = await updatePassword(pwNew);
    setPwBusy(false);
    if (error) {
      setPwMsg({ kind: "err", text: error.message });
      return;
    }
    setPwNew("");
    setPwConfirm("");
    setPwOpen(false);
    setPwMsg({ kind: "ok", text: "Password updated." });
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

      {/* ── Plan ───────────────────────────────────────────────────────── */}
      <section className="tp-panel p-5">
        <p className="tp-kicker mb-2">Plan</p>
        <div className="flex items-center gap-3">
          <span
            className="rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-widest"
            style={
              entitlement.isPro
                ? {
                    color: "#fbbf24",
                    border: "1px solid rgba(251,191,36,0.5)",
                    background: "rgba(251,191,36,0.10)",
                  }
                : {
                    color: "rgba(245,248,255,0.7)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }
            }
          >
            {entitlement.isPro
              ? entitlement.source === "trial"
                ? "Pro · Trial"
                : "Pro"
              : "Free"}
          </span>
          {entitlement.source === "trial" && entitlement.trialEndsAt && (
            <span className="tp-muted text-sm">
              Trial ends{" "}
              {new Date(entitlement.trialEndsAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          )}
          {entitlement.source === "subscription" && entitlement.expiresAt && (
            <span className="tp-muted text-sm">
              {entitlement.willRenew ? "Renews" : "Expires"}{" "}
              {new Date(entitlement.expiresAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          )}
        </div>
        <p className="tp-muted mt-2 text-sm">
          {entitlement.source === "subscription"
            ? "You have full access to every Titan Protocol feature."
            : entitlement.source === "trial"
              ? "Your free trial is active — everything's unlocked. Subscribe any time to keep access after it ends."
              : "You're on the free plan. Subscribe to unlock everything."}
        </p>
        {entitlement.source !== "subscription" && (
          <button
            type="button"
            className="tp-button tp-button-inline mt-4"
            onClick={handleSubscribe}
            disabled={subBusy}
          >
            {subBusy ? "Opening checkout…" : "Subscribe · ₹300/month"}
          </button>
        )}
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

        <div className="mt-3">
          <label
            htmlFor="display-name"
            className="tp-muted mb-2 block text-xs uppercase tracking-widest"
          >
            Display name
          </label>
          <div className="flex gap-2">
            <input
              id="display-name"
              value={nameValue}
              maxLength={40}
              placeholder="What should we call you?"
              onChange={(e) => setNameDraft(e.target.value)}
              disabled={updateProfile.isPending}
              className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/90 outline-none"
            />
            <button
              type="button"
              className="tp-button tp-button-inline"
              disabled={!nameDirty || updateProfile.isPending}
              onClick={handleSaveName}
            >
              {updateProfile.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        <SyncStatusBadge />
        <button
          type="button"
          className="tp-button tp-button-inline mt-4"
          onClick={handleSignOut}
        >
          Sign Out
        </button>

        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="tp-muted mb-2 text-xs uppercase tracking-widest">
            Password
          </p>
          {!pwOpen ? (
            <>
              <button
                type="button"
                className="tp-button tp-button-inline"
                onClick={() => {
                  setPwOpen(true);
                  setPwMsg(null);
                }}
              >
                Change password
              </button>
              {pwMsg?.kind === "ok" && (
                <p
                  className="mt-2 text-xs"
                  style={{ color: "var(--status-success, #34d399)" }}
                >
                  {pwMsg.text}
                </p>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <input
                type="password"
                autoComplete="new-password"
                placeholder="New password (min 8 characters)"
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
                disabled={pwBusy}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/90 outline-none"
              />
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Repeat new password"
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                disabled={pwBusy}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/90 outline-none"
              />
              {pwMsg?.kind === "err" && (
                <p className="text-xs" style={{ color: "#ff9d9d" }}>
                  {pwMsg.text}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="tp-button tp-button-inline"
                  disabled={pwBusy}
                  onClick={handleChangePassword}
                >
                  {pwBusy ? "Saving…" : "Save password"}
                </button>
                <button
                  type="button"
                  className="tp-button tp-button-inline"
                  disabled={pwBusy}
                  onClick={() => {
                    setPwOpen(false);
                    setPwNew("");
                    setPwConfirm("");
                    setPwMsg(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

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

      {/* ── Your data ──────────────────────────────────────────────────── */}
      <section className="tp-panel p-5">
        <p className="tp-kicker mb-2">Your data</p>
        <p className="tp-muted text-sm">
          Download everything in your account — tasks, habits, journal, body
          and money logs, XP, the lot — as a single JSON file. It's yours;
          take it anywhere.
        </p>
        <button
          type="button"
          className="tp-button tp-button-inline mt-4"
          onClick={handleExport}
          disabled={exportBusy}
        >
          {exportBusy ? "Exporting…" : "Export my data"}
        </button>
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

      {/* ── Danger zone ────────────────────────────────────────────────── */}
      <section
        className="tp-panel p-5"
        style={{ borderColor: "rgba(255, 107, 107, 0.25)" }}
      >
        <p className="tp-kicker mb-2" style={{ color: "#ff6b6b" }}>
          Danger zone
        </p>
        <p className="tp-muted text-sm">
          Permanently delete your account and every piece of data attached
          to it — tasks, habits, journal, body and money logs, XP,
          everything — from the cloud and this device. This cannot be
          undone.
        </p>
        {deleteState === "idle" ? (
          <button
            type="button"
            className="tp-button tp-button-inline mt-4"
            style={{ borderColor: "rgba(255,107,107,0.4)", color: "#ff9d9d" }}
            onClick={() => setDeleteState("confirm")}
          >
            Delete account…
          </button>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-sm" style={{ color: "#ff9d9d" }}>
              Type <span style={{ fontWeight: 700 }}>DELETE</span> to
              confirm.
            </p>
            <input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              disabled={deleteState === "deleting"}
              placeholder="DELETE"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/90 outline-none"
              style={{ letterSpacing: 2 }}
            />
            {deleteState === "error" && deleteError && (
              <p className="text-xs" style={{ color: "#ff9d9d" }}>
                {deleteError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                className="tp-button tp-button-inline"
                style={{
                  borderColor: "rgba(255,107,107,0.4)",
                  color: "#ff9d9d",
                }}
                disabled={
                  deleteConfirmText !== "DELETE" || deleteState === "deleting"
                }
                onClick={handleDeleteAccount}
              >
                {deleteState === "deleting"
                  ? "Deleting…"
                  : "Permanently delete"}
              </button>
              <button
                type="button"
                className="tp-button tp-button-inline"
                disabled={deleteState === "deleting"}
                onClick={() => {
                  setDeleteState("idle");
                  setDeleteConfirmText("");
                  setDeleteError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
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
