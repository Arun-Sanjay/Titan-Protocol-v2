import React, { useState, useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, { FadeIn, SlideInRight, SlideOutLeft } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, fonts } from "../../../theme";
import { useIdentityStore, selectIdentityMeta } from "../../../stores/useIdentityStore";
import { useModeStore, type ExperienceMode } from "../../../stores/useModeStore";

// ─── Slide definitions ──────────────────────────────────────────────────────

type TutorialSlide = {
  id: string;
  title: string;
  description: string;
  icon: string;
  iconColor: string;
  secondaryIcon?: string;
  detail?: string;
  /** Which modes should show this slide */
  modes: ExperienceMode[];
  isLast?: boolean;
};

const ENGINE_DOTS = [
  { label: "Body", color: "#00FF88" },
  { label: "Mind", color: "#A78BFA" },
  { label: "Money", color: "#FBBF24" },
  { label: "Charisma", color: "#60A5FA" },
];

function getAllSlides(identityName: string, primaryEngine: string): TutorialSlide[] {
  return [
    {
      id: "dashboard",
      title: "This is Your Dashboard",
      description: "Everything you need is right here. Your Titan Score shows your daily performance across all engines. The higher you score, the higher your rank \u2014 from D all the way to SS.",
      icon: "speedometer-outline",
      iconColor: colors.primary,
      modes: ["full_protocol", "structured", "tracker", "focus", "zen", "titan"],
    },
    {
      id: "engines",
      title: "Four Areas. One System.",
      description: `Body, Mind, Money, and Charisma \u2014 these are your four engines. Each one tracks different tasks. Your identity (${identityName}) weights ${primaryEngine === "all" ? "all engines equally" : primaryEngine + " as your top priority"}.`,
      icon: "grid-outline",
      iconColor: colors.charisma,
      modes: ["full_protocol", "structured", "tracker", "focus", "zen", "titan"],
    },
    {
      id: "missions",
      title: "Missions Are Your Daily Actions",
      description: "Missions (2 pts) are your main focus. Side Quests (1 pt) are secondary. Tap + to add your own, or accept the suggested missions we've prepared based on your identity.",
      icon: "add-circle-outline",
      iconColor: colors.success,
      detail: "Mission = 2 pts  \u00B7  Side Quest = 1 pt",
      modes: ["full_protocol", "structured", "tracker", "focus", "zen", "titan"],
    },
    {
      id: "protocol",
      title: "Your Daily Protocol",
      description: "A 3-minute guided session each morning. Set your intention, do a quick mind exercise, check your habits, and get your daily score. This is the heartbeat of Titan Protocol.",
      icon: "play-circle-outline",
      iconColor: colors.mind,
      detail: "3 MIN",
      modes: ["full_protocol", "structured", "titan"],
    },
    {
      id: "streaks",
      title: "Consistency Gets Rewarded",
      description: "Every day you show up earns XP and extends your streak. Level up to unlock boss challenges. Your streak is your proof of commitment \u2014 don't break the chain.",
      icon: "flame-outline",
      iconColor: colors.warning,
      secondaryIcon: "flash-outline",
      modes: ["full_protocol", "structured", "tracker", "focus", "titan"],
    },
    {
      id: "skills",
      title: "Level Up Your Skills",
      description: "Each engine has a skill tree showing your mastery progression. Weekly quests give you clear objectives. Boss challenges test everything you've learned.",
      icon: "git-branch-outline",
      iconColor: colors.body,
      secondaryIcon: "trophy-outline",
      modes: ["full_protocol", "structured", "titan"],
    },
    {
      id: "zen_experience",
      title: "Your Zen Experience",
      description: "No scores, no competition. Just your habits, journal, and a daily intention. This is a space for mindful practice without pressure. Show up, reflect, grow.",
      icon: "water-outline",
      iconColor: colors.mind,
      modes: ["zen"],
    },
    {
      id: "focus_note",
      title: "Only Your Engines",
      description: "You've chosen Focus mode. Only the engines you selected are visible \u2014 everything else is completely hidden. You can change which engines are active anytime in Settings.",
      icon: "eye-outline",
      iconColor: colors.charisma,
      modes: ["focus"],
    },
    {
      id: "ready",
      title: "Let's Begin",
      description: "Your engines are configured. Your first suggested missions are ready. Open any engine and start completing tasks \u2014 or tap 'Start Protocol' for your first guided session.",
      icon: "rocket-outline",
      iconColor: colors.success,
      modes: ["full_protocol", "structured", "tracker", "focus", "zen", "titan"],
      isLast: true,
    },
  ];
}

