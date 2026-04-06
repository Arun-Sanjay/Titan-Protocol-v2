import React from "react";
import { ViewStyle } from "react-native";
import { Panel } from "./Panel";

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  glowColor?: string;
};

// Card is now a thin wrapper around Panel for backwards compat
export const Card = React.memo(function Card({ children, onPress, style, glowColor }: Props) {
  return (
    <Panel onPress={onPress} style={style} glowColor={glowColor}>
      {children}
    </Panel>
  );
});
