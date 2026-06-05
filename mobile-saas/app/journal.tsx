import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ScreenHeader } from "../src/components/ui/ScreenHeader";
import { Panel } from "../src/components/ui/Panel";
import { EditorSheet } from "../src/components/ui/EditorSheet";
import { FieldInput } from "../src/components/ui/FieldInput";
import {
  useJournalEntries,
  useUpsertJournalEntry,
  useDeleteJournalEntry,
} from "../src/hooks/queries/useJournal";
import { getTodayKey, formatDateDisplay } from "../src/lib/date";
import { logError } from "../src/lib/error-log";
import type { JournalEntry } from "../src/services/journal";

import { colors, fonts, spacing } from "../src/theme";

function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export default function JournalScreen() {
  const { data: entries, isLoading } = useJournalEntries();
  const upsert = useUpsertJournalEntry();
  const remove = useDeleteJournalEntry();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingDateKey, setEditingDateKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const sorted = useMemo(
    () => (entries ?? []).slice().sort((a, b) => b.date_key.localeCompare(a.date_key)),
    [entries],
  );

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
      <View style={styles.headerWrap}>
        <ScreenHeader
          kicker="Daily Notes"
          title="Journal"
          rightSlot={
            <Pressable onPress={openForToday} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
              <Ionicons name="add" size={22} color={colors.text} />
            </Pressable>
          }
        />
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
            <Text style={styles.emptyText}>No entries yet. Tap + to log today.</Text>
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
              <Panel tone="subtle" style={styles.entryCard}>
                <View style={styles.entryHead}>
                  <Text style={styles.entryDate}>{formatDateDisplay(item.date_key)}</Text>
                  <Text style={styles.entryWords}>{wordCount(item.content ?? "")} words</Text>
                </View>
                <Text style={styles.entryContent} numberOfLines={3}>
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
        onClose={() => setEditorOpen(false)}
        title={editingDateKey ? formatDateDisplay(editingDateKey) : "Entry"}
        rightSlot={<Text style={styles.wordMeta}>{wordCount(draft)} words</Text>}
        primaryLabel="SAVE"
        onPrimary={handleSave}
        primaryBusy={upsert.isPending}
      >
        <FieldInput
          label="REFLECTION"
          value={draft}
          onChangeText={setDraft}
          placeholder="What happened today? What did you learn?"
          multiline
          autoFocus
          style={styles.editorInput}
        />
      </EditorSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pressed: { opacity: 0.6 },
  headerWrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyWrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  emptyText: {
    ...fonts.body,
    color: colors.textSecondary,
    textAlign: "center",
    paddingVertical: spacing.md,
  },
  listContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing["2xl"] },
  entryCard: { padding: spacing.md, gap: spacing.xs },
  entryHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  entryDate: { ...fonts.kicker, color: colors.textSecondary, fontSize: 10, letterSpacing: 1.5 },
  entryWords: { ...fonts.small, color: colors.textMuted, fontSize: 10 },
  entryContent: { ...fonts.body, color: colors.text, fontSize: 14, lineHeight: 20 },
  editorInput: { minHeight: 220 },
  wordMeta: { ...fonts.small, color: colors.textMuted, fontSize: 11 },
});
