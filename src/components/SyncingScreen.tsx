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

/**
 * Generic progress shape shared by backup and restore. A "table" is
 * the current unit of work; `tablesCompleted / tablesTotal` drives the
 * progress counter.
 */
export interface SyncProgress {
  currentTable: string | null;
  tablesCompleted: number;
  tablesTotal: number;
  /** Count of rows moved so far — used for the footer tally. */
  rowsMoved: number;
}

/**
 * Full-screen blocker for manual backup / restore. Pulsing HUD-dot
 * matches the existing cinematic aesthetic. Reanimated handles the
 * loop; cleanup cancels the animation (Android OOM guardrail).
 */
export function SyncingScreen({
  title = "SYNCING",
  subtitle,
  progress,
}: {
  title?: string;
  subtitle?: string;
  progress: SyncProgress;
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
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        <View style={styles.progress}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.progressText}>
            {progress.tablesCompleted} / {progress.tablesTotal} · {pct}%
          </Text>
        </View>
        {progress.currentTable && (
          <Text style={styles.currentTable}>{progress.currentTable}</Text>
        )}
        {progress.rowsMoved > 0 && (
          <Text style={styles.rowCount}>
            {progress.rowsMoved.toLocaleString()} rows
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Error state ────────────────────────────────────────────────────────────

export function SyncingScreenError({
  title = "SYNC FAILED",
  error,
  errorTable,
  onRetry,
  onDismiss,
}: {
  title?: string;
  error: string;
  errorTable?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}): React.ReactElement {
  return (
    <View style={styles.root}>
      <View style={styles.inner}>
        <Text style={[styles.title, { color: colors.danger }]}>{title}</Text>
        <Text style={styles.subtitle}>{friendlyError(error, errorTable)}</Text>
        <View style={styles.buttonRow}>
          {onDismiss && (
            <Pressable style={styles.secondaryButton} onPress={onDismiss}>
              <Text style={styles.secondaryText}>CLOSE</Text>
            </Pressable>
          )}
          {onRetry && (
            <Pressable style={styles.primaryButton} onPress={onRetry}>
              <Text style={styles.primaryText}>RETRY</Text>
            </Pressable>
          )}
        </View>
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
  rowCount: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  primaryButton: {
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 6,
  },
  primaryText: {
    color: colors.primary,
    fontSize: 13,
    letterSpacing: 2,
    fontWeight: "700",
  },
  secondaryButton: {
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 6,
  },
  secondaryText: {
    color: colors.text,
    fontSize: 13,
    letterSpacing: 2,
    fontWeight: "700",
  },
});
