import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing } from "../../theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Right-aligned content on the sheet header (e.g. word count). */
  rightSlot?: React.ReactNode;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryBusy?: boolean;
  children: React.ReactNode;
};

/**
 * Shared bottom-sheet editor shell — animated translateY + backdrop + KAV +
 * handle + header + optional primary button. Extracted from AddTaskSheet's
 * pattern so Journal / Goals / Habits / Focus editors all match.
 */
export function EditorSheet({
  visible,
  onClose,
  title,
  rightSlot,
  primaryLabel,
  onPrimary,
  primaryBusy = false,
  children,
}: Props) {
  const translateY = useSharedValue(800);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
      backdropOpacity.value = withTiming(1, { duration: 220 });
    } else {
      translateY.value = withTiming(800, { duration: 220 });
      backdropOpacity.value = withTiming(0, { duration: 180 });
    }
    return () => {
      cancelAnimation(translateY);
      cancelAnimation(backdropOpacity);
    };
  }, [visible, translateY, backdropOpacity]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable onPress={primaryBusy ? undefined : onClose} style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.backdrop, backdropStyle]} />
        </Pressable>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.kavWrap}
          pointerEvents="box-none"
        >
          <Animated.View style={[styles.sheet, sheetStyle]}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={styles.title}>{title}</Text>
              <View style={styles.headerRight}>
                {rightSlot}
                <Pressable
                  onPress={onClose}
                  disabled={primaryBusy}
                  style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={20} color={colors.text} />
                </Pressable>
              </View>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
              {children}
            </ScrollView>

            {onPrimary ? (
              <Pressable
                onPress={onPrimary}
                disabled={primaryBusy}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                  primaryBusy && styles.buttonDisabled,
                ]}
              >
                {primaryBusy ? (
                  <ActivityIndicator color={colors.bg} />
                ) : (
                  <Text style={styles.primaryText}>{primaryLabel ?? "SAVE"}</Text>
                )}
              </Pressable>
            ) : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.75)" },
  kavWrap: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderColor: colors.panelBorder,
    padding: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.lg,
    maxHeight: "85%",
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginBottom: spacing.sm,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { ...fonts.title, fontSize: 22 },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.6 },
  body: { gap: spacing.lg },
  primaryButton: {
    backgroundColor: colors.text,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  primaryText: { ...fonts.kicker, color: colors.bg, fontSize: 13, letterSpacing: 2 },
  buttonDisabled: { opacity: 0.5 },
});
