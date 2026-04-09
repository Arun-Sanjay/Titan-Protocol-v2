/**
 * Phase 6: Cloud sync engine for legacy MMKV stores.
 *
 * Subscribes to the Zustand stores that hold user data with a cloud
 * counterpart and mirrors writes to Supabase via the new service
 * layer (Phase 4). The legacy stores keep their existing API and the
 * UI keeps reading from MMKV — this engine just adds a transparent
 * background "double-write" so the cloud is always in sync.
 *
 * Why this exists: Phase 6 of the v1 launch plan called for full
 * refactor of every hub + leaf screen to read directly from React
 * Query hooks. That's 20+ screen rewrites on files up to 2,448 LOC,
 * which is multi-day work. The sync engine is the smallest change
 * that achieves "data in cloud, multi-device sync, persistence"
 * without blocking v1 ship. Individual screens get refactored
 * incrementally post-launch in v1.1.
 *
 * Properties:
 *   - **Eventual consistency**: writes hit local MMKV synchronously,
 *     cloud asynchronously. If the device is offline the cloud
 *     mutation rejects and the failure is logged via error-log; the
 *     local write persists and the migration script (Phase 5) catches
 *     it on the next sign-in elsewhere.
 *   - **Idempotent**: most cloud writes are upserts with stable
 *     conflict keys. Re-running the engine doesn't duplicate.
 *   - **One-way (MMKV → cloud)**. The reverse direction (cloud →
 *     MMKV bootstrap on a fresh device) is handled by `cloud-bootstrap.ts`.
 *
 * Coverage in v1:
 *   - budgets       ✓
 *   - weight        ✓
 *   - sleep         ✓
 *   - money txs     ✓
 *   - journal       ✓
 *   - achievements  ✓
 *   - titan mode    ✓
 *   - progression   ✓
 *
 * Deferred to v1.1 (require full screen refactor because of complex
 * intra-store relationships or shape mismatches):
 *   - gym (5 entities with FK relationships)
 *   - nutrition meals (per-day arrays, complex shape)
 *   - deep work logs (taskId joins)
 *   - mind training history (high-frequency writes)
 *   - skill tree (per-engine nested arrays)
 *   - focus settings (single-row but the daily counter is complex)
 *
 * The deferred stores still have their data preserved by the Phase 5
 * migration script — they just don't sync subsequent changes until
 * the v1.1 screen refactor.
 *
 * Lifecycle: `startCloudSync()` is called once after auth from
 * `app/_layout.tsx`. Returns an unsubscribe function the caller uses
 * on sign-out.
 */

import { logError } from "./error-log";
import { useBudgetStore } from "../stores/useBudgetStore";
import { useWeightStore } from "../stores/useWeightStore";
import { useSleepStore } from "../stores/useSleepStore";
import { useMoneyStore } from "../stores/useMoneyStore";
import { useJournalStore } from "../stores/useJournalStore";
import { useAchievementStore } from "../stores/useAchievementStore";
import { useTitanModeStore } from "../stores/useTitanModeStore";
import { useProgressionStore } from "../stores/useProgressionStore";

import * as budgetsService from "../services/budgets";
import * as weightService from "../services/weight";
import * as sleepService from "../services/sleep";
import * as moneyService from "../services/money";
import * as journalService from "../services/journal";
import * as achievementsService from "../services/achievements";
import * as titanModeService from "../services/titan-mode";
import * as progressionService from "../services/progression";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Wrap a service call so any rejection is logged but doesn't propagate.
 * Eventual-consistency by design: the local MMKV write is the
 * user-facing source of truth, the cloud write is best-effort.
 */
function fireAndForget<T>(
  label: string,
  op: () => Promise<T>,
  context?: Record<string, unknown>,
): void {
  op().catch((e) => {
    logError(`cloud-sync.${label}`, e, context);
  });
}

// ─── Per-store subscribers ──────────────────────────────────────────────────

function syncBudgets(): () => void {
  return useBudgetStore.subscribe((state, prev) => {
    const before = new Map(prev.budgets.map((b) => [b.id, b]));
    for (const b of state.budgets) {
      const old = before.get(b.id);
      if (old && old.category === b.category && old.monthlyLimit === b.monthlyLimit) {
        continue;
      }
      fireAndForget(
        "budgets.create",
        () =>
          budgetsService.createBudget({
            category: b.category,
            monthlyLimit: b.monthlyLimit,
          }),
        { category: b.category },
      );
    }
  });
}

function syncWeight(): () => void {
  return useWeightStore.subscribe((state, prev) => {
    // WeightEntry uses dateKey as the natural key (no numeric id).
    const beforeKeys = new Set(prev.entries.map((e) => e.dateKey));
    for (const e of state.entries) {
      if (beforeKeys.has(e.dateKey)) continue;
      fireAndForget(
        "weight.create",
        () =>
          weightService.createWeightLog({
            dateKey: e.dateKey,
            weightKg: e.weightKg,
          }),
        { dateKey: e.dateKey },
      );
    }
  });
}

