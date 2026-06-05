import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing } from "../../theme";

type Props = {
  kicker?: string;
  title: string;
  subtitle?: string;
  /** Right-aligned content on the title row (action button, stat). */
  rightSlot?: React.ReactNode;
  /** Override the default router.back() behaviour. */
  onBack?: () => void;
};

/**
 * Full-screen route header: back chevron + kicker + title + optional
 * subtitle + optional right slot. The full-screen analog of PageHeader
 * (which is for tab roots, no back button).
 */
export const ScreenHeader = React.memo(function ScreenHeader({
  kicker,
  title,
  subtitle,
  rightSlot,
  onBack,
}: Props) {
  const router = useRouter();
  const handleBack = onBack ?? (() => router.back());

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          accessibilityLabel="Back"
          hitSlop={6}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.textCol}>
          {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
          <Text style={styles.title}>{title}</Text>
        </View>
        {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.7 },
  textCol: { flex: 1, minWidth: 0, gap: spacing.xs },
  rightSlot: { flexShrink: 0 },
  kicker: { ...fonts.kicker, color: colors.textMuted, letterSpacing: 2 },
  title: { ...fonts.title, fontSize: 28, letterSpacing: -0.5 },
  subtitle: {
    ...fonts.body,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
    marginLeft: 52,
  },
});
