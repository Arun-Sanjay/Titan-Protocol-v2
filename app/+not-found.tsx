import { Link, Stack } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../src/theme/colors";
import { fonts } from "../src/theme/typography";
import { spacing } from "../src/theme/spacing";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Route not found", headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.panel}>
          <Text style={styles.kicker}>SIGNAL LOST</Text>
          <Text style={styles.title}>Route not found.</Text>
          <Text style={styles.subtitle}>
            This screen doesn't exist in the protocol. Return to command to
            continue.
          </Text>
          <Link href="/(tabs)" asChild>
            <Text style={styles.link}>RETURN TO COMMAND</Text>
          </Link>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  panel: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: "center",
  },
  kicker: {
    ...fonts.kicker,
    marginBottom: spacing.sm,
  },
  title: {
    ...fonts.title,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  subtitle: {
    ...fonts.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  link: {
    ...fonts.caption,
    color: colors.text,
    backgroundColor: colors.surfaceBorderStrong,
    borderWidth: 1,
    borderColor: colors.cardBorderActive,
    borderRadius: 8,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    textAlign: "center",
    overflow: "hidden",
  },
});
