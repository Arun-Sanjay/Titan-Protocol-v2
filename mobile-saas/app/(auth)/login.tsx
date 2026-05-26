import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { colors, spacing, radius, fonts } from "../../src/theme";
import { logError } from "../../src/lib/error-log";
import { supabase } from "../../src/lib/supabase";
import { useAuthStore } from "../../src/stores/useAuthStore";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
// Apple rejects iOS apps that offer Google / Facebook sign-in without
// also offering Sign in with Apple. Until expo-apple-authentication lands
// in a follow-up, suppress the Google button on iOS entirely so we don't
// trip review. Android is fine.
const GOOGLE_CONFIGURED =
  Boolean(GOOGLE_WEB_CLIENT_ID && GOOGLE_ANDROID_CLIENT_ID) &&
  Platform.OS !== "ios";

/**
 * Auth entry — three paths:
 *   1. Continue with Google (hidden until OAuth client IDs land in .env)
 *   2. Sign in with email → /(auth)/email-login
 *   3. Create account → /(auth)/signup
 *
 * Google.useAuthRequest must be called unconditionally and throws synchronously
 * during render if androidClientId is missing on Android, so we pass placeholders
 * when not configured — the button itself is gated by GOOGLE_CONFIGURED so the
 * placeholders never reach promptAsync.
 */
export default function LoginScreen() {
  const router = useRouter();
  const [googleBusy, setGoogleBusy] = useState(false);

  const [, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    androidClientId:
      GOOGLE_ANDROID_CLIENT_ID ?? "placeholder.apps.googleusercontent.com",
    webClientId:
      GOOGLE_WEB_CLIENT_ID ?? "placeholder.apps.googleusercontent.com",
  });

  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type === "success") {
      const idToken = googleResponse.params?.id_token as string | undefined;
      if (!idToken) {
        logError(
          "login.google.no_id_token",
          new Error("OAuth success but no id_token"),
        );
        Alert.alert("Sign-in failed", "Google did not return an ID token.");
        setGoogleBusy(false);
        return;
      }
      (async () => {
        try {
          const { data, error } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token: idToken,
          });
          if (error) throw error;
          if (data.session) {
            useAuthStore.setState({
              session: data.session,
              user: data.session.user,
            });
          }
          return;
        } catch (e) {
          logError("login.google.exchange", e);
          Alert.alert(
            "Sign-in failed",
            "Could not exchange Google credentials.",
          );
        }
        setGoogleBusy(false);
      })();
    } else if (googleResponse.type === "error") {
      logError(
        "login.google.flow",
        new Error(String(googleResponse.error)),
      );
      Alert.alert(
        "Sign-in cancelled",
        "Google sign-in was cancelled or failed.",
      );
      setGoogleBusy(false);
    } else if (
      googleResponse.type === "cancel" ||
      googleResponse.type === "dismiss"
    ) {
      setGoogleBusy(false);
    }
  }, [googleResponse]);

  const handleGoogleSignIn = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!GOOGLE_CONFIGURED) {
      Alert.alert(
        "Google Sign-In not configured",
        "Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID in .env to enable Google. Use email below.",
      );
      return;
    }
    setGoogleBusy(true);
    try {
      await googlePromptAsync();
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
      <View style={styles.content}>
        <Animated.View entering={FadeIn.duration(500)} style={styles.headerBlock}>
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
              <Text style={styles.secondaryButtonText}>
                Sign in with email
              </Text>
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
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: "space-between",
  },
  headerBlock: { marginTop: spacing["4xl"] },
  kicker: {
    ...fonts.kicker,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  title: { ...fonts.title, marginBottom: spacing.md },
  subtitle: {
    ...fonts.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  buttonGroup: { gap: spacing.md, marginBottom: spacing["2xl"] },
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
  primaryButtonText: { ...fonts.caption, color: colors.text, fontSize: 14 },
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
  buttonIcon: { marginRight: spacing.sm },
  buttonPressed: { opacity: 0.7 },
  buttonDisabled: { opacity: 0.5 },
  footer: { alignItems: "center" },
  footerText: {
    ...fonts.small,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 300,
  },
});
