import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

import { colors, fonts, radius, spacing } from "../../theme";
import type { EngineKey } from "../../db/schema";
import { useCreateTask } from "../../hooks/queries/useTasks";
import { logError } from "../../lib/error-log";
import { registerForPushNotifications } from "../../lib/push-token";
import { storage } from "../../db/storage";

const PUSH_PROMPTED_KEY = "titan.pushPromptedOnce";

/**
 * Fire-and-forget: ask for push permission after the user's first
 * successful task create. Tracked per-device in MMKV so we ask at most
 * once unprompted; Settings provides a manual toggle for re-asking.
 */
function maybeAskForPush() {
  try {
    if (storage.getBoolean(PUSH_PROMPTED_KEY)) return;
    storage.set(PUSH_PROMPTED_KEY, true);
    void registerForPushNotifications().catch(() => {});
  } catch {
    // Best-effort — MMKV unavailable shouldn't break the task create flow.
  }
}

const ENGINE_OPTIONS: {
  key: EngineKey;
  label: string;
  color: string;
}[] = [
  { key: "body", label: "BODY", color: colors.body },
  { key: "mind", label: "MIND", color: colors.mind },
  { key: "money", label: "MONEY", color: colors.money },
  { key: "charisma", label: "GENERAL", color: colors.charisma },
];

const DAYS_PER_WEEK_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

type Props = {
  visible: boolean;
  onClose: () => void;
  defaultEngine?: EngineKey;
};

export function AddTaskSheet({ visible, onClose, defaultEngine }: Props) {
  const create = useCreateTask();

  const [title, setTitle] = useState("");
  const [engine, setEngine] = useState<EngineKey>(defaultEngine ?? "body");
  const [kind, setKind] = useState<"main" | "secondary">("main");
  const [days, setDays] = useState(7);

  const translateY = useSharedValue(800);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, {
        duration: 280,
        easing: Easing.out(Easing.cubic),
      });
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

  // Reset form whenever the sheet opens fresh.
  useEffect(() => {
    if (visible) {
      setTitle("");
      setEngine(defaultEngine ?? "body");
      setKind("main");
      setDays(7);
    }
  }, [visible, defaultEngine]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleSubmit = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      Alert.alert("Missing title", "Give the mission a name.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await create.mutateAsync({
        title: trimmed,
        engine,
        kind,
        days_per_week: days,
      });
      onClose();
      // First-task-create is the right moment to ask for push permission
      // — the user has signaled they care about staying on top of this.
      maybeAskForPush();
    } catch (e) {
      logError("AddTaskSheet.submit", e);
      const message =
        e instanceof Error ? e.message : "Could not save the mission.";
      Alert.alert("Save failed", message);
    }
  }, [title, engine, kind, days, create, onClose]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          onPress={create.isPending ? undefined : onClose}
          style={StyleSheet.absoluteFill}
        >
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
              <Text style={styles.title}>New Mission</Text>
              <Pressable
                onPress={onClose}
                disabled={create.isPending}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.pressed,
                ]}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>TITLE</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. 30-minute workout"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                editable={!create.isPending}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>ENGINE</Text>
              <View style={styles.optionRow}>
                {ENGINE_OPTIONS.map((opt) => {
                  const active = engine === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setEngine(opt.key);
                      }}
                      style={({ pressed }) => [
                        styles.optionButton,
                        active && { borderColor: opt.color },
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          active && { color: opt.color },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>KIND</Text>
              <View style={styles.optionRow}>
                {(["main", "secondary"] as const).map((k) => {
                  const active = kind === k;
                  return (
                    <Pressable
                      key={k}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setKind(k);
                      }}
                      style={({ pressed }) => [
                        styles.optionButton,
                        styles.kindButton,
                        active && styles.optionButtonActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.kindStars}>
                        {k === "main" ? "★★" : "★"}
                      </Text>
                      <Text
                        style={[
                          styles.optionText,
                          active && { color: colors.text },
                        ]}
                      >
                        {k === "main" ? "MAIN" : "SECONDARY"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>DAYS PER WEEK</Text>
              <View style={styles.daysRow}>
                {DAYS_PER_WEEK_OPTIONS.map((d) => {
                  const active = days === d;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setDays(d);
                      }}
                      style={({ pressed }) => [
                        styles.dayButton,
                        active && styles.dayButtonActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          active && { color: colors.text },
                        ]}
                      >
                        {d}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Pressable
              onPress={handleSubmit}
              disabled={create.isPending}
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.pressed,
                create.isPending && styles.buttonDisabled,
              ]}
            >
              {create.isPending ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.submitText}>CREATE</Text>
              )}
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.75)",
  },
  kavWrap: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderColor: colors.panelBorder,
    padding: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
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
  field: { gap: spacing.xs },
  label: {
    ...fonts.kicker,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1.5,
  },
  input: {
    ...fonts.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
  },
  optionRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  optionButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  optionButtonActive: {
    backgroundColor: colors.surfaceBorderStrong,
    borderColor: colors.cardBorderActive,
  },
  optionText: {
    ...fonts.kicker,
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1.5,
  },
  kindButton: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  kindStars: {
    color: colors.warning,
    fontSize: 14,
  },
  daysRow: { flexDirection: "row", gap: spacing.xs },
  dayButton: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  dayButtonActive: {
    backgroundColor: colors.surfaceBorderStrong,
    borderColor: colors.cardBorderActive,
  },
  dayText: {
    ...fonts.body,
    color: colors.textMuted,
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: colors.text,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  submitText: {
    ...fonts.kicker,
    color: colors.bg,
    fontSize: 13,
    letterSpacing: 2,
  },
  buttonDisabled: { opacity: 0.5 },
});
