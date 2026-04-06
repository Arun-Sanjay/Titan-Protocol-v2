import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { colors } from "../../theme";
import { getSessionTransmission, getTransmissionNumber, type TransmissionContext } from "../../lib/transmissions";

const { width, height } = Dimensions.get("window");

type Props = {
  onDismiss: () => void;
  context?: TransmissionContext;
};

export const MotivationalSplash = React.memo(function MotivationalSplash({ onDismiss, context }: Props) {
  const containerOpacity = useSharedValue(1);
  const bootOpacity = useSharedValue(1);
  const messageOpacity = useSharedValue(0);
  const scanLineY = useSharedValue(-2);

  const [transmission] = useState(() => getSessionTransmission(context));
  const [txNumber] = useState(() => getTransmissionNumber());
  const [bootPhase, setBootPhase] = useState(0);

  useEffect(() => {
    // Boot sequence: show lines one by one
    const t1 = setTimeout(() => setBootPhase(1), 200);
    const t2 = setTimeout(() => setBootPhase(2), 500);
    const t3 = setTimeout(() => setBootPhase(3), 800);

    // Fade out boot, fade in transmission
    const t4 = setTimeout(() => {
      bootOpacity.value = withTiming(0, { duration: 300 });
      messageOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) });
    }, 1100);

    // Scan line sweep
    scanLineY.value = withDelay(
      1100,
      withTiming(height, { duration: 800, easing: Easing.linear }),
    );

    // Dismiss after message display
    const t5 = setTimeout(() => {
      containerOpacity.value = withTiming(0, { duration: 500, easing: Easing.in(Easing.ease) }, () => {
        runOnJS(onDismiss)();
      });
    }, 3500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const bootStyle = useAnimatedStyle(() => ({
    opacity: bootOpacity.value,
  }));

  const messageStyle = useAnimatedStyle(() => ({
    opacity: messageOpacity.value,
  }));

  const scanStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLineY.value }],
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* Scan line */}
      <Animated.View style={[styles.scanLine, scanStyle]} />

      {/* Boot sequence */}
      <Animated.View style={[styles.bootContainer, bootStyle]}>
        {bootPhase >= 0 && (
          <Text style={styles.bootText}>&gt; TITAN PROTOCOL v2.1.0</Text>
        )}
        {bootPhase >= 1 && (
          <Text style={styles.bootText}>&gt; CONNECTING TO COMMAND...</Text>
        )}
        {bootPhase >= 2 && (
          <Text style={styles.bootTextSuccess}>&gt; LINK ESTABLISHED</Text>
        )}
        {bootPhase >= 3 && (
          <Text style={styles.bootTextHighlight}>&gt; TRANSMISSION RECEIVED</Text>
        )}
      </Animated.View>

      {/* Transmission message */}
      <Animated.View style={[styles.messageContainer, messageStyle]}>
        <Text style={styles.txLabel}>TRANSMISSION #{txNumber}</Text>
        <View style={styles.divider} />
        <Text style={styles.txMessage}>{transmission}</Text>
        <View style={styles.divider} />
        <Text style={styles.txFooter}>TITAN PROTOCOL // CLASSIFIED</Text>
      </Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    width,
    height,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  scanLine: {
    position: "absolute",
    left: 0,
    width,
    height: 2,
    backgroundColor: "rgba(52, 211, 153, 0.3)",
  },
  bootContainer: {
    position: "absolute",
    top: height * 0.35,
    left: 32,
    right: 32,
  },
  bootText: {
    fontFamily: "monospace",
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  bootTextSuccess: {
    fontFamily: "monospace",
    fontSize: 13,
    color: colors.success,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  bootTextHighlight: {
    fontFamily: "monospace",
    fontSize: 13,
    color: colors.text,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  messageContainer: {
    paddingHorizontal: 32,
    alignItems: "center",
    maxWidth: 340,
  },
  txLabel: {
    fontFamily: "monospace",
    fontSize: 11,
    color: colors.success,
    letterSpacing: 2,
    marginBottom: 12,
  },
  divider: {
    width: 40,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    marginVertical: 12,
  },
  txMessage: {
    fontFamily: "monospace",
    fontSize: 16,
    fontWeight: "300",
    color: colors.text,
    textAlign: "center",
    lineHeight: 26,
    letterSpacing: 0.3,
  },
  txFooter: {
    fontFamily: "monospace",
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 3,
  },
});
