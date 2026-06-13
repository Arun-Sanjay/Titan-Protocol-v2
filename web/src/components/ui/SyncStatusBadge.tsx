/**
 * Live cloud-sync status (audit §5.3). Replaces the settings screen's
 * hard-coded green "Cloud sync active" dot with the real picture: online /
 * offline, pending (queued) + stuck (dead-lettered) change counts, and the
 * last confirmed cloud round-trip.
 */
import { useSyncStatus } from "../../hooks/useSyncStatus";

function relativeTime(ts: number | null): string {
  if (!ts) return "";
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function SyncStatusBadge() {
  const { online, pending, failed, lastSyncAt } = useSyncStatus();

  let color = "var(--status-success, #34d399)";
  let label = "Cloud sync active";

  if (!online) {
    color = "var(--muted, #808080)";
    label =
      pending > 0
        ? `Offline · ${pending} change${pending === 1 ? "" : "s"} will sync on reconnect`
        : "Offline · cached";
  } else if (failed > 0) {
    color = "#ff6b6b";
    label = `${failed} change${failed === 1 ? "" : "s"} need attention`;
  } else if (pending > 0) {
    color = "#fbbf24";
    label = `Syncing ${pending} change${pending === 1 ? "" : "s"}…`;
  } else if (lastSyncAt) {
    label = `Cloud sync active · synced ${relativeTime(lastSyncAt)}`;
  }

  return (
    <div className="mt-3 flex items-center gap-2 text-xs">
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: color,
          boxShadow: `0 0 8px ${color}`,
          display: "inline-block",
          flexShrink: 0,
        }}
      />
      <span className="tp-muted uppercase tracking-widest">{label}</span>
    </div>
  );
}
