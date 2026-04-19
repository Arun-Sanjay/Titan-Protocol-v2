import { useCallback, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { getJSON, setJSON } from "../db/storage";
import { colors } from "../theme";
import { backupToCloud, type BackupProgress } from "../sync/backup";
import { restoreFromCloud, type RestoreProgress } from "../sync/restore";
import {
  SyncingScreen,
  SyncingScreenError,
  type SyncProgress,
} from "./SyncingScreen";

const LAST_BACKUP_KEY = "cloud:last_backup_at";

type FlowState =
  | { phase: "idle" }
  | { phase: "backing_up"; progress: BackupProgress }
  | { phase: "restoring"; progress: RestoreProgress }
  | {
      phase: "error";
      title: string;
      error: string;
      errorTable?: string;
    }
  | { phase: "done"; title: string; message: string };

/**
 * Profile-tab section for manually moving data between this device's
 * SQLite store and Supabase. Two buttons, zero automation:
 *   - "Backup to Cloud"  — uploads every row, last-backup timestamp
 *                           stored in MMKV for display.
 *   - "Restore from Cloud" — wipes local data and replaces with the
 *                            cloud snapshot. Confirmed via Alert.
 *
 * Both operations render the existing SyncingScreen full-screen via
 * a modal so the user can't interact during the operation.
 */
export function CloudBackupSection(): React.ReactElement {
  const qc = useQueryClient();
  const [flow, setFlow] = useState<FlowState>({ phase: "idle" });
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() =>
    getJSON<string | null>(LAST_BACKUP_KEY, null),
  );

  const handleBackup = useCallback(async () => {
    setFlow({
      phase: "backing_up",
      progress: {
        currentTable: null,
        tablesCompleted: 0,
        tablesTotal: 0,
        rowsUploaded: 0,
      },
    });
    const res = await backupToCloud((progress) => {
      setFlow({ phase: "backing_up", progress });
    });
    if (res.success) {
      setJSON(LAST_BACKUP_KEY, res.at);
      setLastBackupAt(res.at);
      setFlow({
        phase: "done",
        title: "BACKUP COMPLETE",
        message: `${res.rowsUploaded.toLocaleString()} rows uploaded across ${res.tablesBackedUp} tables.`,
      });
    } else {
      setFlow({
        phase: "error",
        title: "BACKUP FAILED",
        error: res.error,
        errorTable: res.errorTable,
      });
    }
  }, []);

  const handleRestoreConfirmed = useCallback(async () => {
    setFlow({
      phase: "restoring",
      progress: {
        currentTable: null,
        tablesCompleted: 0,
        tablesTotal: 0,
        rowsDownloaded: 0,
      },
    });
    const res = await restoreFromCloud((progress) => {
      setFlow({ phase: "restoring", progress });
    });
    if (res.success) {
      // Every query is now stale — nuke the cache so the UI repopulates.
      await qc.invalidateQueries();
      setFlow({
        phase: "done",
        title: "RESTORE COMPLETE",
        message: `${res.rowsDownloaded.toLocaleString()} rows pulled across ${res.tablesRestored} tables.`,
      });
    } else {
      setFlow({
        phase: "error",
        title: "RESTORE FAILED",
        error: res.error,
        errorTable: res.errorTable,
      });
    }
  }, [qc]);

  const handleRestorePress = useCallback(() => {
    Alert.alert(
      "Restore from cloud?",
      "This will erase every piece of data on this device and replace it with the copy in your Supabase account. Anything you've done since the last backup will be gone. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          style: "destructive",
          onPress: handleRestoreConfirmed,
        },
      ],
    );
  }, [handleRestoreConfirmed]);

  const dismiss = useCallback(() => {
    setFlow({ phase: "idle" });
  }, []);

  const modalVisible = flow.phase !== "idle";
  const progress = toSyncProgress(flow);

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>CLOUD BACKUP</Text>
      <Text style={styles.description}>
        Your data lives on this device. Back up to Supabase any time, or
        restore a backup when you switch devices.
      </Text>

      <View style={styles.meta}>
        <Text style={styles.metaLabel}>Last backup</Text>
        <Text style={styles.metaValue}>{formatBackup(lastBackupAt)}</Text>
      </View>

      <View style={styles.buttonRow}>
        <Pressable style={styles.primaryButton} onPress={handleBackup}>
          <Text style={styles.primaryText}>Backup to Cloud</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={handleRestorePress}>
          <Text style={styles.secondaryText}>Restore from Cloud</Text>
        </Pressable>
      </View>

      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent={false}
        onRequestClose={flow.phase === "idle" ? dismiss : undefined}
      >
        {flow.phase === "backing_up" && progress && (
          <SyncingScreen
            title="BACKING UP"
            subtitle="Uploading your protocol to the cloud"
            progress={progress}
          />
        )}
        {flow.phase === "restoring" && progress && (
          <SyncingScreen
            title="RESTORING"
            subtitle="Pulling your protocol from the cloud"
            progress={progress}
          />
        )}
        {flow.phase === "error" && (
          <SyncingScreenError
            title={flow.title}
            error={flow.error}
            errorTable={flow.errorTable}
            onDismiss={dismiss}
          />
        )}
        {flow.phase === "done" && (
          <DoneScreen
            title={flow.title}
            message={flow.message}
            onDismiss={dismiss}
          />
        )}
      </Modal>
    </View>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function toSyncProgress(flow: FlowState): SyncProgress | null {
  if (flow.phase === "backing_up") {
    return {
      currentTable: flow.progress.currentTable,
      tablesCompleted: flow.progress.tablesCompleted,
      tablesTotal: flow.progress.tablesTotal,
      rowsMoved: flow.progress.rowsUploaded,
    };
  }
  if (flow.phase === "restoring") {
    return {
      currentTable: flow.progress.currentTable,
      tablesCompleted: flow.progress.tablesCompleted,
      tablesTotal: flow.progress.tablesTotal,
      rowsMoved: flow.progress.rowsDownloaded,
    };
  }
  return null;
}

function formatBackup(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Never";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function DoneScreen({
  title,
  message,
  onDismiss,
}: {
  title: string;
  message: string;
  onDismiss: () => void;
}) {
  return (
    <View style={doneStyles.root}>
      <View style={doneStyles.inner}>
        <Text style={doneStyles.title}>{title}</Text>
        <Text style={doneStyles.message}>{message}</Text>
        <Pressable style={doneStyles.button} onPress={onDismiss}>
          <Text style={doneStyles.buttonText}>DONE</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 10,
    padding: 16,
    gap: 12,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  heading: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.8,
  },
  description: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  meta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surfaceBorder,
    paddingTop: 10,
  },
  metaLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  metaValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  buttonRow: {
    gap: 8,
    marginTop: 4,
  },
  primaryButton: {
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  primaryText: {
    color: colors.bg,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  secondaryButton: {
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surfaceBorderStrong,
    alignItems: "center",
  },
  secondaryText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
});

const doneStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  inner: {
    alignItems: "center",
    gap: 12,
    maxWidth: 340,
  },
  title: {
    color: colors.success,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 2.5,
  },
  message: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  button: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 6,
  },
  buttonText: {
    color: colors.primary,
    fontSize: 13,
    letterSpacing: 2,
    fontWeight: "700",
  },
});
