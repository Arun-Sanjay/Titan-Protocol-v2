import React, { useEffect } from "react";
import { TextStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from "react-native-reanimated";

type Props = {
  value: number;
  decimals?: number;
  suffix?: string;
  style?: TextStyle;
  duration?: number;
};

const AnimatedText = Animated.createAnimatedComponent(
  React.forwardRef<any, any>((props, ref) => {
    const { text, style, ...rest } = props;
    return <Animated.Text ref={ref} style={style} {...rest}>{text}</Animated.Text>;
  })
);

export const AnimatedCounter = React.memo(function AnimatedCounter({
  value,
  decimals = 0,
  suffix = "",
  style,
  duration = 800,
}: Props) {
  const animValue = useSharedValue(0);

  useEffect(() => {
    animValue.value = withTiming(value, {
      duration,
      easing: Easing.bezierFn(0.25, 0.1, 0.25, 1),
    });
  }, [value]);

  const animatedProps = useAnimatedProps(() => {
    const v = animValue.value;
    return {
      text: decimals > 0 ? v.toFixed(decimals) + suffix : Math.round(v) + suffix,
    } as any;
  });

  return (
    <AnimatedText
      style={style}
      animatedProps={animatedProps}
      text={decimals > 0 ? value.toFixed(decimals) + suffix : Math.round(value) + suffix}
    />
  );
});
