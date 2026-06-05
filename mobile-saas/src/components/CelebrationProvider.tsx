import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { colors, fonts, radius, spacing } from "../theme";
import { SPRING } from "../lib/animations";
import { celebration } from "../lib/haptics";

/**
 * Celebration overlay — black-metallic HUD theme. RN port of web's
 * `components/ui/Celebration.tsx`.
 *
 * Exposes `celebrateRankUp` via context; `RankUpWatcher` calls it when a
 * level-up lands. A centered "RANK UP" / "LEVEL UP" banner pops in (Reanimated
 * spring), tinted with the rank color and backed by a celebration haptic, then
 * auto-dismisses. There's no confetti canvas (that's web/DOM-only) — on native
 * the rank-color glow + haptic stand in.
 */

// Gold accent for the kicker (matches web's GOLD). Celebration visuals are the
// one documented spot where inline hex is fine (see web Celebration.tsx).
const GOLD = "#d4af37";
const RANK_UP_MS = 3800;

export type RankUpCelebration = {
  rankName: string;
  level: number;
  color: string;
  /** true when the rank tier (name) changed; false for a same-rank level-up. */
  isMajor: boolean;
};

type CelebrationContextType = {
  celebrateRankUp: (params: RankUpCelebration) => void;
};

const CelebrationContext = createContext<CelebrationContextType>({
  celebrateRankUp: () => {},
});

export function useCelebration() {
  return useContext(CelebrationContext);
}

function RankUpBanner({ rankUp }: { rankUp: RankUpCelebration }) {
  const { rankName, level, color, isMajor } = rankUp;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(1, SPRING.popupEntrance);
  }, [progress]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { scale: 0.86 + progress.value * 0.14 },
      { translateY: (1 - progress.value) * 10 },
    ],
  }));

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Animated.View
        style={[
          styles.panel,
          animStyle,
          { borderColor: color, shadowColor: color },
        ]}
      >
        <Text style={styles.kicker}>{isMajor ? "RANK UP" : "LEVEL UP"}</Text>
        <Text
          style={[styles.name, { color, textShadowColor: color }]}
          numberOfLines={1}
        >
          {isMajor ? rankName.toUpperCase() : `LEVEL ${level}`}
        </Text>
        <Text style={styles.sub}>
          {isMajor ? `LEVEL ${level} · ${rankName}` : rankName}
        </Text>
      </Animated.View>
    </View>
  );
}

export function CelebrationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [rankUp, setRankUp] = useState<RankUpCelebration | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const celebrateRankUp = useCallback((params: RankUpCelebration) => {
    setRankUp(params);
    celebration();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setRankUp(null), RANK_UP_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const value = useMemo(() => ({ celebrateRankUp }), [celebrateRankUp]);

  return (
    <CelebrationContext.Provider value={value}>
      {children}
      {rankUp && (
        <RankUpBanner
          key={`${rankUp.level}-${rankUp.rankName}`}
          rankUp={rankUp}
        />
      )}
    </CelebrationContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  panel: {
    minWidth: 260,
    paddingVertical: spacing["2xl"],
    paddingHorizontal: spacing["3xl"],
    borderRadius: radius.xl,
    borderWidth: 1.5,
    backgroundColor: colors.surfaceHero,
    alignItems: "center",
    // iOS colored bloom; on Android the bright rank-color border carries it
    // (raw `elevation` is banned by the forbidden-patterns guard).
    shadowOpacity: 0.55,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
  },
  kicker: {
    ...fonts.kicker,
    color: GOLD,
    fontSize: 11,
    letterSpacing: 4,
  },
  name: {
    ...fonts.title,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  sub: {
    ...fonts.kicker,
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1.5,
  },
});
