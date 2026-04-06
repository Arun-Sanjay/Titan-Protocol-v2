import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { colors, spacing, radius, fonts } from "../../src/theme";
import { HUDBackground } from "../../src/components/ui/AnimatedBackground";
import { logError } from "../../src/lib/error-log";

/**
 * Phase 3.2: Main auth entry screen.
 *
 * Three paths:
 * 1. Continue with Google — one-tap for Android (OAuth via expo-auth-session).
 *    Deferred wiring: requires a Google OAuth client ID generated from the
 *    SHA-1 of titan-release.jks. The button is visible but shows a
 *    "coming soon" alert until the client ID is populated in .env.
 * 2. Sign in with email — routes to /(auth)/email-login.
 * 3. Create account — routes to /(auth)/signup.
 *
 * The HUDBackground and visual rhythm match the rest of the app so the
 * login flow feels like part of the protocol, not a bolted-on screen.
 */
export default function LoginScreen() {
  const router = useRouter();
  const [googleBusy, setGoogleBusy] = useState(false);

  const handleGoogleSignIn = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setGoogleBusy(true);
    try {
      // TODO Phase 3.2 follow-up: wire expo-auth-session + Google provider.
      // Needs EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID + EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
      // from a Google Cloud Console OAuth client registered against the
      // SHA-1 fingerprint of titan-release.jks.
      Alert.alert(
        "Coming soon",
        "Google Sign-In is wired but needs its OAuth client ID. For now, use email sign-in below.",
      );
    } catch (e) {
      logError("login.google", e);
      Alert.alert("Sign-in failed", "Something went wrong. Please try again.");
    } finally {
      setGoogleBusy(false);
    }
  };

  const goToEmailLogin = () => {
    Haptics.selectionAsync();
    router.push("/(auth)/email-login");
  };

  const goToSignup = () => {
    Haptics.selectionAsync();
    router.push("/(auth)/signup");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <HUDBackground />
      <View style={styles.content}>
        <Animated.View
          entering={FadeIn.duration(500)}
          style={styles.headerBlock}
        >
          <Text style={styles.kicker}>TITAN PROTOCOL</Text>
          <Text style={styles.title}>OPERATOR ACCESS</Text>
          <Text style={styles.subtitle}>
            Sign in to sync your protocol across devices. Your data stays
            yours — nothing is shared with third parties.
          </Text>
        </Animated.View>

        <View style={styles.buttonGroup}>
          <Animated.View entering={FadeInDown.delay(150).duration(400)}>
            <Pressable
              onPress={handleGoogleSignIn}
              disabled={googleBusy}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
                googleBusy && styles.buttonDisabled,
              ]}
            >
              {googleBusy ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <>
                  <Ionicons
                    name="logo-google"
                    size={18}
                    color={colors.text}
                    style={styles.buttonIcon}
                  />
                  <Text style={styles.primaryButtonText}>
                    Continue with Google
                  </Text>
                </>
              )}
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(250).duration(400)}>
            <Pressable
              onPress={goToEmailLogin}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Ionicons
                name="mail-outline"
                size={18}
                color={colors.text}
                style={styles.buttonIcon}
              />
              <Text style={styles.secondaryButtonText}>Sign in with email</Text>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(350).duration(400)}>
            <Pressable
              onPress={goToSignup}
              style={({ pressed }) => [
                styles.ghostButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.ghostButtonText}>Create account</Text>
            </Pressable>
          </Animated.View>
        </View>

        <Animated.View
          entering={FadeIn.delay(500).duration(400)}
          style={styles.footer}
        >
          <Text style={styles.footerText}>
            By continuing you agree to the Protocol Terms and Privacy Policy.
          </Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: "space-between",
  },
  headerBlock: {
    marginTop: spacing["4xl"],
  },
  kicker: {
    ...fonts.kicker,
    color: colors.textSecondary,
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
  buttonGroup: {
    gap: spacing.md,
    marginBottom: spacing["2xl"],
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceBorderStrong,
    borderWidth: 1,
    borderColor: colors.cardBorderActive,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  primaryButtonText: {
    ...fonts.caption,
    color: colors.text,
    fontSize: 14,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  secondaryButtonText: {
    ...fonts.body,
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  ghostButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
  },
  ghostButtonText: {
    ...fonts.body,
    color: colors.textSecondary,
    fontSize: 14,
  },
  buttonIcon: {
    marginRight: spacing.sm,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  footer: {
    alignItems: "center",
  },
  footerText: {
    ...fonts.small,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 300,
  },
});
