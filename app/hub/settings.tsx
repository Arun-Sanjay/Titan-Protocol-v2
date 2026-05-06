import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  Share,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, fonts } from "../../src/theme";
import { Panel } from "../../src/components/ui/Panel";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { MetricValue } from "../../src/components/ui/MetricValue";
import { storage, setJSON } from "../../src/db/storage";
import { K } from "../../src/db/keys";
import { all as sqliteAll } from "../../src/db/sqlite/client";
import { rowFromSqlite, stripSyncColumns } from "../../src/db/sqlite/coerce";
import { COLUMN_TYPES, SYNCED_TABLES } from "../../src/db/sqlite/column-types";
import type { UserProfile } from "../../src/db/schema";
import { useProfile, useUpdateProfileMode } from "../../src/hooks/queries/useProfile";
// Phase 4.1: legacy engine store removed — React Query auto-fetches engines.
import { useModeStore, type ExperienceMode } from "../../src/stores/useModeStore";
import { useIdentityStore, IDENTITIES, selectIdentityMeta, type Archetype } from "../../src/stores/useIdentityStore";
import { useOnboardingStore, type SchedulePreference } from "../../src/stores/useOnboardingStore";
import { useTitanMode } from "../../src/hooks/queries/useTitanMode";
import { scheduleDailyReminder } from "../../src/lib/notifications";
import { getHapticsEnabled, setHapticsEnabled } from "../../src/lib/haptics";
import { getTodayKey } from "../../src/lib/date";
import { useAuthStore } from "../../src/stores/useAuthStore";
import { supabase } from "../../src/lib/supabase";
import { queryClient } from "../../src/lib/query-client";
import { deleteAllUserData, wipeAllLocalUserData } from "../../src/services/account";
import { logError } from "../../src/lib/error-log";
import { resetProgress } from "../../src/lib/protocol-integrity";
import { upsertProfile } from "../../src/services/profile";
import { profileQueryKey } from "../../src/hooks/queries/useProfile";

// ─── Constants ──────────────────────────────────────────────────────────────

const MONO_FONT = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });
const APP_VERSION = "1.0.0";

