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
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Panel } from "../src/components/ui/Panel";
import {
  useJournalEntries,
  useUpsertJournalEntry,
  useDeleteJournalEntry,
} from "../src/hooks/queries/useJournal";
import { getTodayKey, formatDateDisplay } from "../src/lib/date";
import { logError } from "../src/lib/error-log";
import type { JournalEntry } from "../src/services/journal";

import { colors, fonts, radius, spacing } from "../src/theme";

export default function JournalScreen() {
  const router = useRouter();
  const { data: entries, isLoading } = useJournalEntries();
  const upsert = useUpsertJournalEntry();
  const remove = useDeleteJournalEntry();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingDateKey, setEditingDateKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const sorted = (entries ?? [])
    .slice()
    .sort((a, b) => (b.date_key.localeCompare(a.date_key)));

  const openForToday = useCallback(() => {
    const today = getTodayKey();
    const existing = sorted.find((e) => e.date_key === today);
    setEditingDateKey(today);
    setDraft(existing?.content ?? "");
    setEditorOpen(true);
  }, [sorted]);

  const openForEntry = useCallback((entry: JournalEntry) => {
    setEditingDateKey(entry.date_key);
    setDraft(entry.content ?? "");
    setEditorOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!editingDateKey) return;
    const trimmed = draft.trim();
    if (!trimmed) {
      Alert.alert("Empty entry", "Write something or cancel.");
      return;
    }
    try {
      await upsert.mutateAsync({ dateKey: editingDateKey, content: trimmed });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditorOpen(false);
    } catch (e) {
      logError("journal.save", e);
      Alert.alert("Save failed", "Could not save your entry.");
    }
  }, [editingDateKey, draft, upsert]);

  const handleDelete = useCallback(
    (entry: JournalEntry) => {
      Alert.alert("Delete entry?", `Entry for ${formatDateDisplay(entry.date_key)} will be removed.`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await remove.mutateAsync(entry.id);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            } catch (e) {
              logError("journal.delete", e);
              Alert.alert("Delete failed", "Try again.");
            }
          },
        },
      ]);
    },
    [remove],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>END-OF-DAY REFLECTION</Text>
          <Text style={styles.title}>Journal</Text>
        </View>
        <Pressable
          onPress={openForToday}
          style={({ pressed }) => [
            styles.newButton,
            pressed && styles.pressed,
          ]}
          accessibilityLabel="New entry"
        >
          <Ionicons name="add" size={20} color={colors.text} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.emptyWrap}>
          <Panel>
            <Text style={styles.emptyText}>Loading…</Text>
          </Panel>
        </View>
      ) : sorted.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Panel>
            <Text style={styles.emptyText}>
              No entries yet. Tap + to log today.
            </Text>
          </Panel>
        </View>
      ) : (
        <FlashList
          data={sorted}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openForEntry(item)}
              onLongPress={() => handleDelete(item)}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Panel style={styles.entryCard}>
                <Text style={styles.entryDate}>
                  {formatDateDisplay(item.date_key)}
                </Text>
                <Text style={styles.entryContent} numberOfLines={4}>
                  {item.content}
                </Text>
              </Panel>
            </Pressable>
          )}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        />
      )}

      <EditorSheet
        visible={editorOpen}
        dateKey={editingDateKey}
        value={draft}
        onChangeValue={setDraft}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
        saving={upsert.isPending}
      />
    </SafeAreaView>
  );
}

// ─── Editor bottom sheet ────────────────────────────────────────────────

function EditorSheet({
  visible,
  dateKey,
  value,
  onChangeValue,
  onClose,
  onSave,
  saving,
}: {
  visible: boolean;
  dateKey: string | null;
  value: string;
  onChangeValue: (v: string) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const translateY = useSharedValue(900);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, {
        duration: 280,
        easing: Easing.out(Easing.cubic),
      });
      backdropOpacity.value = withTiming(1, { duration: 220 });
    } else {
      translateY.value = withTiming(900, { duration: 220 });
      backdropOpacity.value = withTiming(0, { duration: 180 });
    }
    return () => {
      cancelAnimation(translateY);
      cancelAnimation(backdropOpacity);
    };
  }, [visible, translateY, backdropOpacity]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable onPress={saving ? undefined : onClose} style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.backdrop, backdropStyle]} />
        </Pressable>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalKav}
          pointerEvents="box-none"
        >
          <Animated.View style={[styles.sheet, sheetStyle]}>
            <View style={styles.handle} />
            <View style={styles.headerRowSheet}>
              <Text style={styles.sheetTitle}>
                {dateKey ? formatDateDisplay(dateKey) : ""}
              </Text>
              <Pressable
                onPress={onClose}
                disabled={saving}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.scrollPad}>
              <TextInput
                value={value}
                onChangeText={onChangeValue}
                placeholder="What happened today? What did you learn?"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                multiline
                editable={!saving}
                autoFocus
                textAlignVertical="top"
              />
            </ScrollView>

            <Pressable
              onPress={onSave}
              disabled={saving}
              style={({ pressed }) => [
                styles.submit,
                pressed && styles.pressed,
                saving && styles.submitDisabled,
              ]}
            >
              {saving ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={styles.submitText}>SAVE</Text>
              )}
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pressed: { opacity: 0.6 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
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
  headerText: { flex: 1, gap: spacing.xs },
  kicker: { ...fonts.kicker, color: colors.textMuted, letterSpacing: 2 },
  title: { ...fonts.title, fontSize: 28, letterSpacing: -0.5 },
  newButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyWrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  emptyText: {
    ...fonts.body,
    color: colors.textSecondary,
    textAlign: "center",
    paddingVertical: spacing.md,
  },
  listContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing["2xl"] },

  entryCard: { padding: spacing.md, gap: spacing.xs },
  entryDate: {
    ...fonts.kicker,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  entryContent: { ...fonts.body, color: colors.text, lineHeight: 20 },

  // Sheet
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.75)" },
  modalKav: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderColor: colors.panelBorder,
    padding: spacing.xl,
    paddingTop: spacing.md,
    maxHeight: "85%",
    gap: spacing.md,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginBottom: spacing.sm,
  },
  headerRowSheet: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: { ...fonts.title, fontSize: 18 },
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
  scrollPad: { flexGrow: 1, minHeight: 200 },
  input: {
    ...fonts.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
    minHeight: 200,
    lineHeight: 22,
  },
  submit: {
    backgroundColor: colors.text,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { ...fonts.kicker, color: colors.bg, fontSize: 13, letterSpacing: 2 },
});
