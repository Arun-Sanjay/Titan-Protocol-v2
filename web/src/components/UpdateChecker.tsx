/**
 * Tauri auto-update banner. Renders only when:
 *   - we're inside Tauri (browser builds skip the check entirely)
 *   - the updater endpoint says a newer version exists
 *
 * Banner is non-blocking — it docks at the bottom of the window and lets
 * the user keep working. "Update now" downloads, installs, and relaunches.
 * "Later" dismisses for this session.
 */
import { useEffect, useState } from "react";
import { checkForUpdate, type UpdateInfo } from "../lib/desktop-updater";
import { captureEvent, captureException } from "../lib/observability";

export function UpdateChecker() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const info = await checkForUpdate();
      if (!cancelled && info) {
        captureEvent("desktop.update.available", { version: info.version });
        setUpdate(info);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!update || dismissed) return null;

  async function applyUpdate() {
    if (!update) return;
    setBusy(true);
    try {
      captureEvent("desktop.update.install_started", { version: update.version });
      await update.downloadAndInstall();
      captureEvent("desktop.update.install_completed", { version: update.version });
      await update.relaunch();
    } catch (err) {
      captureException(err, { source: "desktop-updater.apply" });
      setBusy(false);
    }
  }

  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 200,
        maxWidth: 380,
        background: "rgba(8, 9, 12, 0.96)",
        border: "1px solid rgba(120, 160, 255, 0.28)",
        borderRadius: 10,
        padding: "16px 18px",
        boxShadow:
          "0 12px 36px -10px rgba(120, 160, 255, 0.35), 0 0 0 1px rgba(255,255,255,0.04)",
        color: "var(--text, #e8eaed)",
        fontFamily: "var(--font-mono, ui-monospace, monospace)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: 2.5,
          textTransform: "uppercase",
          color: "rgba(180, 200, 255, 0.85)",
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: "rgba(120, 200, 255, 0.95)",
            boxShadow: "0 0 8px rgba(120, 200, 255, 0.7)",
            display: "inline-block",
          }}
        />
        Update available · v{update.version}
      </div>

      <p
        style={{
          margin: "0 0 14px",
          fontSize: 13,
          lineHeight: 1.5,
          color: "rgba(232, 234, 237, 0.78)",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        {busy
          ? "Downloading and applying… the app will restart automatically."
          : "A newer build of Titan Protocol is ready. Apply now and the app will restart."}
      </p>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          disabled={busy}
          style={{
            padding: "6px 14px",
            fontSize: 11,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            background: "transparent",
            color: "rgba(232, 234, 237, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 6,
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.4 : 1,
          }}
        >
          Later
        </button>
        <button
          type="button"
          onClick={applyUpdate}
          disabled={busy}
          style={{
            padding: "6px 16px",
            fontSize: 11,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            fontWeight: 600,
            background: "linear-gradient(180deg, rgba(232, 240, 255, 0.96), rgba(200, 210, 232, 0.88))",
            color: "#0a0a0a",
            border: "1px solid rgba(255, 255, 255, 0.18)",
            borderRadius: 6,
            cursor: busy ? "wait" : "pointer",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? "Updating…" : "Update now"}
        </button>
      </div>
    </div>
  );
}