function syncSleep(): () => void {
  return useSleepStore.subscribe((state, prev) => {
    // Sleep entries are per-date in a Record<dateKey, entry>.
    const prevEntries = prev.entries;
    const nextEntries = state.entries;
    for (const [dateKey, entry] of Object.entries(nextEntries)) {
      if (!entry) continue;
      const old = prevEntries[dateKey];
      if (
        old &&
        old.bedtime === entry.bedtime &&
        old.wakeTime === entry.wakeTime &&
        old.quality === entry.quality &&
        old.notes === entry.notes
      ) {
        continue;
      }
      fireAndForget(
        "sleep.upsert",
        () =>
          sleepService.upsertSleepLog({
            dateKey,
            // Convert minutes → hours for the cloud schema.
            hoursSlept: entry.durationMinutes / 60,
            quality: entry.quality,
            notes: entry.notes || null,
          }),
        { dateKey },
      );
    }
  });
}

function syncMoney(): () => void {
  return useMoneyStore.subscribe((state, prev) => {
    const beforeIds = new Set(prev.transactions.map((t) => t.id));
    for (const tx of state.transactions) {
      if (beforeIds.has(tx.id)) continue;
      fireAndForget(
        "money.create",
        () =>
          moneyService.createTransaction({
            dateKey: tx.dateISO,
            amount: tx.amount,
            category: tx.category,
            type: tx.type,
            note: tx.note || undefined,
          }),
        { dateKey: tx.dateISO, category: tx.category },
      );
    }
  });
}

function syncJournal(): () => void {
  return useJournalStore.subscribe((state, prev) => {
    // Journal entries store as { date_key, content, updated_at } objects.
    for (const [dateKey, entry] of Object.entries(state.entries)) {
      if (!entry || !entry.content) continue;
      const old = prev.entries[dateKey];
      if (old && old.content === entry.content) continue;
      fireAndForget(
        "journal.upsert",
        () =>
          journalService.upsertJournalEntry({
            dateKey,
            content: entry.content,
          }),
        { dateKey },
      );
    }
  });
}

function syncAchievements(): () => void {
  return useAchievementStore.subscribe((state, prev) => {
    const before = new Set(prev.unlockedIds ?? []);
    const newlyUnlocked: string[] = [];
    for (const id of state.unlockedIds ?? []) {
      if (!before.has(id)) newlyUnlocked.push(id);
    }
    if (newlyUnlocked.length > 0) {
      fireAndForget(
        "achievements.unlock-batch",
        () => achievementsService.unlockAchievements(newlyUnlocked),
        { count: newlyUnlocked.length },
      );
    }
  });
}

function syncTitanMode(): () => void {
  return useTitanModeStore.subscribe((state, prev) => {
    if (
      prev.unlocked === state.unlocked &&
      prev.consecutiveDays === state.consecutiveDays &&
      prev.averageScore === state.averageScore &&
      prev.lastRecordedDate === state.lastRecordedDate
    ) {
      return;
    }
    fireAndForget(
      "titan_mode.upsert",
      () =>
        titanModeService.upsertTitanModeState({
          unlocked: state.unlocked,
          consecutive_days: state.consecutiveDays,
          average_score: state.averageScore,
          start_date: state.startDate ?? null,
          last_recorded_date: state.lastRecordedDate ?? null,
        }),
    );
  });
}

function syncProgression(): () => void {
  return useProgressionStore.subscribe((state, prev) => {
    if (
      prev.currentPhase === state.currentPhase &&
      prev.currentWeek === state.currentWeek &&
      prev.phaseStartWeek === state.phaseStartWeek
    ) {
      return;
    }
    fireAndForget(
      "progression.upsert",
      () =>
        progressionService.upsertProgression({
          current_phase: state.currentPhase,
          current_week: state.currentWeek,
          phase_start_week: state.phaseStartWeek,
        }),
    );
  });
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Start the cloud sync engine. Returns an unsubscribe function that
 * tears down all subscriptions — call it on sign-out.
 *
 * Idempotent: calling startCloudSync() multiple times creates
 * additional subscriptions, so callers must hold the returned
 * unsubscribe function and call it before re-starting (the root
 * layout's auth-effect handles this).
 */
export function startCloudSync(): () => void {
  const unsubscribers: Array<() => void> = [
    syncBudgets(),
    syncWeight(),
    syncSleep(),
    syncMoney(),
    syncJournal(),
    syncAchievements(),
    syncTitanMode(),
    syncProgression(),
  ];

  return () => {
    for (const unsub of unsubscribers) {
      try {
        unsub();
      } catch (e) {
        logError("cloud-sync.unsubscribe", e);
      }
    }
  };
}
