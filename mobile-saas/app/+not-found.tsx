import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Link, Stack } from "expo-router";
import { colors, fonts, spacing } from "../src/theme";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "404" }} />
      <View style={styles.container}>
        <Text style={styles.kicker}>SIGNAL LOST</Text>
        <Text style={styles.title}>Route not found</Text>
        <Text style={styles.body}>
          That screen isn&apos;t in the protocol.
        </Text>
        <Link href="/(tabs)" style={styles.link}>
          <Text style={styles.linkText}>Return to HQ</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
    padding: spacing.xl,
  },
  kicker: {
    ...fonts.kicker,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  title: {
    ...fonts.title,
    marginBottom: spacing.md,
  },
  body: {
    ...fonts.body,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  link: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderRadius: 8,
  },
  linkText: {
    ...fonts.caption,
    color: colors.text,
  },
});
