import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";

import { colors, spacing, fonts } from "../../src/theme";
import { HUDBackground } from "../../src/components/ui/AnimatedBackground";
import { supabase } from "../../src/lib/supabase";
import { logError } from "../../src/lib/error-log";

/**
 * Phase 3.2: Magic-link deep-link handler.
 *
 * When a user taps a magic link in their email, the OS opens the app
 * via the `titan-protocol://auth/verify` deep link registered in
 * app.json. This screen:
 *
 * 1. Extracts the token_hash / access_token from the URL params
 * 2. Exchanges it for a session via supabase.auth.verifyOtp or the
 *    built-in URL-fragment handling (depending on Supabase project
 *    settings)
 * 3. On success, the root layout's onAuthStateChange handler picks up
 *    the new session and redirects to /onboarding or /(tabs)
 * 4. On failure, shows a friendly error with a "try again" link back
 *    to /(auth)/login
 */
type VerifyStatus = "pending" | "success" | "error";

export default function VerifyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    token_hash?: string;
    type?: string;
    access_token?: string;
    refresh_token?: string;
  }>();
  const [status, setStatus] = useState<VerifyStatus>("pending");
  const [message, setMessage] = useState<string>("Verifying your sign-in link…");

  useEffect(() => {
    (async () => {
      try {
        // Path 1: PKCE / OTP flow — token_hash + type in the query string.
        if (params.token_hash && params.type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: params.token_hash,
            type: params.type as
              | "signup"
              | "magiclink"
              | "email"
              | "recovery"
              | "invite"
              | "email_change",
          });
          if (error) {
            setStatus("error");
            setMessage(error.message);
            return;
          }
          setStatus("success");
          setMessage("Signed in. Redirecting…");
          return;
        }

        // Path 2: Implicit flow — access_token + refresh_token directly.
        if (params.access_token && params.refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          });
          if (error) {
            setStatus("error");
            setMessage(error.message);
            return;
          }
          setStatus("success");
          setMessage("Signed in. Redirecting…");
          return;
        }

        // Neither path fired — no params. Maybe the session was already
        // set by supabase-js (detectSessionInUrl handled it earlier).
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setStatus("success");
          setMessage("Signed in. Redirecting…");
          return;
        }

        setStatus("error");
        setMessage("This sign-in link is missing information. Request a new one.");
      } catch (e) {
        logError("verify.handleLink", e, { params });
        setStatus("error");
        setMessage("Something went wrong verifying your link.");
      }
    })();
  }, [params]);

  const goToLogin = () => {
    router.replace("/(auth)/login");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <HUDBackground />
      <View style={styles.content}>
        <Animated.View
          entering={FadeIn.duration(400)}
          style={styles.messageBlock}
        >
          <Text style={styles.kicker}>
            {status === "error" ? "SIGNAL LOST" : "VERIFYING"}
          </Text>
          <Text style={styles.title}>
            {status === "success"
              ? "Welcome back."
              : status === "error"
                ? "Link invalid"
                : "One moment…"}
          </Text>
          <Text style={styles.subtitle}>{message}</Text>

          {status === "pending" && (
            <ActivityIndicator
              color={colors.text}
              size="large"
              style={styles.spinner}
            />
          )}

          {status === "error" && (
            <Pressable onPress={goToLogin} style={styles.button}>
              <Text style={styles.buttonText}>Back to sign in</Text>
            </Pressable>
          )}
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
    alignItems: "center",
    justifyContent: "center",
  },
  messageBlock: {
    alignItems: "center",
    maxWidth: 360,
  },
  kicker: {
    ...fonts.kicker,
    marginBottom: spacing.sm,
  },
  title: {
    ...fonts.title,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  subtitle: {
    ...fonts.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  spinner: {
    marginTop: spacing["2xl"],
  },
  button: {
    marginTop: spacing["2xl"],
    backgroundColor: colors.surfaceBorderStrong,
    borderWidth: 1,
    borderColor: colors.cardBorderActive,
    borderRadius: 8,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  buttonText: {
    ...fonts.caption,
    color: colors.text,
  },
});
