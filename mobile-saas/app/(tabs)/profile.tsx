import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Constants from "expo-constants";

import { Panel } from "../../src/components/ui/Panel";
import { PageHeader } from "../../src/components/ui/PageHeader";
import { useAuthStore } from "../../src/stores/useAuthStore";
import { useThemeStore, type ThemeKey } from "../../src/stores/useThemeStore";
import { useOnboardingStore } from "../../src/stores/useOnboardingStore";
import { useProfile } from "../../src/hooks/queries/useProfile";
import { registerForPushNotifications, clearPushToken } from "../../src/lib/push-token";
import { restoreFromCloud } from "../../src/sync/restore";
import { storage } from "../../src/db/storage";
import { logError } from "../../src/lib/error-log";

import { colors, fonts, radius, spacing } from "../../src/theme";

const THEMES: { key: ThemeKey; label: string; subtitle: string; enabled: boolean }[] = [
  {
    key: "hud",
    label: "BLACK METALLIC",
    subtitle: "Default — high-contrast HUD",
    enabled: true,
  },
  {
    key: "cyberpunk",
    label: "CYBERPUNK",
    subtitle: "Coming after launch",
    enabled: false,
  },
];

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const { data: profile } = useProfile();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const resetOnboarding = useOnboardingStore((s) => s.clearForSignOut);

  const [busy, setBusy] = useState<null | "signout" | "repull" | "wipe">(null);
  const [pushEnabled, setPushEnabled] = useState<boolean>(
    Boolean(profile?.expo_push_token),
  );
  const [devToolsVisible, setDevToolsVisible] = useState(false);
  const versionTapsRef = useRef(0);
  const versionTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const versionLabel = `Version ${Constants.expoConfig?.version ?? "0.1.0"}`;

  const handleSignOut = useCallback(() => {
    Alert.alert("Sign out?", "Your local cache will be wiped.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setBusy("signout");
          try {
            await signOut();
          } catch (e) {
            logError("settings.signOut", e);
            Alert.alert("Sign-out failed", "Try again.");
            setBusy(null);
          }
        },
      },
    ]);
  }, [signOut]);

  const handleTogglePush = useCallback(
    async (next: boolean) => {
      Haptics.selectionAsync();
      if (next) {
        const result = await registerForPushNotifications();
        if (result.status === "granted") {
          setPushEnabled(true);
        } else if (result.status === "denied") {
          Alert.alert(
            "Permission denied",
            "Enable notifications for Titan Protocol in iOS / Android settings.",
          );
        } else if (result.status === "unsupported") {
          Alert.alert(
            "Not supported",
            "Push notifications need a physical device.",
          );
        } else {
          Alert.alert("Could not enable", "See console for details.");
        }
      } else {
        await clearPushToken();
        setPushEnabled(false);
      }
    },
    [],
  );

  const handleReplayOnboarding = useCallback(() => {
    Haptics.selectionAsync();
    resetOnboarding();
    router.replace("/(onboarding)/step-1");
  }, [resetOnboarding, router]);

  const handleVersionTap = useCallback(() => {
    versionTapsRef.current += 1;
    if (versionTapTimerRef.current) clearTimeout(versionTapTimerRef.current);
    versionTapTimerRef.current = setTimeout(() => {
      versionTapsRef.current = 0;
    }, 1500);
    if (versionTapsRef.current >= 5) {
      setDevToolsVisible(true);
      versionTapsRef.current = 0;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, []);

  const handleForceRepull = useCallback(async () => {
    Alert.alert(
      "Force re-pull from cloud?",
      "Re-downloads everything for your account. Your local cache is replaced atomically — a failed pull leaves the existing cache intact.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Re-pull",
          style: "destructive",
          onPress: async () => {
            setBusy("repull");
            try {
              // restoreFromCloud is atomic — it stages every row in memory,
              // then wipes-and-inserts inside a SQLite transaction. A failure
              // mid-flight returns { success: false } without touching the
              // current cache. Pre-wiping defeats that safety and a flaky
              // network would leave the user with no data.
              const res = await restoreFromCloud();
              if (res.success) {
                Alert.alert(
                  "Done",
                  `Rebuilt cache: ${res.rowsDownloaded.toLocaleString()} rows across ${res.tablesRestored} tables.`,
                );
              } else {
                logError("settings.repull.failed", res.error, {
                  errorTable: "errorTable" in res ? res.errorTable : undefined,
                });
                Alert.alert(
                  "Re-pull failed",
                  res.error === "auth"
                    ? "Sign in expired. Sign out and back in, then retry."
                    : `${res.error}${"errorTable" in res && res.errorTable ? ` (table: ${res.errorTable})` : ""}. Your existing cache is intact.`,
                );
              }
            } catch (e) {
              logError("settings.repull.exception", e);
              Alert.alert(
                "Re-pull failed",
                "Unexpected error. Your existing cache is intact.",
              );
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }, []);

  const handleWipeMMKV = useCallback(() => {
    Alert.alert(
      "Clear all device preferences?",
      "Theme, onboarding flags, etc. will reset. Cloud data is untouched.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            try {
              storage.clearAll();
              Alert.alert("Cleared", "Device prefs reset; reopen the app.");
            } catch (e) {
              logError("settings.wipeMmkv", e);
            }
          },
        },
      ],
    );
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <PageHeader kicker="OPERATOR" title="Profile" />

        {/* ─── Appearance ─────────────────────────────────────── */}
        <Section title="APPEARANCE">
          <View style={styles.themeRow}>
            {THEMES.map((t) => {
              const active = theme === t.key;
              return (
                <Pressable
                  key={t.key}
                  disabled={!t.enabled}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setTheme(t.key);
                  }}
                  style={({ pressed }) => [
                    styles.themeCard,
                    active && styles.themeCardActive,
                    !t.enabled && styles.themeCardDisabled,
                    pressed && t.enabled && styles.pressed,
                  ]}
                >
                  {active && (
                    <View style={styles.themeDot}>
                      <Ionicons name="checkmark" size={12} color={colors.bg} />
                    </View>
                  )}
                  <Text
                    style={[
                      styles.themeLabel,
                      !t.enabled && styles.disabledText,
                    ]}
                  >
                    {t.label}
                  </Text>
                  <Text style={styles.themeSub}>{t.subtitle}</Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* ─── Account ─────────────────────────────────────── */}
        <Section title="ACCOUNT">
          <Panel>
            <Text style={styles.kickerSmall}>SIGNED IN AS</Text>
            <Text style={styles.email}>{user?.email ?? "—"}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
              <Text style={styles.statusText}>Cloud sync active</Text>
            </View>
            <Pressable
              onPress={handleSignOut}
              disabled={busy === "signout"}
              style={({ pressed }) => [
                styles.dangerButton,
                pressed && styles.pressed,
                busy === "signout" && styles.buttonDisabled,
              ]}
            >
              {busy === "signout" ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.dangerButtonText}>SIGN OUT</Text>
              )}
            </Pressable>
          </Panel>
        </Section>

        {/* ─── Notifications ─────────────────────────────────────── */}
        <Section title="NOTIFICATIONS">
          <Panel>
            <Row
              label="Push from server"
              subtitle={
                pushEnabled
                  ? "Streak warnings + achievement nudges"
                  : "Enable to receive nudges across devices"
              }
            >
              <Switch
                value={pushEnabled}
                onValueChange={handleTogglePush}
                trackColor={{ false: colors.surface, true: colors.accent }}
                thumbColor={colors.text}
              />
            </Row>
            <Divider />
            <Row
              label="Daily reminders"
              subtitle="Local schedule lifted from Classic — wires post-launch"
            >
              <Text style={styles.comingPill}>M6</Text>
            </Row>
          </Panel>
        </Section>

        {/* ─── Onboarding ─────────────────────────────────────── */}
        <Section title="ONBOARDING">
          <Pressable
            onPress={handleReplayOnboarding}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="play-back-outline"
              size={16}
              color={colors.text}
              style={{ marginRight: spacing.xs }}
            />
            <Text style={styles.secondaryButtonText}>REPLAY ONBOARDING</Text>
          </Pressable>
        </Section>

        {/* ─── App ─────────────────────────────────────── */}
        <Section title="APP">
          <Pressable onPress={handleVersionTap} hitSlop={8}>
            <Panel>
              <Text style={styles.kickerSmall}>BUILD</Text>
              <Text style={styles.versionText}>{versionLabel}</Text>
              {!devToolsVisible && (
                <Text style={styles.devHint}>
                  Tap 5× to reveal developer tools
                </Text>
              )}
            </Panel>
          </Pressable>
        </Section>

        {devToolsVisible && (
          <Section title="DEV TOOLS">
            <Panel>
              <Pressable
                onPress={handleForceRepull}
                disabled={busy === "repull"}
                style={({ pressed }) => [
                  styles.devButton,
                  pressed && styles.pressed,
                ]}
              >
                {busy === "repull" ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text style={styles.devButtonText}>
                    Force re-pull from cloud
                  </Text>
                )}
              </Pressable>
              <Divider />
              <Pressable
                onPress={handleWipeMMKV}
                style={({ pressed }) => [
                  styles.devButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.devButtonText}>Clear MMKV prefs</Text>
              </Pressable>
              <Divider />
              <View style={styles.devRow}>
                <Text style={styles.devLabel}>USER ID</Text>
                <Text style={styles.devValue}>
                  {user?.id?.slice(0, 8) ?? "—"}…
                </Text>
              </View>
            </Panel>
          </Section>
        )}

        <View style={{ height: spacing["2xl"] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({
  label,
  subtitle,
  children,
}: {
  label: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
      </View>
      {children}
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

// ─── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, gap: spacing.lg },
  pressed: { opacity: 0.6 },

  section: { gap: spacing.sm },
  sectionTitle: {
    ...fonts.kicker,
    color: colors.textMuted,
    letterSpacing: 2,
    fontSize: 11,
  },

  // Theme picker
  themeRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  themeCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  themeCardActive: { borderColor: colors.cardBorderActive },
  themeCardDisabled: { opacity: 0.5 },
  themeDot: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  themeLabel: { ...fonts.kicker, color: colors.text, fontSize: 12, letterSpacing: 2 },
  themeSub: { ...fonts.small, color: colors.textMuted, fontSize: 11, lineHeight: 14 },
  disabledText: { color: colors.textMuted },

  // Rows
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { ...fonts.body, color: colors.text, fontSize: 14, fontWeight: "600" },
  rowSub: { ...fonts.small, color: colors.textMuted, fontSize: 11, lineHeight: 14 },
  divider: {
    height: 1,
    backgroundColor: colors.panelBorder,
    marginVertical: spacing.xs,
  },

  // Account
  kickerSmall: { ...fonts.kicker, color: colors.textMuted, fontSize: 10, letterSpacing: 1.5 },
  email: { ...fonts.body, color: colors.text, fontSize: 15, fontWeight: "600", marginTop: spacing.xs },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { ...fonts.small, color: colors.textMuted, fontSize: 11 },
  dangerButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceBorderStrong,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: "center",
  },
  dangerButtonText: { ...fonts.kicker, color: colors.danger, fontSize: 12, letterSpacing: 2 },

  // Secondary
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  secondaryButtonText: { ...fonts.kicker, color: colors.text, fontSize: 11, letterSpacing: 2 },
  buttonDisabled: { opacity: 0.5 },

  // App + dev
  versionText: { ...fonts.body, color: colors.text, fontSize: 14, marginTop: spacing.xs },
  devHint: { ...fonts.small, color: colors.textMuted, fontSize: 10, marginTop: spacing.xs },
  devButton: { paddingVertical: spacing.sm, alignItems: "flex-start" },
  devButtonText: { ...fonts.body, color: colors.text, fontSize: 13 },
  devRow: { paddingVertical: spacing.sm, flexDirection: "row", justifyContent: "space-between" },
  devLabel: { ...fonts.kicker, color: colors.textMuted, fontSize: 10, letterSpacing: 1.5 },
  devValue: { ...fonts.body, color: colors.text, fontSize: 12, fontFamily: "JetBrainsMono_400Regular" },

  // Coming pill
  comingPill: {
    ...fonts.kicker,
    color: colors.textMuted,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    fontSize: 9,
    letterSpacing: 1.5,
  },
});
