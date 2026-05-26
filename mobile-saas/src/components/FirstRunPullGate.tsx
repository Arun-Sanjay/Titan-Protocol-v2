import { useEffect, useRef, useState } from "react";
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { pullIfEmpty } from "../sync/first-run-pull";
import type { RestoreProgress } from "../sync/restore";
import { colors, fonts, spacing } from "../theme";

interface Props {
  userId: string;
  children: React.ReactNode;
}

/**
 * On the first sign-in for this device + this user, run `pullIfEmpty` to
 * restore the cloud snapshot into the local SQLite cache before rendering
 * children. Subsequent renders (cache populated) pass through immediately.
 *
 * Mirrors web's component — same logic, RN primitives instead of `<div>`.
 */
export function FirstRunPullGate({ userId, children }: Props) {
  const [status, setStatus] = useState<"checking" | "syncing" | "ready">(
    "checking",
  );
  const [progress, setProgress] = useState<RestoreProgress | null>(null);
  const ranForRef = useRef<string | null>(null);

  useEffect(() => {
    // ranForRef guards the userId so we only kick off pullIfEmpty once per
    // user — even under React.StrictMode's mount → unmount → remount cycle.
    // The remount returns early because ranForRef.current === userId from
    // the first mount, so we don't fire a second concurrent pull.
    //
    // Note: we DO NOT use a `cancelled` flag to gate the final setStatus.
    // StrictMode would set cancelled=true on the cleanup between mounts;
    // the first mount's async then completes with cancelled=true and skips
    // setStatus, leaving the gate stuck in "checking" forever (renders
    // null → blank screen). React 19 treats setState on an unmounted
    // component as a no-op, so the unconditional setStatus is safe and
    // prevents that hang.
    if (ranForRef.current === userId) return;
    ranForRef.current = userId;

    void (async () => {
      try {
        await pullIfEmpty(userId, (p) => {
          setStatus("syncing");
          setProgress(p);
        });
      } catch {
        // fall through — setStatus below still fires
      }
      setStatus("ready");
    })();
  }, [userId]);

  if (status === "syncing") return <PullSplash progress={progress} />;
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
});
