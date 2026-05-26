import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { colors, spacing, radius, fonts } from "../../src/theme";

export default function VerifyScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <View style={styles.headerBlock}>
          <View style={styles.iconBox}>
            <Ionicons name="mail-outline" size={28} color={colors.text} />
          </View>
          <Text style={styles.kicker}>TRANSMISSION DISPATCHED</Text>
          <Text style={styles.title}>Check your inbox</Text>
          <Text style={styles.body}>
            We sent a confirmation link to your email. Tap it to activate
            your account, then return here and sign in.
          </Text>
        </View>

        <Pressable
          onPress={() => router.replace("/(auth)/login")}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>Back to sign in</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, padding: spacing.xl, justifyContent: "space-between" },
  headerBlock: { marginTop: spacing["4xl"], gap: spacing.md },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  kicker: { ...fonts.kicker, color: colors.textSecondary },
  title: { ...fonts.title },
  body: {
    ...fonts.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceBorderStrong,
    borderWidth: 1,
    borderColor: colors.cardBorderActive,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    marginBottom: spacing["2xl"],
  },
  primaryButtonText: { ...fonts.caption, color: colors.text, fontSize: 14 },
  buttonPressed: { opacity: 0.7 },
});
