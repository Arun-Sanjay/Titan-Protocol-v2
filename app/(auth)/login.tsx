import React, { useEffect, useState } from "react";
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
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { colors, spacing, radius, fonts } from "../../src/theme";
import { HUDBackground } from "../../src/components/ui/AnimatedBackground";
import { logError } from "../../src/lib/error-log";
import { supabase } from "../../src/lib/supabase";
import { trackSignIn } from "../../src/lib/analytics";

// Phase 7.3: completes the OAuth web-browser session if the deep link
// returns to the app while it's still in the redirect flow. Required
// by expo-auth-session for Android.
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const GOOGLE_CONFIGURED = Boolean(GOOGLE_WEB_CLIENT_ID && GOOGLE_ANDROID_CLIENT_ID);

/**
 * Phase 3.2 / 7.3: Main auth entry screen.
 *
 * Three paths:
 * 1. Continue with Google — one-tap OAuth via expo-auth-session →
 *    supabase.auth.signInWithIdToken. The button is hidden when no
 *    OAuth client ID is configured (EXPO_PUBLIC_GOOGLE_*_CLIENT_ID
 *    env vars), so the app ships cleanly even before the user
 *    populates the credentials in .env.
 * 2. Sign in with email — routes to /(auth)/email-login.
 * 3. Create account — routes to /(auth)/signup.
 *
 * The HUDBackground and visual rhythm match the rest of the app so the
 * login flow feels like part of the protocol, not a bolted-on screen.
 */
export default function LoginScreen() {
  const router = useRouter();
  const [googleBusy, setGoogleBusy] = useState(false);

  // Phase 7.3: Google OAuth request hook. Only initialized when both
  // client IDs are present — otherwise we hide the button entirely.
  const [, googleResponse, googlePromptAsync] = Google.useAuthRequest(
    GOOGLE_CONFIGURED
      ? {
          androidClientId: GOOGLE_ANDROID_CLIENT_ID,
          webClientId: GOOGLE_WEB_CLIENT_ID,
        }
      : { webClientId: "" }, // disabled state — promptAsync won't be called
  );

  // Phase 7.3: handle the OAuth response. On success, exchange the
  // id_token for a Supabase session via signInWithIdToken.
  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type === "success") {
      const idToken = googleResponse.params?.id_token as string | undefined;
      if (!idToken) {
        logError("login.google.no_id_token", new Error("OAuth success but no id_token"));
        Alert.alert("Sign-in failed", "Google did not return an ID token.");
        setGoogleBusy(false);
        return;
      }
      (async () => {
        try {
          const { error } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token: idToken,
          });
          if (error) throw error;
          trackSignIn({ method: "google" });
          // Root layout's auth listener handles the redirect to (tabs).
        } catch (e) {
          logError("login.google.exchange", e);
          Alert.alert("Sign-in failed", "Could not exchange Google credentials.");
        } finally {
          setGoogleBusy(false);
        }
      })();
    } else if (googleResponse.type === "error") {
      logError("login.google.flow", new Error(String(googleResponse.error)));
      Alert.alert("Sign-in cancelled", "Google sign-in was cancelled or failed.");
      setGoogleBusy(false);
    } else if (googleResponse.type === "cancel" || googleResponse.type === "dismiss") {
      setGoogleBusy(false);
    }
  }, [googleResponse]);

  const handleGoogleSignIn = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!GOOGLE_CONFIGURED) {
      Alert.alert(
        "Google Sign-In not configured",
        "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID are not set in .env. Use email sign-in below.",
      );
      return;
    }
    setGoogleBusy(true);
    try {
      await googlePromptAsync();
      // The useEffect above handles the response.
    } catch (e) {
      logError("login.google.prompt", e);
      Alert.alert("Sign-in failed", "Could not open Google sign-in.");
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
          {GOOGLE_CONFIGURED && (
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
          )}

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
