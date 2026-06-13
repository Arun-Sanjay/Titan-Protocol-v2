import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, fonts, radius, spacing } from "../theme";
import {
  subscribePaywall,
  isPaywallOpen,
  closePaywall,
} from "../lib/paywall";
import { useEntitlement } from "../hooks/queries/useSubscription";
import { useUpdateProfile } from "../hooks/queries/useProfile";
import { startRazorpayCheckout } from "../lib/razorpay";
import { logError } from "../lib/error-log";

/**
 * The trial / paywall modal. Mounted once in the tabs layout so it overlays
 * every authenticated screen. RN port of web's `components/ui/AccessGate.tsx`.
 *
 * - Brand-new user (never started a trial, not subscribed): auto-invites
 *   the 1-day free trial on entry.
 * - Trial expired (no subscription): opened by the paywall bus when a gated
 *   action (completing a task) is attempted — ₹300/month subscribe prompt.
 * - Pro (trial active or subscribed): renders nothing.
 */
export function AccessGate() {
  const ent = useEntitlement();
  const updateProfile = useUpdateProfile();
  const [busOpen, setBusOpen] = useState(isPaywallOpen());
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState<null | "trial" | "pay">(null);

  useEffect(() => subscribePaywall(setBusOpen), []);

  const neverStartedTrial = ent.trialEndsAt === null;
  // Invite a brand-new user (no trial yet, not Pro) on entry, once.
  const inviteOnEntry = !ent.isPro && neverStartedTrial && !dismissed;
  const open = !ent.isPro && (busOpen || inviteOnEntry);

  const handleStartTrial = useCallback(async () => {
    setBusy("trial");
    try {
      await updateProfile.mutateAsync({
        trial_started_at: new Date().toISOString(),
      });
      closePaywall();
      setDismissed(true);
    } catch (e) {
      logError("AccessGate.startTrial", e);
      Alert.alert(
        "Couldn't start the trial",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setBusy(null);
    }
  }, [updateProfile]);

  const handleSubscribe = useCallback(async () => {
    setBusy("pay");
    try {
      await startRazorpayCheckout();
      closePaywall();
      setDismissed(true);
    } catch (e) {
      logError("AccessGate.subscribe", e);
      Alert.alert(
        "Payment failed",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setBusy(null);
    }
  }, []);

  const handleClose = useCallback(() => {
    closePaywall();
    setDismissed(true);
  }, []);

  if (!open) return null;

  const busyAny = busy !== null;

  return (
    <Modal
      transparent
      visible={open}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={busyAny ? undefined : handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Pressable
            onPress={handleClose}
            disabled={busyAny}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>

          <Text style={styles.kicker}>
            {neverStartedTrial ? "WELCOME TO TITAN PROTOCOL" : "TRIAL ENDED"}
          </Text>
          <Text style={styles.title}>
            {neverStartedTrial
              ? "Start your free trial"
              : "Subscribe to keep going"}
          </Text>
          <Text style={styles.body}>
            {neverStartedTrial
              ? "Get the entire system — every engine, habit, journal and tracker — free for 24 hours. No card required."
              : "Your 1-day free trial has ended. Unlock everything again for ₹300/month."}
          </Text>

          <View style={styles.actions}>
            {neverStartedTrial && (
              <Pressable
                onPress={handleStartTrial}
                disabled={busyAny}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                  busyAny && styles.buttonDisabled,
                ]}
              >
                {busy === "trial" ? (
                  <ActivityIndicator color={colors.bg} />
                ) : (
                  <Text style={styles.primaryText}>START 1-DAY FREE TRIAL</Text>
                )}
              </Pressable>
            )}
            <Pressable
              onPress={handleSubscribe}
              disabled={busyAny}
              style={({ pressed }) => [
                neverStartedTrial ? styles.secondaryButton : styles.primaryButton,
                pressed && styles.pressed,
                busyAny && styles.buttonDisabled,
              ]}
            >
              {busy === "pay" ? (
                <ActivityIndicator
                  color={neverStartedTrial ? colors.text : colors.bg}
                />
              ) : (
                <Text
                  style={
                    neverStartedTrial ? styles.secondaryText : styles.primaryText
                  }
                >
                  SUBSCRIBE · {"₹"}300/MONTH
                </Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.finePrint}>
            Secure payment by Razorpay · cancel anytime
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing["2xl"],
    backgroundColor: "rgba(0, 0, 0, 0.85)",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    padding: spacing["2xl"],
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    backgroundColor: colors.surfaceHero,
  },
  closeButton: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  pressed: { opacity: 0.6 },
  kicker: {
    ...fonts.kicker,
    color: colors.warning,
    fontSize: 11,
    letterSpacing: 3,
    marginRight: spacing["2xl"],
  },
  title: {
    ...fonts.title,
    fontSize: 24,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  body: {
    ...fonts.body,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  primaryButton: {
    backgroundColor: colors.text,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  primaryText: {
    ...fonts.kicker,
    color: colors.bg,
    fontSize: 13,
    letterSpacing: 2,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.panelBorderHover,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  secondaryText: {
    ...fonts.kicker,
    color: colors.text,
    fontSize: 13,
    letterSpacing: 2,
  },
  buttonDisabled: { opacity: 0.5 },
  finePrint: {
    ...fonts.small,
    color: colors.textMuted,
    fontSize: 11,
    textAlign: "center",
    marginTop: spacing.lg,
  },
});
