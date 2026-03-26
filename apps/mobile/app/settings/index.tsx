import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius } from "../../src/theme";
import { Card } from "../../src/components/ui/Card";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { storage } from "../../src/db/storage";

export default function SettingsScreen() {
  const router = useRouter();
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  const handleExport = () => {
    try {
      const allKeys = storage.getAllKeys();
      const data: Record<string, string> = {};
      for (const key of allKeys) {
        const val = storage.getString(key);
        if (val !== undefined) data[key] = val;
      }
      const json = JSON.stringify(data, null, 2);
      const now = new Date().toISOString().slice(0, 10);
      setLastBackup(now);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Backup Ready",
        `Exported ${allKeys.length} keys (${(json.length / 1024).toFixed(1)} KB). Share feature coming soon.`
      );
    } catch (err) {
      Alert.alert("Error", "Failed to export data.");
    }
  };

  const handleClearData = () => {
    Alert.alert(
      "Clear All Data",
      "This will permanently delete all your data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Everything",
          style: "destructive",
          onPress: () => {
            storage.clearAll();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert("Done", "All data has been cleared. Restart the app.");
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionHeader title="Data" />

        <Pressable onPress={handleExport} style={styles.settingRow}>
          <View>
            <Text style={styles.settingTitle}>Export Backup</Text>
            <Text style={styles.settingDesc}>Save all data as JSON</Text>
          </View>
          <Text style={styles.chevron}>→</Text>
        </Pressable>

        {lastBackup && (
          <Text style={styles.backupDate}>Last backup: {lastBackup}</Text>
        )}

        <SectionHeader title="Danger Zone" />

        <Pressable onPress={handleClearData} style={[styles.settingRow, styles.dangerRow]}>
          <View>
            <Text style={[styles.settingTitle, { color: colors.danger }]}>Clear All Data</Text>
            <Text style={styles.settingDesc}>Permanently delete everything</Text>
          </View>
          <Text style={[styles.chevron, { color: colors.danger }]}>→</Text>
        </Pressable>

        <SectionHeader title="About" />
        <Card>
          <Text style={styles.aboutText}>Titan Protocol v1.0.0</Text>
          <Text style={styles.aboutDesc}>Local-first personal performance OS</Text>
        </Card>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  backBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 24, color: colors.text },
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  dangerRow: { borderColor: colors.danger + "30" },
  settingTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  settingDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  chevron: { fontSize: 18, color: colors.textSecondary },
  backupDate: { fontSize: 12, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xs },
  aboutText: { fontSize: 16, fontWeight: "600", color: colors.text },
  aboutDesc: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs },
});
