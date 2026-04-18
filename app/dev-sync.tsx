import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../src/theme";
import { useSyncStore } from "../src/sync/store";
import { syncNow } from "../src/sync/engine";
import {
  countPending,
  deleteMutation,
  listPending,
  resetMutation,
  type PendingMutation,
} from "../src/sync/outbox";
import { all, run } from "../src/db/sqlite/client";

/**
 * Dev-only sync debugger. Not linked from nav — reach it by pushing
 * the route manually (`router.push('/dev-sync')`) or from a long-press
 * gesture on the profile avatar (future wire-up).
 *
 * Shows: sync status, last-sync timestamp, outbox contents, per-table
 * cursors. Buttons: sync now, push only, pull only, full refresh,
 * reset per-mutation.
 */
export default function DevSyncScreen() {
  const insets = useSafeAreaInsets();
  const { status, lastSyncAt, lastError, pendingCount } = useSyncStore();
  const [mutations, setMutations] = useState<PendingMutation[]>([]);
  const [cursors, setCursors] = useState<Array<{
    table_name: string;
    last_pulled_at: string | null;
    last_pull_ok: string | null;
  }>>([]);

  const refresh = useCallback(async () => {
    setMutations(await listPending(100));
    setCursors(
      await all(
        `SELECT table_name, last_pulled_at, last_pull_ok
         FROM sync_meta
         ORDER BY table_name`,
      ),
    );
    useSyncStore.getState().setPendingCount(await countPending());
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleSyncNow = async () => {
    await syncNow();
    await refresh();
  };

  const handlePushOnly = async () => {
    await syncNow({ pushOnly: true });
    await refresh();
  };

  const handlePullOnly = async () => {
    await syncNow({ pullOnly: true });
    await refresh();
  };

  const handleFullRefresh = async () => {
    await syncNow({ fullRefresh: true, pullOnly: true });
    await refresh();
  };

  const handleResetCursors = async () => {
    await run(`DELETE FROM sync_meta`);
    await refresh();
  };

  const handleRetryMutation = async (id: string) => {
    await resetMutation(id);
    await refresh();
  };

  const handleDropMutation = async (id: string) => {
    await deleteMutation(id);
    await refresh();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.title}>SYNC — DEV</Text>

      <View style={styles.statusBox}>
        <Row label="Status" value={status} valueColor={statusColor(status)} />
        <Row label="Last sync" value={lastSyncAt ?? "—"} />
        <Row
          label="Last error"
          value={lastError ?? "—"}
          valueColor={lastError ? colors.danger : undefined}
        />
        <Row label="Pending" value={String(pendingCount)} />
      </View>

      <View style={styles.buttonRow}>
        <Button title="Sync now" onPress={handleSyncNow} />
        <Button title="Push" onPress={handlePushOnly} />
        <Button title="Pull" onPress={handlePullOnly} />
        <Button title="Full refresh" onPress={handleFullRefresh} tone="warn" />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInner}>
        <SectionHeader
          title={`Outbox (${mutations.length})`}
          action={pendingCount > 0 ? "Reset cursors" : undefined}
          onAction={handleResetCursors}
        />
        {mutations.length === 0 && (
          <Text style={styles.empty}>No pending mutations.</Text>
        )}
        {mutations.map((m) => (
          <View key={m.id} style={styles.mutationRow}>
            <View style={styles.mutationHeader}>
              <Text style={styles.mutationTitle}>
                {m.op.toUpperCase()} · {m.table_name}
              </Text>
              <Text style={styles.mutationAttempts}>
                attempts: {m.attempts}
              </Text>
            </View>
            <Text style={styles.mutationSub}>row_id: {m.row_id}</Text>
            <Text style={styles.mutationSub}>
              next: {m.next_attempt}
            </Text>
            {m.last_error && (
              <Text style={styles.mutationError}>{m.last_error}</Text>
            )}
            <View style={styles.mutationActions}>
              <SmallButton
                title="Retry"
                onPress={() => handleRetryMutation(m.id)}
              />
              <SmallButton
                title="Drop"
                tone="warn"
                onPress={() => handleDropMutation(m.id)}
              />
            </View>
          </View>
        ))}

        <SectionHeader title={`Cursors (${cursors.length})`} />
        {cursors.length === 0 && (
          <Text style={styles.empty}>No cursors — seed hasn't run yet.</Text>
        )}
        {cursors.map((c) => (
          <View key={c.table_name} style={styles.cursorRow}>
            <Text style={styles.cursorTable}>{c.table_name}</Text>
            <Text style={styles.cursorValue}>
              {c.last_pulled_at ?? "—"}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Presentational helpers ───────────────────────────────────────────────

function Row({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueColor && { color: valueColor }]}>
        {value}
      </Text>
    </View>
  );
}

function Button({
  title,
  onPress,
  tone,
}: {
  title: string;
  onPress: () => void;
  tone?: "warn";
}) {
  return (
    <Pressable
      style={[styles.button, tone === "warn" && styles.buttonWarn]}
      onPress={onPress}
    >
      <Text
        style={[styles.buttonText, tone === "warn" && { color: colors.warning }]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function SmallButton({
  title,
  onPress,
  tone,
}: {
  title: string;
  onPress: () => void;
  tone?: "warn";
}) {
  return (
    <Pressable
      style={[styles.smallButton, tone === "warn" && styles.smallButtonWarn]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.smallButtonText,
          tone === "warn" && { color: colors.warning },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onAction && (
        <Pressable onPress={onAction}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

function statusColor(s: "idle" | "syncing" | "error"): string {
  if (s === "error") return colors.danger;
  if (s === "syncing") return colors.warning;
  return colors.success;
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 16,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  statusBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 8,
    padding: 12,
    gap: 6,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rowLabel: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  rowValue: {
    color: colors.text,
    fontSize: 13,
    maxWidth: "60%",
    textAlign: "right",
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  buttonWarn: {
    borderColor: colors.warningDim,
  },
  buttonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  scroll: {
    flex: 1,
  },
  scrollInner: {
    paddingBottom: 32,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    letterSpacing: 1,
    fontWeight: "700",
  },
  sectionAction: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: "600",
  },
  empty: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: "italic",
    paddingVertical: 8,
  },
  mutationRow: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
    gap: 3,
  },
  mutationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  mutationTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  mutationAttempts: {
    color: colors.textMuted,
    fontSize: 11,
  },
  mutationSub: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  mutationError: {
    color: colors.danger,
    fontSize: 11,
    marginTop: 4,
  },
  mutationActions: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  smallButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  smallButtonWarn: {
    borderColor: colors.warningDim,
  },
  smallButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "600",
  },
  cursorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceBorder,
  },
  cursorTable: {
    color: colors.text,
    fontSize: 12,
  },
  cursorValue: {
    color: colors.textMuted,
    fontSize: 11,
    maxWidth: "60%",
    textAlign: "right",
  },
});
