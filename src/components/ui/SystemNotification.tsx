/**
 * SystemNotification — Floating toast alerts that feel like a game System.
 *
 * Appears from top, stays briefly, slides out. Premium dark glass style
 * with subtle glow border. Not cartoonish — clean, metallic, real.
 *
 * Usage:
 *   import { useSystemNotification } from "./SystemNotification";
 *   const notify = useSystemNotification();
 *   notify({ type: "xp", title: "+20 XP", subtitle: "Mission completed" });
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
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
import { colors, fonts, spacing, radius } from "../../theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType =
  | "xp"
  | "quest_complete"
  | "streak"
  | "streak_broken"
  | "level_up"
  | "skill_ready"
  | "engine_online"
  | "rank_up"
  | "system";

export type SystemNotificationData = {
  type: NotificationType;
  title: string;
  subtitle?: string;
  accentColor?: string;
};

// ─── Accent colors by type ────────────────────────────────────────────────────

const TYPE_ACCENTS: Record<NotificationType, string> = {
  xp: "#5cc9a0",           // green
  quest_complete: "#5cc9a0",
  streak: "#FBBF24",       // gold
  streak_broken: "#de6b7d", // red
  level_up: "#FBBF24",
  skill_ready: "#A78BFA",  // purple
  engine_online: "#00FF88", // engine green
  rank_up: "#FBBF24",
  system: "rgba(247,250,255,0.8)",
};

const TYPE_ICONS: Record<NotificationType, string> = {
  xp: "\u26A1",
  quest_complete: "\u2713",
  streak: "\uD83D\uDD25",
  streak_broken: "\u26A0\uFE0F",
  level_up: "\u2B06\uFE0F",
  skill_ready: "\u2B50",
  engine_online: "\u25CF",
  rank_up: "\uD83C\uDFC6",
  system: "\u25C8",
};

// ─── Context ──────────────────────────────────────────────────────────────────

type NotifyFn = (data: SystemNotificationData) => void;

const NotificationContext = createContext<NotifyFn>(() => {});

export function useSystemNotification(): NotifyFn {
  return useContext(NotificationContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

type QueueItem = SystemNotificationData & { id: number };

export function SystemNotificationProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [current, setCurrent] = useState<QueueItem | null>(null);
  const idCounter = useRef(0);
  const isShowing = useRef(false);

  const notify = useCallback((data: SystemNotificationData) => {
    const item: QueueItem = { ...data, id: ++idCounter.current };
    setQueue((q) => [...q, item]);
  }, []);

  // Process queue
  useEffect(() => {
    if (!isShowing.current && queue.length > 0) {
      isShowing.current = true;
      const next = queue[0];
      setCurrent(next);
      setQueue((q) => q.slice(1));

      // Auto-dismiss after 3 seconds
      const timer = setTimeout(() => {
        setCurrent(null);
        isShowing.current = false;
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [queue, current]);

  return (
    <NotificationContext.Provider value={notify}>
      {children}
      {current && <NotificationToast key={current.id} data={current} />}
    </NotificationContext.Provider>
  );
}

// ─── Toast Component ──────────────────────────────────────────────────────────

function NotificationToast({ data }: { data: SystemNotificationData }) {
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  const accent = data.accentColor ?? TYPE_ACCENTS[data.type];
  const icon = TYPE_ICONS[data.type];

  useEffect(() => {
    // Slide in
    translateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });
    opacity.value = withTiming(1, { duration: 300 });

    // Slide out after 2.5s
    translateY.value = withDelay(2500,
      withTiming(-100, { duration: 300, easing: Easing.in(Easing.cubic) }),
    );
    opacity.value = withDelay(2500, withTiming(0, { duration: 300 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.toast, animStyle]}>
      {/* Glow border effect */}
      <View style={[styles.glowBorder, { borderColor: accent + "30", shadowColor: accent }]}>
        {/* Top accent line */}
        <View style={[styles.topLine, { backgroundColor: accent }]} />

        <View style={styles.content}>
          {/* Icon */}
          <Text style={[styles.icon, { color: accent }]}>{icon}</Text>

          {/* Text */}
          <View style={styles.textWrap}>
            <Text style={[styles.title, { color: accent }]}>{data.title}</Text>
            {data.subtitle && (
              <Text style={styles.subtitle}>{data.subtitle}</Text>
            )}
          </View>

          {/* System badge */}
          <View style={styles.systemBadge}>
            <Text style={styles.systemBadgeText}>SYSTEM</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    top: 50,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
  },
  glowBorder: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
    // Glass effect
    backgroundColor: "rgba(0, 0, 10, 0.92)",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  topLine: {
    height: 2,
    width: "100%",
    opacity: 0.6,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  icon: {
    fontSize: 20,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  systemBadge: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  systemBadgeText: {
    ...fonts.kicker,
    fontSize: 7,
    color: colors.textMuted,
    letterSpacing: 2,
  },
});