// Known storage key prefixes (documentation — export uses getAllKeys())
const BACKUP_PREFIXES = [
  "user_profile",
  "focus_settings",
  "focus_daily:",
  "tasks:",
  "completions:",
  "deep_work_tasks",
  "deep_work_logs",
  "sleep:",
  "weight_entries",
  "weight_goal",
  "nutrition_profile",
  "nutrition_meals:",
  "nutrition_quick_meals",
  "nutrition_water:",
  "nutrition_water_target",
  "budgets",
  "money_txs",
  "money_loans",
  "gym_exercises",
  "gym_templates",
  "gym_template_exercises",
  "gym_sessions",
  "gym_sets",
  "gym_prs",
  "habits",
  "habit_logs:",
  "goals",
  "goal_tasks:",
  "journal:",
  "id_counter",
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function getAllStorageKeys(): string[] {
  return storage.getAllKeys();
}

/**
 * Snapshot every MMKV key into a plain object. Device-local prefs only —
 * sound/voice toggles, cinematic flags, focus-cache scratchpads.
 */
function exportMMKVData(): Record<string, unknown> {
  const keys = getAllStorageKeys();
  const data: Record<string, unknown> = {};
  for (const key of keys) {
    const raw = storage.getString(key);
    if (raw) {
      try {
        data[key] = JSON.parse(raw);
      } catch {
        data[key] = raw;
      }
    }
    // Also check number keys
    const num = storage.getNumber(key);
    if (num !== undefined && !data[key]) {
      data[key] = num;
    }
  }
  return data;
}

/**
 * Pull every user-owned row out of every synced SQLite table. Cloud-
 * shape (booleans coerced back to true/false, JSON parsed) and stripped
 * of sync housekeeping columns, so the export matches what the user
 * would see in the cloud.
 *
 * Until this fix the export only included MMKV — meaning tasks, habits,
 * meals, workouts, finance, journal, sleep, weight, etc. were silently
 * missing. The "backup" was a misnomer.
 */
async function exportSQLiteData(
  userId: string,
): Promise<Record<string, Record<string, unknown>[]>> {
  const out: Record<string, Record<string, unknown>[]> = {};
  for (const table of SYNCED_TABLES) {
    const ownerCol =
      table === "profiles"
        ? "id"
        : COLUMN_TYPES[table]?.user_id
          ? "user_id"
          : null;
    if (!ownerCol) continue;
    const rows = await sqliteAll<Record<string, unknown>>(
      `SELECT * FROM ${table} WHERE _deleted = 0 AND ${ownerCol} = ?`,
      [userId],
    );
    if (rows.length === 0) continue;
    out[table] = rows.map(
      (r) => stripSyncColumns(rowFromSqlite(table, r) as Record<string, unknown>),
    );
  }
  return out;
}

type BackupBundle = {
  version: 2;
  exportedAt: string;
  userId: string | null;
  mmkv: Record<string, unknown>;
  sqlite: Record<string, Record<string, unknown>[]>;
};

// ─── Setting Row Component ───────────────────────────────────────────────────

function SettingRow({
  icon,
  label,
  description,
  onPress,
  color = colors.textSecondary,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  onPress: () => void;
  color?: string;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.settingRow,
        pressed && styles.settingRowPressed,
      ]}
    >
      <View style={[styles.settingIconWrap, { backgroundColor: (danger ? colors.dangerDim : color + "15") }]}>
        <Ionicons name={icon} size={18} color={danger ? colors.danger : color} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingLabel, danger && { color: colors.danger }]}>
          {label}
        </Text>
        {description && (
          <Text style={styles.settingDescription}>{description}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

// ─── V2 Settings ────────────────────────────────────────────────────────────

const MODE_LABELS: Record<ExperienceMode, string> = {
  full_protocol: "Full Protocol",
  structured: "Structured",
  tracker: "Tracker",
  focus: "Focus",
  zen: "Zen",
  titan: "Titan Mode",
};

const SCHEDULE_LABELS: Partial<Record<SchedulePreference, string>> = {
  early_morning: "Early Morning (5-7am)",
  morning: "Morning (7-9am)",
  midday: "Midday (11am-1pm)",
  evening: "Evening (5-8pm)",
  night: "Night (8-11pm)",
};

function V2SettingsSection() {
  const router = useRouter();
  const mode = useModeStore((s) => s.experienceMode);
  const setLocalMode = useModeStore((s) => s.setExperienceMode);
  const setFocusEngines = useModeStore((s) => s.setFocusEngines);
  const focusEngines = useModeStore((s) => s.focusEngines);
  const archetype = useIdentityStore((s) => s.archetype);
  const meta = selectIdentityMeta(archetype);
  // Phase 4.1: cloud-backed titan mode via React Query
  const { data: titanState } = useTitanMode();
  const titanUnlocked = titanState?.unlocked ?? false;
  const schedPref = useOnboardingStore((s) => s.schedulePreference);
  const updateProfileModeMut = useUpdateProfileMode();

  // Persist mode changes to BOTH the local Zustand store and the cloud
  // profile row. Without the cloud write, ProfileHydrator's next pass
  // (or a sign-in on a different device) re-hydrated the OLD value and
  // silently reverted the change.
  const persistModeChange = useCallback(
    (next: ExperienceMode) => {
      setLocalMode(next);
      updateProfileModeMut.mutate({ mode: next });
    },
    [setLocalMode, updateProfileModeMut],
  );

  const handleChangeMode = () => {
    const options: ExperienceMode[] = ["full_protocol", "structured", "tracker", "focus", "zen"];
    if (titanUnlocked) options.push("titan");

    Alert.alert(
      "Change Mode",
      "Select your experience mode.",
      [
        ...options.map((m) => ({
          text: MODE_LABELS[m],
          onPress: () => {
            if (mode === "titan" && m !== "titan") {
              Alert.alert(
                "Leave Titan Mode?",
                "You can always re-activate Titan Mode later.",
                [
                  { text: "Cancel", style: "cancel" as const },
                  { text: "Switch", onPress: () => persistModeChange(m) },
                ],
              );
            } else {
              persistModeChange(m);
            }
          },
        })),
        { text: "Cancel", style: "cancel" },
      ],
    );
  };

  const handleChangeIdentity = () => {
    Alert.alert(
      "Change Identity",
      "This will reset your vote count. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Change",
          onPress: () => {
            const options = IDENTITIES.map((i) => ({
              text: i.meta.name,
              onPress: () => useIdentityStore.getState().changeIdentity(i.key),
            }));
            Alert.alert("Choose Identity", "", [...options, { text: "Cancel", style: "cancel" as const }]);
          },
        },
      ],
    );
  };

  const handleChangeSchedule = () => {
    const options: SchedulePreference[] = ["early_morning", "morning", "midday", "evening", "night"];
    const schedMap: Record<string, { h: number; m: number }> = {
      early_morning: { h: 6, m: 0 }, morning: { h: 8, m: 0 }, midday: { h: 12, m: 0 },
      evening: { h: 18, m: 30 }, night: { h: 21, m: 0 },
    };

    Alert.alert(
      "Protocol Reminder",
      "When should we remind you?",
      [
        ...options.map((p) => ({
          text: SCHEDULE_LABELS[p],
          onPress: () => {
            useOnboardingStore.getState().setSchedulePreference(p);
            const s = schedMap[p];
            scheduleDailyReminder(s.h, s.m);
          },
        })),
        { text: "Cancel", style: "cancel" },
      ],
    );
  };

  return (
    <>
      <SectionHeader title="Experience" />
      <Panel delay={50}>
        <SettingRow
          icon="game-controller-outline"
          label={`Mode: ${MODE_LABELS[mode]}`}
          description="Change your experience mode"
          onPress={handleChangeMode}
          color={mode === "titan" ? "#FFD700" : colors.primary}
        />
        <View style={styles.settingDivider} />
        <SettingRow
          icon={meta?.iconName as any ?? "person-outline"}
          label={meta ? `Identity: ${meta.name}` : "Select Identity"}
          description="Change your archetype"
          onPress={handleChangeIdentity}
          color={colors.mind}
        />
        <View style={styles.settingDivider} />
        <SettingRow
          icon="notifications-outline"
          label={`Reminder: ${schedPref ? SCHEDULE_LABELS[schedPref] : "Not set"}`}
          description="Change protocol reminder time"
          onPress={handleChangeSchedule}
          color={colors.warning}
        />
        <View style={styles.settingDivider} />
        <SettingRow
          icon="phone-portrait-outline"
          label={`Haptics: ${getHapticsEnabled() ? "On" : "Off"}`}
          description="Toggle vibration feedback"
          onPress={() => {
            const current = getHapticsEnabled();
            setHapticsEnabled(!current);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          color={colors.body}
        />
        <View style={styles.settingDivider} />
        <SettingRow
          icon="book-outline"
          label="Replay Tutorial"
          description="Watch the app tutorial again"
          onPress={() => {
            useOnboardingStore.getState().resetTutorial();
            router.push("/tutorial");
          }}
          color={colors.charisma}
        />
      </Panel>
    </>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const router = useRouter();
  // Phase 3.5d: read profile from cloud; keep the legacy best_streak
  // fallback since the display uses `profile.*` fields that exist on
  // both the legacy and cloud shapes once we map them.
  const { data: cloudProfile } = useProfile();
  const profile = useMemo(
    () => ({
      level: cloudProfile?.level ?? 1,
      xp: cloudProfile?.xp ?? 0,
      streak: cloudProfile?.streak_current ?? 0,
      best_streak: cloudProfile?.streak_best ?? 0,
    }),
    [cloudProfile],
  );
  // Phase 4.1: loadAllEngines removed — React Query auto-refetches.
  const [exporting, setExporting] = useState(false);

  const userId = useAuthStore((s) => s.user?.id ?? null);

  const handleExportData = useCallback(async () => {
    setExporting(true);
    try {
      // The backup bundle now wraps both stores so re-importing on a
      // different device or v1.1 build can recover the full state.
      // Previously this only captured MMKV (device-local prefs), which
      // meant tasks / habits / meals / workouts / finance — the
      // entire cloud-backed surface — was silently absent.
      if (!userId) {
        Alert.alert("Sign in required", "Sign in before exporting.");
        setExporting(false);
        return;
      }

      const mmkv = exportMMKVData();
      let sqlite: Record<string, Record<string, unknown>[]> = {};
      try {
        sqlite = await exportSQLiteData(userId);
      } catch (e) {
        logError("settings.exportSQLiteData", e);
        Alert.alert(
          "Partial export",
          "Couldn't read SQLite data. Sharing prefs only.",
        );
      }

      const sqliteRowCount = Object.values(sqlite).reduce(
        (n, rows) => n + rows.length,
        0,
      );
      if (Object.keys(mmkv).length === 0 && sqliteRowCount === 0) {
        Alert.alert("No Data", "Nothing to export yet.");
        setExporting(false);
        return;
      }

      const bundle: BackupBundle = {
        version: 2,
        exportedAt: new Date().toISOString(),
        userId,
        mmkv,
        sqlite,
      };
      const json = JSON.stringify(bundle);
      // Warn if export is very large
      if (json.length > 500000) {
        Alert.alert(
          "Large Backup",
          `Your backup is ${(json.length / 1024).toFixed(0)}KB. Sharing may be slow. Continue?`,
          [
            { text: "Cancel", style: "cancel", onPress: () => setExporting(false) },
            {
              text: "Continue",
              onPress: async () => {
                await Share.share({ message: json, title: "Titan Protocol Backup" });
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setExporting(false);
              },
            },
          ],
        );
        return;
      }
      await Share.share({
        message: json,
        title: "Titan Protocol Backup",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      // User cancelled share — not an error
      logError("settings.handleExportData", e);
    } finally {
      setExporting(false);
    }
  }, [userId]);

  const handleClearAllData = useCallback(() => {
    // Phase 4.2: delete ALL data (cloud + local), keep the auth account.
    // Resets onboarding_completed so the user goes through setup again.
    Alert.alert(
      "Delete All Data",
      "This will permanently delete ALL your data — tasks, habits, sessions, progress, completions — from both your device and the cloud.\n\nYour account stays signed in but you'll go through onboarding again.\n\nThis cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Everything",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Are you sure?",
              "Last chance. All your progress will be permanently lost.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Yes, Delete All",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await deleteAllUserData();
                      setDataPointCount(0);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                      Alert.alert(
                        "Done",
                        "All data has been cleared. You'll restart onboarding now.",
                      );
                      // OnboardingGate will detect onboarding_completed = false
                      // and redirect to CinematicOnboarding on next render.
                    } catch (e) {
                      logError("settings.deleteAllData", e);
                      Alert.alert("Error", "Failed to delete data. Please try again.");
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  }, []);

  const handleResetProfile = useCallback(() => {
    Alert.alert(
      "Reset Profile",
      "This will reset your XP, level, and streak to zero. Tasks and other data will be kept.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            // Phase 1.2: route through setJSON + the K registry instead of
            // a raw storage.set, so the error-log wrapper catches any
            // serialize failure. This button only clears the LOCAL MMKV
            // shadow of the profile — the cloud profile is authoritative
            // and unaffected (a true profile reset would need a cloud
            // mutation that zeroes the profiles row).
            const blank: UserProfile = {
              id: "default",
              xp: 0,
              level: 1,
              streak: 0,
              best_streak: 0,
              last_active_date: "",
            };
            setJSON(K.userProfile, blank);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ],
    );
  }, []);

  // Reset Progress — narrative-progression wipe. Walks the day counter
  // back to 1, zeroes streak/integrity, and clears all cinematic /
  // briefing playback flags so the user's first launch arc plays again.
  // Tasks, habits, completions, journal, weight, sleep, etc. are KEPT —
  // the user is asking to restart the story, not delete their data.
  const handleResetProgress = useCallback(() => {
    Alert.alert(
      "Reset Progress",
      "This rewinds your story to Day 1. Streak, integrity, and cinematic playback all reset. Your tasks, habits, journal, and trackers are kept.\n\nThis cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset to Day 1",
          style: "destructive",
          onPress: async () => {
            try {
              // Local: integrity state, progress_day, story flags,
              // cinematic-played markers, briefing-seen markers.
              resetProgress();
              // Cloud: zero the streak fields and clear first_use_date
              // so HQ shows a fresh start on the next render.
              await upsertProfile({
                streak_current: 0,
                streak_best: 0,
                streak_last_date: null,
                first_use_date: null,
              });
              queryClient.invalidateQueries({ queryKey: profileQueryKey });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              Alert.alert(
                "Reset Complete",
                "You're back on Day 1. Your tasks and trackers are unchanged.",
              );
            } catch (e) {
              logError("settings.resetProgress", e);
              Alert.alert("Error", "Failed to reset progress. Please try again.");
            }
          },
        },
      ],
    );
  }, []);

  const signOut = useAuthStore((s) => s.signOut);

  // Phase 4.2: Sign out handler — clears React Query cache so the next
  // user doesn't see stale data, then calls Supabase signOut which
  // fires SIGNED_OUT via onAuthStateChange → root layout redirects to
  // /(auth)/login.
  const handleSignOut = useCallback(() => {
    Alert.alert(
      "Sign Out",
      "Your cloud data will be preserved. You can sign back in anytime.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          onPress: async () => {
            queryClient.clear();
            await signOut();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ],
    );
  }, [signOut]);

  // Phase 4.2: Full data wipe — clears local MMKV, cloud query cache,
  // and signs out. Cloud profile rows are NOT deleted (only the user
  // or a Supabase admin can do that). This is the production-safe
  // alternative to the DEV-only Danger Zone buttons.
  const handleDeleteAllAndSignOut = useCallback(() => {
    Alert.alert(
      "Delete All Data & Sign Out",
      "This will permanently clear ALL local data (tasks, sessions, habits, progress) and sign you out. Your cloud data will remain unless you contact support.\n\nThis cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete & Sign Out",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Are you sure?",
              "Last chance — all local data will be permanently deleted.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Yes, Delete All",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      storage.clearAll();
                      await wipeAllLocalUserData();
                      queryClient.clear();
                      await signOut();
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    } catch (e) {
                      logError("settings.deleteAllAndSignOut", e);
                      Alert.alert("Error", "Failed to delete local data. Please try again.");
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  }, [signOut]);

  const [dataPointCount, setDataPointCount] = useState(() => getAllStorageKeys().length);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile Summary ── */}
        <SectionHeader title="Profile" />
        <Panel tone="hero" delay={0}>
          <View style={styles.profileRow}>
            <View style={styles.profileAvatarWrap}>
              <Text style={styles.profileAvatarText}>
                {profile.level}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileLevel}>Level {profile.level}</Text>
              <Text style={styles.profileXP}>
                {profile.xp.toLocaleString()} XP
              </Text>
            </View>
            <View style={styles.profileStats}>
              <View style={styles.profileStatItem}>
                <Ionicons name="flame" size={14} color={colors.warning} />
                <Text style={styles.profileStatValue}>{profile.streak}</Text>
              </View>
              <View style={styles.profileStatItem}>
                <Ionicons name="trophy" size={14} color={colors.body} />
                <Text style={styles.profileStatValue}>{profile.best_streak}</Text>
              </View>
            </View>
          </View>
        </Panel>

        {/* ── Experience Mode ── */}
        <V2SettingsSection />

        {/* ── Data ── */}
        <SectionHeader title="Data" />
        <Panel delay={100}>
          <SettingRow
            icon="cloud-download-outline"
            label="Export Data"
            description="Snapshot SQLite tables + device prefs as JSON"
            onPress={handleExportData}
            color={colors.charisma}
          />
          <View style={styles.settingDivider} />
          <SettingRow
            icon="information-circle-outline"
            label="Storage Info"
            description={`${dataPointCount} keys stored locally`}
            onPress={() => {
              Alert.alert(
                "Storage Info",
                `Total keys: ${dataPointCount}\n\nData is stored locally on your device using MMKV. Nothing is sent to any server.`,
              );
            }}
            color={colors.mind}
          />
        </Panel>

        {/* ── Account ── */}
        <SectionHeader title="Account" />
        <Panel delay={150}>
          <SettingRow
            icon="log-out-outline"
            label="Sign Out"
            description="Your cloud data will be preserved"
            onPress={handleSignOut}
            color={colors.textSecondary}
          />
          <View style={styles.settingDivider} />
          <SettingRow
            icon="refresh-circle-outline"
            label="Reset Progress"
            description="Rewind to Day 1; tasks and trackers kept"
            onPress={handleResetProgress}
            color={colors.warning}
          />
          <View style={styles.settingDivider} />
          <SettingRow
            icon="trash-outline"
            label="Delete All Data & Sign Out"
            description="Clear local data and sign out"
            onPress={handleDeleteAllAndSignOut}
            danger
          />
        </Panel>

        {/* ── Danger Zone (DEV ONLY) ── */}
        {/* Phase 1.2: gated behind __DEV__ so production users can't
            wipe their MMKV out from under their cloud profile. The
            "Reset Profile" button only clears the local mirror, and
            "Clear All Data" leaves Supabase intact — both produce a
            confusing half-state if hit by a real user. */}
        {__DEV__ && (
          <>
            <SectionHeader title="Danger Zone (Dev)" />
            <Panel delay={200}>
              <SettingRow
                icon="refresh-outline"
                label="Reset Profile (Local)"
                description="Reset local XP/level/streak mirror; cloud unaffected"
                onPress={handleResetProfile}
                danger
              />
              <View style={styles.settingDivider} />
              <SettingRow
                icon="trash-outline"
                label="Clear All Local Data"
                description="Wipe MMKV; cloud profile remains intact"
                onPress={handleClearAllData}
                danger
              />
            </Panel>
          </>
        )}

        {/* ── About ── */}
        <SectionHeader title="About" />
        <Panel delay={300}>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>App</Text>
            <Text style={styles.aboutValue}>Titan Protocol</Text>
          </View>
          <View style={styles.settingDivider} />
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Version</Text>
            <Text style={[styles.aboutValue, { fontFamily: MONO_FONT }]}>
              {APP_VERSION}
            </Text>
          </View>
          <View style={styles.settingDivider} />
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Storage</Text>
            <Text style={[styles.aboutValue, { fontFamily: MONO_FONT }]}>
              MMKV (local-first)
            </Text>
          </View>
          <View style={styles.settingDivider} />
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Platform</Text>
            <Text style={[styles.aboutValue, { fontFamily: MONO_FONT }]}>
              {Platform.OS} {Platform.Version}
            </Text>
          </View>
        </Panel>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Built with discipline. No cloud. No tracking.
          </Text>
          <Text style={styles.footerText}>Your data stays on your device.</Text>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  body: { flex: 1, paddingHorizontal: spacing.lg },
  bodyContent: { paddingBottom: spacing["5xl"] },

  // Profile
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  profileAvatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryDim,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarText: {
    fontFamily: MONO_FONT,
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },
  profileInfo: { flex: 1 },
  profileLevel: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  profileXP: {
    fontFamily: MONO_FONT,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  profileStats: {
    flexDirection: "row",
    gap: spacing.md,
  },
  profileStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  profileStatValue: {
    fontFamily: MONO_FONT,
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },

  // Setting rows
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  settingRowPressed: { opacity: 0.6 },
  settingIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  settingContent: { flex: 1 },
  settingLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  settingDescription: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  settingDivider: {
    height: 1,
    backgroundColor: colors.panelBorder,
    marginLeft: 48,
  },

  // About
  aboutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  aboutLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  aboutValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },

  // Footer
  footer: {
    alignItems: "center",
    paddingVertical: spacing["3xl"],
    gap: 4,
  },
  footerText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
  },
});
