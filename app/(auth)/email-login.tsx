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

/**
 * Phase 3.2: Email sign-in screen.
 *
 * Two modes: password (default) and magic link. The toggle at the bottom
 * switches between them. Magic link uses `signInWithOtp` and the user
 * returns via the deep link handled in app/(auth)/verify.tsx.
 */
type Mode = "password" | "magic-link";

export default function EmailLoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const handleBack = () => {
    Haptics.selectionAsync();
    router.back();
  };

  const toggleMode = () => {
    Haptics.selectionAsync();
    setMode((m) => (m === "password" ? "magic-link" : "password"));
  };

  const handleSubmit = async () => {
    if (busy) return;
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      Alert.alert("Email required", "Enter your email address to continue.");
      return;
    }
    if (mode === "password" && password.length === 0) {
      Alert.alert("Password required", "Enter your password to sign in.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "password") {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (error) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert("Sign-in failed", error.message);
          return;
        }
        // The root layout's onAuthStateChange listener will redirect.
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email: trimmedEmail,
          options: {
            // Use the app scheme so the magic link deep-links into verify.tsx.
            emailRedirectTo: "titan-protocol://auth/verify",
          },
        });
        if (error) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert("Couldn't send link", error.message);
          return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "Check your email",
          `We sent a magic link to ${trimmedEmail}. Tap it to sign in.`,
        );
      }
    } catch (e) {
      logError("email-login.submit", e, { mode });
      Alert.alert("Something went wrong", "Please try again in a moment.");
    } finally {
      setBusy(false);
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
            <Text style={styles.title}>Sign in</Text>
            <Text style={styles.subtitle}>
              {mode === "password"
                ? "Enter your email and password to continue."
                : "We'll send a one-time sign-in link to your email."}
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

            {mode === "password" && (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>PASSWORD</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  editable={!busy}
                />
              </View>
            )}

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
                <Text style={styles.primaryButtonText}>
                  {mode === "password" ? "Sign in" : "Send magic link"}
                </Text>
              )}
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <Pressable onPress={toggleMode} style={styles.toggleButton}>
              <Text style={styles.toggleText}>
                {mode === "password"
                  ? "Prefer a magic link? →"
                  : "Use password instead →"}
              </Text>
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
    marginBottom: spacing.xl,
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
  toggleButton: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  toggleText: {
    ...fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
