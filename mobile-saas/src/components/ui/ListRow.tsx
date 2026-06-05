import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius } from "../../theme";

type Props = {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  /** Custom left content (overrides the icon box). */
  left?: React.ReactNode;
  /** Custom right content (overrides the chevron). */
  right?: React.ReactNode;
  showChevron?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Web-style list row (rgba(0,0,0,0.84) / radius 12). Rows nest inside
 *  sections; distinct from Panel (the radius-22 container). */
export const ListRow = React.memo(function ListRow({
  title,
  subtitle,
  icon,
  iconColor,
  left,
  right,
  showChevron = true,
  onPress,
  onLongPress,
  disabled,
  style,
}: Props) {
  const body = (
    <>
      {left ?? (icon ? (
        <View style={[styles.iconBox, !disabled && iconColor ? { borderColor: iconColor } : null]}>
          <Ionicons name={icon} size={18} color={disabled ? colors.textMuted : iconColor ?? colors.text} />
        </View>
      ) : null)}
      <View style={styles.textCol}>
        <Text style={[styles.title, disabled && styles.disabled]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress && showChevron && !disabled ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      ) : null)}
    </>
  );

  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled}
        style={({ pressed }) => [styles.row, pressed && styles.pressed, style]}
      >
        {body}
      </Pressable>
    );
  }
  return <View style={[styles.row, style]}>{body}</View>;
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: "rgba(0,0,0,0.84)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  pressed: { opacity: 0.6 },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...fonts.body, color: colors.text, fontSize: 15, fontWeight: "600" },
  disabled: { color: colors.textMuted },
  subtitle: { ...fonts.body, color: colors.textMuted, fontSize: 12, lineHeight: 16 },
});
