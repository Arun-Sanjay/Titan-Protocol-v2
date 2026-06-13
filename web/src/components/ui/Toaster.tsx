/**
 * Renders the toast stack from `lib/toast`. Mounted once in OSLayout.
 * Bottom-right, newest on top, auto-dismiss handled by the bus. Each toast
 * can carry an action button (e.g. "Undo" for a delete).
 */
import { useEffect, useState } from "react";
import { subscribeToasts, dismissToast, type Toast, type ToastKind } from "../../lib/toast";

const KIND_COLOR: Record<ToastKind, string> = {
  success: "var(--status-good, #4ade80)",
  error: "#ff6b6b",
  info: "var(--accent, #4a9eff)",
};

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => subscribeToasts(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxWidth: "min(400px, calc(100vw - 40px))",
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          style={{
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 14px",
            background: "var(--panel, #161616)",
            color: "var(--text, #e6e6e6)",
            border: "1px solid var(--stroke, #333)",
            borderLeft: `3px solid ${KIND_COLOR[t.kind]}`,
            borderRadius: 8,
            boxShadow: "0 8px 28px rgba(0,0,0,0.45)",
            fontSize: 13,
            lineHeight: 1.4,
            animation: "titanToastIn 180ms ease-out",
          }}
        >
          <span style={{ flex: 1 }}>{t.message}</span>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                t.action!.onClick();
                dismissToast(t.id);
              }}
              style={{
                background: "transparent",
                color: KIND_COLOR[t.kind],
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: 1,
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              {t.action.label}
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => dismissToast(t.id)}
            style={{
              background: "transparent",
              color: "var(--muted, #808080)",
              border: "none",
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </div>
      ))}
      <style>{`@keyframes titanToastIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
