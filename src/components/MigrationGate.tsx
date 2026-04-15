import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";

import { colors, spacing, fonts, radius } from "../theme";
import { HUDBackground } from "./ui/AnimatedBackground";
import { useAuthStore } from "../stores/useAuthStore";
import {
  maybeRunMigration,
  type MigrationStatus,
} from "../lib/migrate-to-supabase";
import { bootstrapFromCloud } from "../lib/cloud-bootstrap";
import { logError } from "../lib/error-log";
import { profileQueryKey } from "../hooks/queries/useProfile";

/**
 * Phase 3.5b: Migration gate.
 *
 * Wraps the authenticated app render path. On mount, kicks off the
 * one-time MMKV → Supabase migration if it hasn't run yet for the
 * current user. Shows a cinematic-themed progress modal while the
 * migration runs and only renders children once it's done (or skipped).
 *
 * Failure mode: if the migration errors, we still render children.
 * Better to let the user into the app with potentially-stale cloud
 * data than to lock them out. The migration script logs errors to the
 * Phase 2.2B error log ring buffer and the in-progress flag persists
 * so the next launch retries.
 */
type GateState = "checking" | "running" | "done";

type Props = {
  children: React.ReactNode;
};

export function MigrationGate({ children }: Props) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const [state, setState] = useState<GateState>("checking");
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const startedRef = useRef<string | null>(null);

  useEffect(() => {
    // Wait for the auth store to settle on a user before doing anything.
    if (!userId) {
      setState("done");
      return;
    }
    // Don't kick off a second migration for the same user in one app
    // session — `maybeRunMigration` is idempotent against the MMKV flag
    // but this guard avoids the React StrictMode double-mount surprise.
    if (startedRef.current === userId) return;
    startedRef.current = userId;

    let cancelled = false;

    // Phase 4.3: timeout so a slow network doesn't block the user
    // indefinitely on "Syncing your protocol". After 15 seconds, fall
    // through to children. The migration is idempotent and will finish
    // on the next launch.
    const timeout = setTimeout(() => {
      if (!cancelled) {
        logError("MigrationGate.timeout", new Error("Migration timed out after 15s"));
        setState("done");
      }
    }, 15_000);

    (async () => {
      try {
        const result = await maybeRunMigration((s) => {
          if (cancelled) return;
          // First progress event flips us into 'running' so the modal
          // appears (otherwise we'd flash it for a no-op skip).
          setState((prev) => (prev === "checking" ? "running" : prev));
          setStatus(s);
        });

        if (result) {
          // Real migration ran — refresh anything the user is about to see.
          queryClient.invalidateQueries({ queryKey: profileQueryKey });
          queryClient.invalidateQueries();
        }

        // Phase 6: cloud → MMKV bootstrap. Handles the fresh-device
        // case where the user signs in on a new install: no MMKV data
        // exists locally, so the legacy stores would render empty even
        // though the cloud has rows. The bootstrap pulls cloud data
        // back into MMKV for the supported domains. Per-user, per-
        // domain MMKV flags make it idempotent — already-populated
        // stores are skipped.
        if (!cancelled) {
          await bootstrapFromCloud(userId);
        }
      } catch (e) {
        logError("MigrationGate.run", e);
        // Fall through; the user still gets into the app with cloud
        // data (which may be partially migrated).
      } finally {
        clearTimeout(timeout);
        if (!cancelled) setState("done");
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [userId, queryClient]);

  if (state === "done") {
    return <>{children}</>;
  }

  // Show the modal during 'checking' AND 'running'. The 'checking'
  // window is usually 1-2 frames; the modal text shows a generic
  // "Preparing your protocol…" until the first progress event lands.
  return (
    <View style={styles.container}>
      <HUDBackground />
      <View style={styles.modal}>
        <Text style={styles.kicker}>SYSTEM SYNC</Text>
        <Text style={styles.title}>Syncing your protocol</Text>
        <Text style={styles.label}>
          {status?.label ?? "Preparing your protocol…"}
        </Text>

        <ProgressBar
          value={
            status
              ? status.completedSteps / Math.max(1, status.totalSteps)
              : 0.05
          }
        />

        <Text style={styles.steps}>
          {status
            ? `${status.completedSteps} of ${status.totalSteps}`
            : "Initializing"}
        </Text>

        <Text style={styles.subtitle}>
          We're moving your data to the cloud. This only happens once.
        </Text>
      </View>
    </View>
  );
}

// ─── Progress bar with shimmer ──────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  const shimmer = useSharedValue(-1);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(2, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(shimmer);
    };
  }, [shimmer]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${shimmer.value * 100}%` as unknown as number }],
  }));

  const clamped = Math.max(0, Math.min(1, value));

  return (
    <View style={progressStyles.track}>
      <View style={[progressStyles.fill, { width: `${clamped * 100}%` }]}>
        <Animated.View style={[progressStyles.shimmer, shimmerStyle]} />
      </View>
    </View>
  );
}

const progressStyles = StyleSheet.create({
  track: {
    width: "100%",
    height: 6,
    backgroundColor: colors.inputBg,
    borderRadius: radius.full,
    overflow: "hidden",
    marginVertical: spacing.lg,
  },
  fill: {
    height: "100%",
    backgroundColor: colors.text,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  shimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "50%",
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.35)",
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  modal: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "stretch",
  },
  kicker: {
    ...fonts.kicker,
    marginBottom: spacing.sm,
  },
  title: {
    ...fonts.title,
    marginBottom: spacing.lg,
  },
  label: {
    ...fonts.body,
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  steps: {
    ...fonts.kicker,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    textAlign: "right",
  },
  subtitle: {
    ...fonts.small,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
