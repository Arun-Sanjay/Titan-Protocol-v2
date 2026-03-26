import React, { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius } from "../../src/theme";
import { useEngineStore } from "../../src/stores/useEngineStore";
import { XP_REWARDS } from "../../src/stores/useProfileStore";
import type { EngineKey } from "../../src/db/schema";

export default function AddTaskModal() {
  const { engine, kind: initialKind, dateKey } = useLocalSearchParams<{
    engine: string;
    kind: string;
    dateKey: string;
  }>();
  const router = useRouter();
  const addTask = useEngineStore((s) => s.addTask);
  const loadEngine = useEngineStore((s) => s.loadEngine);

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"main" | "secondary">(
    (initialKind as "main" | "secondary") ?? "main"
  );
  const [busy, setBusy] = useState(false);

  const handleAdd = () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    addTask(engine as EngineKey, title.trim(), kind);
    if (dateKey) loadEngine(engine as EngineKey, dateKey);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {kind === "main" ? "New Mission" : "New Side Quest"}
          </Text>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={kind === "main" ? "e.g. Workout" : "e.g. Walk 10k steps"}
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            autoFocus
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />

          <View style={styles.kindToggle}>
            <Pressable
              onPress={() => setKind("main")}
              style={[styles.kindBtn, kind === "main" && styles.kindBtnActive]}
            >
              <Text style={[styles.kindBtnText, kind === "main" && styles.kindBtnTextActive]}>
                Mission (+{XP_REWARDS.MAIN_TASK} XP)
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setKind("secondary")}
              style={[styles.kindBtn, kind === "secondary" && styles.kindBtnActive]}
            >
              <Text style={[styles.kindBtnText, kind === "secondary" && styles.kindBtnTextActive]}>
                Side Quest (+{XP_REWARDS.SIDE_QUEST} XP)
              </Text>
            </Pressable>
          </View>

          <Pressable onPress={handleAdd} style={styles.submit}>
            <Text style={styles.submitText}>Add</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  cancelText: { fontSize: 16, color: colors.primary, fontWeight: "600" },
  body: { padding: spacing.xl, gap: spacing.lg },
  input: {
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
  kindToggle: { flexDirection: "row", gap: spacing.sm },
  kindBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceLight,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  kindBtnActive: { backgroundColor: colors.primaryDim, borderColor: colors.primary + "50" },
  kindBtnText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  kindBtnTextActive: { color: colors.primary },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  submitText: { color: "#000", fontWeight: "700", fontSize: 16 },
});
