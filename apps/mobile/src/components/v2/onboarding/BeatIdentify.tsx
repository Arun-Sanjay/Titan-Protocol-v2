import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
} from "react-native";
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, fonts, radius } from "../../../theme";
import { playVoiceLineAsync, stopCurrentAudio } from "../../../lib/protocol-audio";

// ─── Props ───────────────────────────────────────────────────────────────────

type Props = {
  onComplete: (name: string) => void;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const PROMPT_TEXT = "IDENTIFY YOURSELF";
const CHAR_DELAY_MS = 50;
const TYPING_START_DELAY = 500;
const CONFIRM_DISPLAY_MS = 1500;
const COMPLETE_DELAY_MS = 2000;
const MIN_NAME_LENGTH = 2;

// ─── Component ───────────────────────────────────────────────────────────────

export function BeatIdentify({ onComplete }: Props) {
  const [typedChars, setTypedChars] = useState(0);
  const [typingDone, setTypingDone] = useState(false);
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Scan line animation for confirmed name
  const scanX = useSharedValue(0);
  const scanOpacity = useSharedValue(0);

  const scanStyle = useAnimatedStyle(() => ({
    position: "absolute" as const,
    left: 0,
    right: 0,
    height: 2,
    top: "50%",
    backgroundColor: colors.body,
    opacity: scanOpacity.value,
    transform: [{ translateX: scanX.value }],
  }));

  // Play voice line on mount
  useEffect(() => {
    playVoiceLineAsync("ONBO-005");
    return () => {
      stopCurrentAudio();
    };
  }, []);

  // Character-by-character typing effect
  useEffect(() => {
    if (typedChars >= PROMPT_TEXT.length) {
      setTypingDone(true);
      return;
    }

    const delay = typedChars === 0 ? TYPING_START_DELAY : CHAR_DELAY_MS;
    const timer = setTimeout(() => {
      setTypedChars((c) => c + 1);
    }, delay);

    return () => clearTimeout(timer);
  }, [typedChars]);

  // Auto-focus input when typing completes
  useEffect(() => {
    if (typingDone) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [typingDone]);

  const handleSubmit = useCallback(() => {
    const trimmed = name.trim();
    if (trimmed.length < MIN_NAME_LENGTH || submitted) return;

    setSubmitted(true);
    playVoiceLineAsync("ONBO-006");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Scan line sweep across the name
    scanOpacity.value = withDelay(
      CONFIRM_DISPLAY_MS * 0.3,
      withSequence(
        withTiming(0.8, { duration: 100 }),
        withTiming(0.8, { duration: 600 }),
        withTiming(0, { duration: 200 }),
      ),
    );
    scanX.value = withDelay(
      CONFIRM_DISPLAY_MS * 0.3,
      withTiming(300, { duration: 800 }),
    );

    // Complete after delay
    setTimeout(() => {
      onComplete(trimmed);
    }, COMPLETE_DELAY_MS);
  }, [name, submitted, onComplete, scanOpacity, scanX]);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        {/* Typing prompt */}
        <Text style={styles.prompt}>
          {PROMPT_TEXT.slice(0, typedChars)}
          {typedChars < PROMPT_TEXT.length && (
            <Text style={styles.cursor}>_</Text>
          )}
        </Text>

        {/* Text input - appears after typing completes */}
        {typingDone && !submitted && (
          <Animated.View
            entering={FadeIn.duration(400)}
            style={styles.inputContainer}
          >
            <TextInput
              ref={inputRef}
              value={name}
              onChangeText={setName}
              style={styles.input}
              autoCapitalize="words"
              autoCorrect={false}
              autoComplete="off"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              selectionColor={colors.body}
              cursorColor={colors.body}
              keyboardAppearance="dark"
            />
            <View style={styles.inputLine} />
          </Animated.View>
        )}

        {/* Confirmed name display */}
        {submitted && (
          <Animated.View
            entering={FadeIn.duration(300)}
            style={styles.confirmedContainer}
          >
            <Text style={styles.confirmedName}>
              {name.trim().toUpperCase()}
            </Text>
            <Animated.View style={scanStyle} />
          </Animated.View>
        )}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  prompt: {
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.80)",
    letterSpacing: 4,
    textAlign: "center",
    marginBottom: spacing["2xl"],
  },
  cursor: {
    color: colors.body,
    fontWeight: "700",
  },
  inputContainer: {
    width: "100%",
    maxWidth: 280,
    alignItems: "center",
  },
  input: {
    width: "100%",
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: 1,
    textAlign: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: 0,
    backgroundColor: "transparent",
  },
  inputLine: {
    width: "100%",
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.30)",
  },
  confirmedContainer: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  confirmedName: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: 3,
    textAlign: "center",
  },
});
