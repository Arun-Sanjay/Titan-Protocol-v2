/**
 * SystemWindowProvider — Context-based queue for SystemWindow modals.
 *
 * Wraps the app and exposes `useSystemWindow().enqueue(...)` to fire
 * full-screen modal events. Windows are shown one at a time; the queue
 * advances when the user acknowledges the current window.
 *
 * Usage:
 *   // In app root:
 *   <SystemWindowProvider>
 *     <App />
 *   </SystemWindowProvider>
 *
 *   // Anywhere inside:
 *   const { enqueue } = useSystemWindow();
 *   enqueue({
 *     type: "reward",
 *     title: "RANK UP",
 *     message: "You've reached Operator.",
 *   });
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";
import { Text } from "react-native";
import { SystemWindow } from "./SystemWindow";
import { colors, fonts } from "../../theme";

// ─── Types ───────────────────────────────────────────────────────────────────

type SystemWindowEvent = {
  id: number;
  type: "info" | "quest" | "alert" | "reward";
  title: string;
  message: string;
  actionLabel?: string;
  accentColor?: string;
  onAction?: () => void;
};

type SystemWindowContextType = {
  enqueue: (event: Omit<SystemWindowEvent, "id">) => void;
};

// ─── Context ─────────────────────────────────────────────────────────────────

const SystemWindowContext = createContext<SystemWindowContextType>({
  enqueue: () => {},
});

export function useSystemWindow(): SystemWindowContextType {
  return useContext(SystemWindowContext);
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function SystemWindowProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<SystemWindowEvent[]>([]);
  const idCounter = useRef(0);

  const enqueue = useCallback((event: Omit<SystemWindowEvent, "id">) => {
    const item: SystemWindowEvent = { ...event, id: ++idCounter.current };
    setQueue((prev) => [...prev, item]);
  }, []);

  // ── Dismiss current (advance queue) ────────────────────────────────────

  function handleAction() {
    const current = queue[0];
    current?.onAction?.();
    setQueue((prev) => prev.slice(1));
  }

  function handleDismiss() {
    setQueue((prev) => prev.slice(1));
  }

  // ── Render ─────────────────────────────────────────────────────────────

  const current = queue[0] ?? null;

  return (
    <SystemWindowContext.Provider value={{ enqueue }}>
      {children}
      {current && (
        <SystemWindow
          key={current.id}
          visible
          type={current.type}
          title={current.title}
          actionLabel={current.actionLabel}
          accentColor={current.accentColor}
          onAction={handleAction}
          onDismiss={current.type === "info" ? handleDismiss : undefined}
        >
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 14,
              lineHeight: 20,
              fontFamily: fonts.mono?.fontFamily ?? "monospace",
            }}
          >
            {current.message}
          </Text>
        </SystemWindow>
      )}
    </SystemWindowContext.Provider>
  );
}
