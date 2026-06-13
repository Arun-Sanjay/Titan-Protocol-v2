import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

import { colors, spacing, radius, fonts } from "../../src/theme";
import { logError } from "../../src/lib/error-log";
import { supabase } from "../../src/lib/supabase";

/**
 * Request a password-reset email. The link in the email completes on the
 * WEB app's /auth/reset page (PKCE ?code= → recovery session → new
 * password form) — the phone app doesn't handle the recovery deep link
 * in v1, so the copy tells the user to finish on the web and come back.
 */
// TODO(launch): point at the production web origin once deployed, and add
// it to Supabase Auth → URL Configuration → Redirect URLs.
const WEB_RESET_REDIRECT = "https://titanprotocol.app/#/auth/reset";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert("Missing email", "Enter your account email.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: WEB_RESET_REDIRECT },
      );
      if (error) throw error;
      setSent(true);
    } catch (e) {
      logError("forgot-password.submit", e);
      Alert.alert(
        "Could not send",
        e instanceof Error ? e.message : "Try again in a few minutes.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.content}>
          <Pressable onPress={() => router.back()} style={styles.backRow}>
            <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
            <Text style={styles.backLabel}>Back</Text>
          </Pressable>

          <View style={styles.headerBlock}>
            <Text style={styles.kicker}>ACCOUNT RECOVERY</Text>
            <Text style={styles.title}>Reset password</Text>
          </View>

          {sent ? (
            <View style={styles.sentBlock}>
              <Text style={styles.sentText}>
                If an account exists for {email.trim()}, a reset link is on
                its way. Open it, set a new password on the web, then come
                back here and sign in.
              </Text>
              <Text style={styles.sentHint}>
                Didn't get it? Check spam, or retry in a few minutes — reset
                emails are rate-limited.
              </Text>
            </View>
          ) : (
            <View style={styles.fieldGroup}>
              <View style={styles.field}>
                <Text style={styles.label}>EMAIL</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder="you@protocol.io"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  editable={!busy}
                />
              </View>
            </View>
          )}

          <View style={styles.buttonGroup}>
            {sent ? (
              <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>Back to sign in</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleSubmit}
                disabled={busy}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                  busy && styles.buttonDisabled,
                ]}
              >
                {busy ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text style={styles.primaryButtonText}>Send reset link</Text>
                )}
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, padding: spacing.xl, gap: spacing.xl },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  backLabel: { ...fonts.body, color: colors.textMuted, fontSize: 13 },
  headerBlock: { marginTop: spacing.md },
  kicker: {
    ...fonts.kicker,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  title: { ...fonts.title },
  fieldGroup: { gap: spacing.lg },
  field: { gap: spacing.xs },
  label: {
    ...fonts.kicker,
    fontSize: 10,
    color: colors.textMuted,
  },
  input: {
    ...fonts.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
  },
  sentBlock: { gap: spacing.md },
  sentText: { ...fonts.body, color: colors.text, fontSize: 14, lineHeight: 21 },
  sentHint: {
    ...fonts.small,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  buttonGroup: { gap: spacing.md, marginTop: "auto" },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceBorderStrong,
    borderWidth: 1,
    borderColor: colors.cardBorderActive,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
  },
  primaryButtonText: { ...fonts.caption, color: colors.text, fontSize: 14 },
  buttonPressed: { opacity: 0.7 },
  buttonDisabled: { opacity: 0.5 },
});
