import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { colors, spacing, radius, fonts } from "../../src/theme";
import { HUDBackground } from "../../src/components/ui/AnimatedBackground";
import { supabase } from "../../src/lib/supabase";
import { logError } from "../../src/lib/error-log";
import { useAuthStore } from "../../src/stores/useAuthStore";
import { trackSignIn } from "../../src/lib/analytics";

/**
 * Phase 3.2: Create-account screen.
 *
 * email + password + confirm. Password rules kept minimal for now
 * (8 chars min) — Supabase auth enforces its own rules server-side,
 * so this is just a UX nicety to avoid a roundtrip.
 *
 * After signup, Supabase returns the session immediately (no email
 * verification required in the default project config). The root
 * layout's onAuthStateChange listener will pick up the new session
 * and redirect to /onboarding.
 */
export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const handleBack = () => {
    Haptics.selectionAsync();
    router.back();
  };

  const handleSubmit = async () => {
    if (busy) return;
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      Alert.alert("Email required", "Enter your email address to continue.");
      return;
    }
    if (password.length < 8) {
      Alert.alert(
        "Password too short",
        "Use at least 8 characters for your password.",
      );
      return;
    }
    if (password !== confirm) {
      Alert.alert("Passwords don't match", "Please re-enter your password.");
      return;
    }

    setBusy(true);
    let succeeded = false;
    try {
      // Phase 4.3: use the session from the signUp response directly
      // instead of calling getSession() separately. The old code had a
      // race condition: getSession() reads from AsyncStorage, which the
      // SDK may not have written to yet, causing a false "check your
      // email" alert even when email verification isn't required.
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });
      if (error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Sign-up failed", error.message);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (data.session) {
        // Email confirmation disabled (default config) — session is
        // available immediately. Update the auth store directly for
        // instant redirect to onboarding.
        useAuthStore.setState({
          session: data.session,
          user: data.session.user,
        });
        trackSignIn({ method: "email" });
        succeeded = true;
      } else {
        // Email confirmation enabled — session is null until the user
        // taps the confirmation link in their email.
        Alert.alert(
          "Check your email",
          `We sent a confirmation link to ${trimmedEmail}. Tap it to finish signing up.`,
        );
      }
    } catch (e) {
      logError("signup.submit", e);
      Alert.alert("Something went wrong", "Please try again in a moment.");
    } finally {
      if (!succeeded) setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <HUDBackground />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Pressable onPress={handleBack} hitSlop={12} style={styles.backButton}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>
          </View>

          <Animated.View
            entering={FadeInDown.duration(400)}
            style={styles.headerBlock}
          >
            <Text style={styles.kicker}>OPERATOR ACCESS</Text>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>
              Start your 365-day transformation. Your protocol syncs across all
              your devices.
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(100).duration(400)}
            style={styles.form}
          >
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>EMAIL</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                editable={!busy}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>PASSWORD</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                editable={!busy}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Re-enter password"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                editable={!busy}
              />
            </View>

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
                <Text style={styles.primaryButtonText}>Create account</Text>
              )}
            </Pressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: spacing.xl,
  },
  header: {
    marginBottom: spacing["3xl"],
  },
  backButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBlock: {
    marginBottom: spacing["2xl"],
  },
  kicker: {
    ...fonts.kicker,
    marginBottom: spacing.sm,
  },
  title: {
    ...fonts.title,
    marginBottom: spacing.md,
  },
  subtitle: {
    ...fonts.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  form: {
    gap: spacing.lg,
  },
  field: {
    gap: spacing.xs,
  },
  fieldLabel: {
    ...fonts.kicker,
    color: colors.textMuted,
  },
  input: {
    ...fonts.body,
    color: colors.text,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceBorderStrong,
    borderWidth: 1,
    borderColor: colors.cardBorderActive,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  primaryButtonText: {
    ...fonts.caption,
    color: colors.text,
    fontSize: 14,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
