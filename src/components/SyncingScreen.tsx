import { useEffect } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { colors } from "../theme";
import type { SeedProgress } from "../sync/seed";

/**
 * Full-screen blocker shown during the first-install seed pull. Keeps
 * the UI out of the authenticated routes (OnboardingGate et al) until
 * every SQLite table has been populated from Supabase — otherwise
 * screens would briefly render empty lists with no explanation and
 * users would assume their data was lost.
 *
 * The HUD-style pulsing dot matches the cinematic aesthetic already
 * used by the splash/transmission overlays. Reanimated handles the
 * loop; cleanup cancels the animation (Phase-0 Android OOM guardrail).
 */
export function SyncingScreen({
  progress,
}: {
  progress: SeedProgress;
}): React.ReactElement {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900 }),
        withTiming(0.4, { duration: 900 }),
      ),
      -1,
      true,
    );
    return () => {
      cancelAnimation(opacity);
    };
  }, [opacity]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const pct =
    progress.tablesTotal > 0
      ? Math.floor((progress.tablesCompleted / progress.tablesTotal) * 100)
      : 0;

  return (
    <View style={styles.root}>
      <View style={styles.inner}>
        <View style={styles.dotRow}>
          <Animated.View style={[styles.dot, dotStyle]} />
        </View>
        <Text style={styles.title}>SYNCING YOUR PROTOCOL</Text>
        <Text style={styles.subtitle}>
          Pulling your data from the cloud
        </Text>
        <View style={styles.progress}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.progressText}>
            {progress.tablesCompleted} / {progress.tablesTotal} · {pct}%
          </Text>
        </View>
        {progress.currentTable && (
          <Text style={styles.currentTable}>{progress.currentTable}</Text>
        )}
      </View>
    </View>
  );
}

// ─── Error state ────────────────────────────────────────────────────────────

export function SyncingScreenError({
  error,
  errorTable,
  onRetry,
}: {
  error: string;
  errorTable?: string;
  onRetry: () => void;
}): React.ReactElement {
  return (
    <View style={styles.root}>
      <View style={styles.inner}>
        <Text style={[styles.title, { color: colors.danger }]}>
          SYNC FAILED
        </Text>
        <Text style={styles.subtitle}>
          {friendlyError(error, errorTable)}
        </Text>
        <Pressable style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryText}>RETRY</Text>
        </Pressable>
      </View>
    </View>
  );
}

function friendlyError(error: string, errorTable?: string): string {
  if (error === "auth") {
    return "Your session expired. Sign out and sign back in.";
  }
  if (/network|fetch|offline/i.test(error)) {
    return "Can't reach the server. Check your connection and try again.";
  }
  return errorTable
    ? `Couldn't sync ${errorTable}: ${error}`
    : `Couldn't sync: ${error}`;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  inner: {
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 32,
    maxWidth: 340,
  },
  dotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  title: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 2.5,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  progress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  progressText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  currentTable: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 6,
  },
  retryText: {
    color: colors.primary,
    fontSize: 13,
    letterSpacing: 2,
    fontWeight: "700",
  },
});
