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
import { useAuthStore } from "../../src/stores/useAuthStore";

export default function EmailLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Missing fields", "Enter your email and password.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      if (data.session) {
        useAuthStore.setState({
          session: data.session,
          user: data.session.user,
        });
      }
    } catch (e) {
      logError("email-login.submit", e);
      const message =
        e instanceof Error ? e.message : "Could not sign in.";
      Alert.alert("Sign-in failed", message);
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
            <Text style={styles.kicker}>OPERATOR ACCESS</Text>
            <Text style={styles.title}>Sign in</Text>
          </View>

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

            <View style={styles.field}>
              <Text style={styles.label}>PASSWORD</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                editable={!busy}
              />
            </View>
          </View>

          <View style={styles.buttonGroup}>
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
                <Text style={styles.primaryButtonText}>Sign in</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => router.replace("/(auth)/signup")}
              style={({ pressed }) => [
                styles.ghostButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.ghostButtonText}>
                No account? Create one
              </Text>
            </Pressable>
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
  ghostButton: { alignItems: "center", paddingVertical: spacing.md },
  ghostButtonText: { ...fonts.body, color: colors.textMuted, fontSize: 13 },
  buttonPressed: { opacity: 0.7 },
  buttonDisabled: { opacity: 0.5 },
});
