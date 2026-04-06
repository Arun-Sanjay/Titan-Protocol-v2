import React from "react";
import Animated, { FadeInDown, Easing } from "react-native-reanimated";

type Props = {
  children: React.ReactNode;
  delay?: number;
};

/**
 * PageTransition — wraps screen content with a fade-in-down entering animation
 * that mirrors the desktop Framer Motion page transition:
 *   Enter: opacity 0, y +8 -> opacity 1, y 0 over 300ms ease-out
 */
export function PageTransition({ children, delay = 0 }: Props) {
  return (
    <Animated.View
      entering={FadeInDown.duration(300)
        .easing(Easing.out(Easing.cubic))
        .delay(delay)}
      style={{ flex: 1 }}
    >
      {children}
    </Animated.View>
  );
}
