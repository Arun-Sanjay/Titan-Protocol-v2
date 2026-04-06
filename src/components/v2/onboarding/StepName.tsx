import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { useStoryStore } from "../../../stores/useStoryStore";

type Props = { onNext: () => void; onBack: () => void };

export function StepName({ onNext, onBack }: Props) {
  const [name, setName] = useState("");
  const [typingLine, setTypingLine] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const setUserName = useStoryStore((s) => s.setUserName);

  // Terminal typing effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (typingLine < 2) setTypingLine((l) => l + 1);
    }, typingLine === 0 ? 800 : 1200);
    return () => clearTimeout(timer);
  }, [typingLine]);

  const handleConfirm = () => {
    if (!name.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setUserName(name.trim());
    setConfirmed(true);

    // Show acknowledgment then advance
    setTimeout(() => {
      onNext();
    }, 2500);
  };

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        {/* Terminal lines */}
        {typingLine >= 1 && (
          <Animated.Text entering={FadeIn.duration(400)} style={styles.terminalLine}>
            {"> "}PROTOCOL REQUIRES IDENTIFICATION.
          </Animated.Text>
        )}

        {typingLine >= 2 && (
          <Animated.Text entering={FadeIn.duration(400)} style={styles.promptLine}>
            What should Protocol call you?
          </Animated.Text>
        )}

        {/* Name input */}
        {typingLine >= 2 && !confirmed && (
          <Animated.View entering={FadeIn.delay(300).duration(400)} style={styles.inputWrap}>
            <Text style={styles.inputPrefix}>{"> "}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor="rgba(255,255,255,0.2)"
              style={styles.input}
              autoFocus
              autoCapitalize="words"
              autoCorrect={false}
              onSubmitEditing={handleConfirm}
              returnKeyType="done"
            />
          </Animated.View>
        )}

        {/* Confirmation response */}
        {confirmed && (
          <>
            <Animated.Text entering={FadeIn.delay(400).duration(500)} style={styles.ackLine}>
              {"> "}ACKNOWLEDGED, {name.trim().toUpperCase()}.
            </Animated.Text>
            <Animated.Text entering={FadeIn.delay(1200).duration(500)} style={styles.standbyLine}>
              {"> "}STANDBY FOR ASSESSMENT.
            </Animated.Text>
          </>
        )}
      </View>

      {/* Confirm button */}
      {!confirmed && typingLine >= 2 && (
        <Animated.View entering={FadeIn.delay(600).duration(400)}>
          <Pressable
            style={[styles.btn, !name.trim() && styles.btnDisabled]}
            onPress={handleConfirm}
            disabled={!name.trim()}
          >
            <Text style={[styles.btnText, !name.trim() && styles.btnTextDisabled]}>
              CONFIRM
            </Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Back */}
      <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12}>
        <Text style={styles.backText}>{"\u2190"} BACK</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing["3xl"],
    justifyContent: "space-between",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.lg,
  },
  terminalLine: {
    fontFamily: "monospace",
    fontSize: 15,
    color: colors.body,
    letterSpacing: 1,
  },
  promptLine: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginTop: spacing.md,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.20)",
    paddingBottom: spacing.sm,
    marginTop: spacing.md,
  },
  inputPrefix: {
    fontFamily: "monospace",
    fontSize: 18,
    color: colors.body,
  },
  input: {
    flex: 1,
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: 1,
    paddingVertical: spacing.sm,
  },
  ackLine: {
    fontFamily: "monospace",
    fontSize: 14,
    color: colors.body,
    letterSpacing: 1,
    marginTop: spacing.xl,
  },
  standbyLine: {
    fontFamily: "monospace",
    fontSize: 14,
    color: "#FBBF24",
    letterSpacing: 1,
  },
  btn: {
    borderWidth: 1.5,
    borderColor: colors.body,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  btnDisabled: {
    borderColor: "rgba(255,255,255,0.10)",
  },
  btnText: {
    ...fonts.kicker,
    fontSize: 14,
    color: colors.body,
    letterSpacing: 3,
  },
  btnTextDisabled: {
    color: colors.textMuted,
  },
  backBtn: {
    position: "absolute",
    top: spacing.xl,
    left: spacing.xl,
  },
  backText: {
    ...fonts.kicker,
    fontSize: 10,
    color: colors.textMuted,
  },
});
