import React, { useEffect } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { colors, fonts } from "../../theme";
import { getDailyQuote } from "../../lib/quotes";

const { width, height } = Dimensions.get("window");

type Props = {
  onDismiss: () => void;
};

export const MotivationalSplash = React.memo(function MotivationalSplash({ onDismiss }: Props) {
  const opacity = useSharedValue(1);
  const textOpacity = useSharedValue(0);
  const quote = getDailyQuote();

  useEffect(() => {
    // Fade in text
    textOpacity.value = withDelay(
      300,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) })
    );

    // Fade out entire splash after 2.5s
    opacity.value = withDelay(
      2500,
      withTiming(0, { duration: 500, easing: Easing.in(Easing.ease) }, () => {
        runOnJS(onDismiss)();
      })
    );
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <Animated.View style={[styles.content, textStyle]}>
        <Text style={styles.quote}>"{quote.text}"</Text>
        <Text style={styles.author}>— {quote.author}</Text>
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
  content: {
    paddingHorizontal: 40,
    alignItems: "center",
  },
  quote: {
    fontSize: 20,
    fontWeight: "300",
    color: colors.text,
    textAlign: "center",
    lineHeight: 32,
    letterSpacing: 0.5,
    fontStyle: "italic",
  },
  author: {
    ...fonts.kicker,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 20,
  },
});