// ─── Tutorial Component ─────────────────────────────────────────────────────

type Props = {
  onComplete: () => void;
};

export function Tutorial({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const [currentSlide, setCurrentSlide] = useState(0);

  const archetype = useIdentityStore((s) => s.archetype);
  const meta = selectIdentityMeta(archetype);
  const experienceMode = useModeStore((s) => s.experienceMode);

  const slides = useMemo(() => {
    const all = getAllSlides(
      meta?.name ?? "your identity",
      meta?.primaryEngine ?? "all",
    );
    return all.filter((s) => s.modes.includes(experienceMode));
  }, [meta, experienceMode]);

  const slide = slides[currentSlide];
  const isLast = currentSlide === slides.length - 1;

  function handleNext() {
    if (isLast) {
      onComplete();
    } else {
      setCurrentSlide((c) => c + 1);
    }
  }

  function handleSkip() {
    onComplete();
  }

  if (!slide) {
    onComplete();
    return null;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      {/* Skip button */}
      <Pressable onPress={handleSkip} style={styles.skipBtn}>
        <Text style={styles.skipText}>Skip Tutorial</Text>
      </Pressable>

      {/* Slide content */}
      <Animated.View
        key={slide.id}
        entering={SlideInRight.duration(300)}
        exiting={SlideOutLeft.duration(200)}
        style={styles.slideContent}
      >
        {/* Icon area */}
        <View style={styles.iconArea}>
          <View style={[styles.iconCircle, { borderColor: slide.iconColor + "40" }]}>
            <Ionicons
              name={slide.icon as keyof typeof Ionicons.glyphMap}
              size={56}
              color={slide.iconColor}
            />
          </View>
          {slide.secondaryIcon && (
            <View style={styles.secondaryIcon}>
              <Ionicons
                name={slide.secondaryIcon as keyof typeof Ionicons.glyphMap}
                size={28}
                color={slide.iconColor}
              />
            </View>
          )}
          {slide.detail && (
            <Text style={[styles.detail, { color: slide.iconColor }]}>{slide.detail}</Text>
          )}
        </View>

        {/* Engine dots for the engines slide */}
        {slide.id === "engines" && (
          <View style={styles.engineDots}>
            {ENGINE_DOTS.map((e) => (
              <View key={e.label} style={styles.engineDotRow}>
                <View style={[styles.engineDot, { backgroundColor: e.color }]} />
                <Text style={[styles.engineDotLabel, { color: e.color }]}>{e.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Title */}
        <Text style={styles.title}>{slide.title}</Text>

        {/* Description */}
        <Text style={styles.description}>{slide.description}</Text>
      </Animated.View>

      {/* Bottom: dots + button */}
      <View style={styles.bottom}>
        {/* Step dots */}
        <View style={styles.dots}>
          {slides.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                idx === currentSlide && styles.dotActive,
                idx < currentSlide && styles.dotDone,
              ]}
            />
          ))}
        </View>

        {/* Button */}
        <Pressable style={styles.button} onPress={handleNext}>
          <Text style={styles.buttonText}>
            {isLast ? "Enter Titan Protocol" : "Next"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing["2xl"],
  },
  skipBtn: {
    alignSelf: "flex-end",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  skipText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.textMuted,
  },
  slideContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.xl,
  },
  iconArea: {
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryIcon: {
    position: "absolute",
    right: -16,
    bottom: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  detail: {
    ...fonts.mono,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1,
  },
  engineDots: {
    flexDirection: "row",
    gap: spacing.xl,
  },
  engineDotRow: {
    alignItems: "center",
    gap: spacing.xs,
  },
  engineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  engineDotLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    fontWeight: "400",
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  bottom: {
    gap: spacing.xl,
    paddingTop: spacing.xl,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.10)",
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 20,
    borderRadius: 4,
  },
  dotDone: {
    backgroundColor: "rgba(255, 255, 255, 0.35)",
  },
  button: {
    paddingVertical: spacing.lg,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.bg,
    letterSpacing: 2,
  },
});
