import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";

type Props = { onNext: () => void };

export function StepWelcome({ onNext }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.logo}>TITAN</Text>
        <Text style={styles.logoSub}>PROTOCOL</Text>
        <View style={styles.divider} />
        <Text style={styles.tagline}>
          Your performance operating system.{"\n"}Four engines. One mission.
        </Text>
      </View>

      <Pressable
        style={styles.btn}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onNext();
        }}
      >
        <Text style={styles.btnText}>BEGIN SETUP</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing["3xl"] },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  logo: { fontSize: 56, fontWeight: "800", color: colors.text, letterSpacing: 8, textTransform: "uppercase" },
  logoSub: { ...fonts.kicker, fontSize: 14, color: colors.textMuted, letterSpacing: 12, marginTop: spacing.xs },
  divider: { width: 40, height: 1, backgroundColor: "rgba(255,255,255,0.20)", marginVertical: spacing.xl },
  tagline: { fontSize: 15, color: colors.textSecondary, textAlign: "center", lineHeight: 22 },
  btn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.lg, alignItems: "center",
  },
  btnText: { ...fonts.kicker, fontSize: 13, color: "#000", letterSpacing: 2 },
});
