import React, { useRef } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "../../../theme";
import { captureAndShare } from "../../../lib/share";
import { ShareableCard, type ShareCardType } from "./ShareableCard";
import { getTodayKey, formatDateShort } from "../../../lib/date";

type Props = {
  type: ShareCardType;
  title: string;
  subtitle?: string;
  value?: string;
  rarity?: string;
};

/**
 * Secondary share button with hidden ShareableCard for capture.
 * Always appears below the primary action (CLAIM/DONE/DISMISS).
 */
export function ShareButton({ type, title, subtitle, value, rarity }: Props) {
  const cardRef = useRef<View>(null);
  const today = formatDateShort(getTodayKey());

  async function handleShare() {
    await captureAndShare(cardRef);
  }

  return (
    <>
      {/* Hidden shareable card (off-screen for capture) */}
      <View style={styles.hidden} pointerEvents="none">
        <ShareableCard
          ref={cardRef}
          type={type}
          title={title}
          subtitle={subtitle}
          value={value}
          rarity={rarity}
          date={today}
        />
      </View>

      {/* Share button */}
      <Pressable style={styles.button} onPress={handleShare}>
        <Ionicons name="share-outline" size={16} color={colors.textMuted} />
        <Text style={styles.text}>Share</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: "absolute",
    left: -9999,
    top: -9999,
    opacity: 0,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  text: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.textMuted,
  },
});
