import { useCallback, useEffect, useRef, useState } from "react";
import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { pullIfEmpty } from "../sync/first-run-pull";
import type { RestoreProgress } from "../sync/restore";
import { colors, fonts, spacing } from "../theme";

interface Props {
  userId: string;
  /**
   * Invoked once per user after the pull settles (success or failure),
   * before children render. The root layout uses it to hydrate the
   * device-local onboarding flag from the freshly pulled profile row so
   * an already-onboarded account is never routed back into onboarding.
   */
  onReady?: () => Promise<void> | void;
  children: React.ReactNode;
}

/**
 * On the first sign-in for this device + this user, run `pullIfEmpty` to
 * restore the cloud snapshot into the local SQLite cache before rendering
 * children. Subsequent renders (cache populated) pass through immediately.
 *
 * Mirrors web's component — same logic, RN primitives instead of `<div>`.
 */
export function FirstRunPullGate({ userId, onReady, children }: Props) {
  const [status, setStatus] = useState<
    "checking" | "syncing" | "error" | "ready"
  >("checking");
  const [progress, setProgress] = useState<RestoreProgress | null>(null);
  const ranForRef = useRef<string | null>(null);
  // Keep the latest callback without re-triggering the pull effect.
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const runPull = useCallback(async () => {
    setStatus("checking");
    setProgress(null);
    let ok = false;
    try {
      const res = await pullIfEmpty(userId, (p) => {
        setStatus("syncing");
        setProgress(p);
      });
      ok = res.ok;
    } catch {
      ok = false;
    }
    // On failure, surface an error + Retry rather than rendering the app over
    // an empty cache: an unsurfaced first-run pull failure looks identical to
    // total data loss, and on a fresh device the cloud is the only copy. It
    // also used to feed the onboarding-wipe path (defaulted profile pushed
    // over the real one).
    if (!ok) {
      setStatus("error");
      return;
    }
    try {
      await onReadyRef.current?.();
    } catch {
      // hydration is best-effort; never wedge the gate
    }
    setStatus("ready");
  }, [userId]);

  useEffect(() => {
    // ranForRef guards the userId so we only auto-run the pull once per user
    // — even under StrictMode's mount → unmount → remount cycle. setState on
    // an unmounted component is a no-op in React 19, so a pull settling after
    // a StrictMode unmount is harmless. The Retry button calls runPull directly.
    if (ranForRef.current === userId) return;
    ranForRef.current = userId;
    void runPull();
  }, [userId, runPull]);

  if (status === "syncing") return <PullSplash progress={progress} />;
  if (status === "error") return <PullError onRetry={() => void runPull()} />;
  if (status === "checking") return null;
  return <>{children}</>;
}

function PullSplash({ progress }: { progress: RestoreProgress | null }) {
  const tablesTotal = progress?.tablesTotal ?? 0;
  const tablesDone = progress?.tablesCompleted ?? 0;
  const pct = tablesTotal ? Math.floor((tablesDone / tablesTotal) * 100) : 0;
  const currentTable = progress?.currentTable ?? "…";
  const rows = progress?.rowsDownloaded ?? 0;

  return (
    <View style={styles.root}>
      <Text style={styles.label}>SYNCING YOUR DATA</Text>
      <Text style={styles.headline}>Restoring from cloud · {pct}%</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.meta}>
        {currentTable} · {rows} rows
      </Text>
    </View>
  );
}

function PullError({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.root}>
      <Text style={[styles.label, { color: "#ff6b6b" }]}>SYNC FAILED</Text>
      <Text style={styles.headline}>Could not load your data</Text>
      <Text style={[styles.meta, { textAlign: "center", maxWidth: 320 }]}>
        Check your connection and try again — your data is safe in the cloud.
      </Text>
      <Pressable onPress={onRetry} style={styles.retryBtn}>
        <Text style={styles.retryLabel}>RETRY</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    padding: spacing["2xl"],
  },
  label: {
    ...fonts.caption,
    color: colors.textMuted,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  headline: { ...fonts.body, color: colors.text },
  barTrack: {
    width: 320,
    maxWidth: "80%",
    height: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 2,
    overflow: "hidden",
  },
  barFill: { height: "100%", backgroundColor: colors.accent },
  meta: { ...fonts.caption, color: colors.textMuted, letterSpacing: 1.5 },
  retryBtn: {
    marginTop: spacing.lg,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  retryLabel: { ...fonts.caption, color: colors.text, letterSpacing: 2 },
});
