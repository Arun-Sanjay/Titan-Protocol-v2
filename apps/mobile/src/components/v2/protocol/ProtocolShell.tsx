import React, { useEffect, useState, useCallback, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, fonts } from "../../../theme";
import { useProtocolStore, PROTOCOL_PHASES, selectPhaseLabel, type ProtocolPhase } from "../../../stores/useProtocolStore";

type Props = {
  children: React.ReactNode;
};

export function ProtocolShell({ children }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const currentPhase = useProtocolStore((s) => s.currentPhase);
  const phaseResults = useProtocolStore((s) => s.phaseResults);

  // Elapsed timer
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  const handleClose = useCallback(() => {
    Alert.alert(
      "Exit Protocol",
      "Your progress will be lost. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Exit", style: "destructive", onPress: () => router.back() },
      ],
    );
  }, [router]);

  const completedPhases = useMemo(() => new Set(phaseResults.map((r) => r.phase)), [phaseResults]);
  const currentIdx = currentPhase ? PROTOCOL_PHASES.indexOf(currentPhase) : -1;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}>
      {/* Top bar: close + phase dots + timer */}
      <View style={styles.topBar}>
        <Pressable onPress={handleClose} hitSlop={16} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </Pressable>

        <View style={styles.dots}>
          {PROTOCOL_PHASES.map((phase, idx) => {
            const isDone = completedPhases.has(phase);
            const isCurrent = idx === currentIdx;
            return (
              <View
                key={phase}
                style={[
                  styles.dot,
                  isDone && styles.dotDone,
                  isCurrent && styles.dotCurrent,
                ]}
              />
            );
          })}
        </View>

        <Text style={styles.timer}>{mm}:{ss}</Text>
      </View>

      {/* Phase label */}
      {currentPhase && (
        <Animated.View entering={FadeIn.duration(300)} style={styles.phaseHeader}>
          <Text style={styles.phaseLabel}>{selectPhaseLabel(currentPhase)}</Text>
        </Animated.View>
      )}

      {/* Content */}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.xl,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  closeBtn: {
    width: 40,
    alignItems: "flex-start",
  },
  dots: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.10)",
  },
  dotDone: {
    backgroundColor: "rgba(255, 255, 255, 0.40)",
  },
  dotCurrent: {
    backgroundColor: colors.primary,
    width: 20,
    borderRadius: 4,
  },
  timer: {
    ...fonts.mono,
    fontSize: 12,
    color: colors.textMuted,
    width: 40,
    textAlign: "right",
  },
  phaseHeader: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  phaseLabel: {
    ...fonts.kicker,
    letterSpacing: 3,
  },
  content: {
    flex: 1,
  },
});
