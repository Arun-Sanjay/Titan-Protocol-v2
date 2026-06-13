/**
 * Renders the active confirm dialog from `lib/confirm`. Mounted once in
 * OSLayout. Esc / backdrop = cancel, Enter = confirm.
 */
import { useEffect, useState } from "react";
import { subscribeConfirm, resolveConfirm, type ConfirmState } from "../../lib/confirm";

export function ConfirmHost() {
  const [state, setState] = useState<ConfirmState | null>(null);
  useEffect(() => subscribeConfirm(setState), []);

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") resolveConfirm(false);
      if (e.key === "Enter") resolveConfirm(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  if (!state) return null;

  const confirmColor = state.destructive ? "#ff6b6b" : "var(--accent, #4a9eff)";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={state.title}
      onClick={(e) => {
        if (e.target === e.currentTarget) resolveConfirm(false);
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10001,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "min(420px, 100%)",
          background: "var(--panel, #161616)",
          border: "1px solid var(--stroke, #333)",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 600,
            color: "var(--text, #e6e6e6)",
          }}
        >
          {state.title}
        </h2>
        {state.message && (
          <p
            style={{
              marginTop: 10,
              marginBottom: 0,
              fontSize: 13,
              lineHeight: 1.5,
              color: "var(--muted, #9a9a9a)",
            }}
          >
            {state.message}
          </p>
        )}
        <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            type="button"
            onClick={() => resolveConfirm(false)}
            style={{
              padding: "8px 16px",
              background: "transparent",
              color: "var(--text, #e6e6e6)",
              border: "1px solid var(--stroke, #333)",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {state.cancelLabel ?? "Cancel"}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => resolveConfirm(true)}
            style={{
              padding: "8px 16px",
              background: confirmColor,
              color: "#0a0a0a",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {state.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
