import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { initAudio, stopCurrentAudio } from "../../../lib/protocol-audio";
import { useStoryStore } from "../../../stores/useStoryStore";
import { useModeStore, type IdentityArchetype } from "../../../stores/useModeStore";
import { useOnboardingStore } from "../../../stores/useOnboardingStore";
import type { EngineKey } from "../../../db/schema";

// -- Beat components ----------------------------------------------------------

import { BeatColdOpen } from "./BeatColdOpen";
import { BeatWhatIsThis } from "./BeatWhatIsThis";
import { BeatFourEngines } from "./BeatFourEngines";
import { BeatIdentify } from "./BeatIdentify";
import { BeatQuiz } from "./BeatQuiz";
import { BeatReveal } from "./BeatReveal";
import { BeatLadder } from "./BeatLadder";
import { BeatEnginePriority } from "./BeatEnginePriority";
import { BeatScheduleMode } from "./BeatScheduleMode";
import { BeatTaskSelection } from "./BeatTaskSelection";
import { BeatBriefing } from "./BeatBriefing";

// -- Types --------------------------------------------------------------------

type Props = {
  onComplete: () => void;
};

// -- Default tasks for the briefing (Beat 11) ---------------------------------

const DEFAULT_BRIEFING_TASKS = [
  { title: "Complete your first workout", engine: "body" },
  { title: "30 minutes deep work session", engine: "mind" },
  { title: "Review your monthly budget", engine: "money" },
  { title: "Start a conversation with someone new", engine: "charisma" },
];

// -- Crossfade timing constants -----------------------------------------------

const FADE_OUT_MS = 400;
const BLACK_PAUSE_MS = 200;
const FADE_IN_MS = 400;

// -- Component ----------------------------------------------------------------

export function CinematicOnboarding({ onComplete }: Props) {
  const [currentBeat, setCurrentBeat] = useState(0);
  const isTransitioning = useRef(false);

  // Crossfade animation
  const fadeOpacity = useSharedValue(1);
  const animatedFadeStyle = useAnimatedStyle(() => ({
    opacity: fadeOpacity.value,
  }));

  // Inter-beat data refs (survive re-renders without triggering them)
  const nameRef = useRef("");
  const archetypeRef = useRef<string>("titan");
  const enginePriorityRef = useRef<string[]>(["body", "mind", "money", "charisma"]);
  const scheduleRef = useRef<boolean[]>([true, true, true, true, true, false, false]);
  const modeRef = useRef<string>("titan");
  const focusEnginesRef = useRef<string[] | undefined>(undefined);
  const selectedTasksRef = useRef<Array<{ title: string; engine: string }>>([]);

  // Store actions
  const setUserName = useStoryStore((s) => s.setUserName);
  const setIdentity = useModeStore((s) => s.setIdentity);
  const setFocusEngines = useModeStore((s) => s.setFocusEngines);
  const setMode = useModeStore((s) => s.setMode);
  const finishOnboarding = useOnboardingStore((s) => s.finish);
  const setEnginePriority = useOnboardingStore((s) => s.setEnginePriority);
  const setSchedule = useOnboardingStore((s) => s.setSchedule);

  // Initialize audio on mount, stop on unmount
  useEffect(() => {
    initAudio();
    return () => {
      stopCurrentAudio();
    };
  }, []);

  // -- Crossfade advance function ---------------------------------------------

  const advanceBeat = useCallback(
    (nextBeat: number, preAdvanceCallback?: () => void) => {
      if (isTransitioning.current) return;
      isTransitioning.current = true;

      // Phase 1: Fade out current beat
      fadeOpacity.value = withTiming(0, {
        duration: FADE_OUT_MS,
        easing: Easing.out(Easing.ease),
      });

      // Phase 2: After fade-out + black pause, switch beat and fade in
      setTimeout(() => {
        if (preAdvanceCallback) preAdvanceCallback();
        setCurrentBeat(nextBeat);

        setTimeout(() => {
          fadeOpacity.value = withTiming(1, {
            duration: FADE_IN_MS,
            easing: Easing.in(Easing.ease),
          });
          isTransitioning.current = false;
        }, BLACK_PAUSE_MS);
      }, FADE_OUT_MS);
    },
    [fadeOpacity],
  );

  // -- Beat rendering ---------------------------------------------------------

  const renderBeat = () => {
    switch (currentBeat) {
      // Beat 0: Audio Prompt
      case 0:
        return (
          <View style={styles.audioPromptContainer}>
            <Ionicons name="volume-high" size={48} color="rgba(255,255,255,0.6)" />
            <Text style={styles.audioPromptText}>
              INCREASE AUDIO FOR BEST EXPERIENCE
            </Text>
            <TouchableOpacity
              style={styles.beginButton}
              onPress={() => advanceBeat(1)}
              activeOpacity={0.7}
            >
              <Text style={styles.beginButtonText}>BEGIN</Text>
            </TouchableOpacity>
          </View>
        );

      // Beat 1: Cold Open
      case 1:
        return (
          <BeatColdOpen
            onComplete={() => advanceBeat(2)}
          />
        );

      // Beat 2: What Is This
      case 2:
        return (
          <BeatWhatIsThis
            onComplete={() => advanceBeat(3)}
          />
        );

      // Beat 3: Four Engines
      case 3:
        return (
          <BeatFourEngines
            onComplete={() => advanceBeat(4)}
          />
        );

      // Beat 4: Identify (name input)
      case 4:
        return (
          <BeatIdentify
            onComplete={(name: string) => {
              advanceBeat(5, () => {
                nameRef.current = name;
                setUserName(name);
              });
            }}
          />
        );

      // Beat 5: Quiz (archetype determination)
      case 5:
        return (
          <BeatQuiz
            onComplete={(archetype: string) => {
              advanceBeat(6, () => {
                archetypeRef.current = archetype;
                setIdentity(archetype as IdentityArchetype);
              });
            }}
          />
        );

      // Beat 6: Reveal (archetype reveal cinematic)
      case 6:
        return (
          <BeatReveal
            archetype={archetypeRef.current}
            onComplete={() => advanceBeat(7)}
          />
        );

      // Beat 7: Rank Ladder (skippable)
      case 7:
        return (
          <BeatLadder
            onComplete={() => advanceBeat(8)}
          />
        );

      // Beat 8: Engine Priority (drag to reorder)
      case 8:
        return (
          <BeatEnginePriority
            archetype={archetypeRef.current}
            onComplete={(engines: string[]) => {
              advanceBeat(9, () => {
                enginePriorityRef.current = engines;
                setEnginePriority(engines as EngineKey[]);
                setFocusEngines(engines);
              });
            }}
          />
        );

      // Beat 9: Schedule + Mode
      case 9:
        return (
          <BeatScheduleMode
            onComplete={(
              schedule: boolean[],
              mode: string,
              focusEngs?: string[],
            ) => {
              advanceBeat(10, () => {
                scheduleRef.current = schedule;
                modeRef.current = mode;
                focusEnginesRef.current = focusEngs;

                // Persist schedule as Record<string, boolean>
                const dayKeys = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
                const scheduleRecord: Record<string, boolean> = {};
                dayKeys.forEach((key, i) => {
                  scheduleRecord[key] = schedule[i] ?? false;
                });
                setSchedule(scheduleRecord);

                // Persist mode
                setMode(mode as any);
                if (focusEngs) {
                  setFocusEngines(focusEngs);
                }
              });
            }}
          />
        );

      // Beat 10: Task Selection
      case 10: {
        // Determine active engines: all 4 for titan mode, or focus-selected
        const activeEngines =
          modeRef.current === "titan"
            ? ["body", "mind", "money", "charisma"]
            : (focusEnginesRef.current ?? ["body", "mind", "money", "charisma"]);

        return (
          <BeatTaskSelection
            archetype={archetypeRef.current}
            activeEngines={activeEngines}
            onComplete={(tasks) => {
              advanceBeat(11, () => {
                selectedTasksRef.current = tasks.map((t) => ({
                  title: t.title,
                  engine: t.engine,
                }));
              });
            }}
          />
        );
      }

      // Beat 11: First Op Briefing
      case 11:
        return (
          <BeatBriefing
            tasks={
              selectedTasksRef.current.length > 0
                ? selectedTasksRef.current
                : DEFAULT_BRIEFING_TASKS
            }
            onComplete={() => {
              advanceBeat(12);
            }}
          />
        );

      // Beat 12: Done -- mark onboarding complete and exit
      case 12: {
        finishOnboarding();
        stopCurrentAudio();
        onComplete();
        return null;
      }

      default:
        return null;
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>
          <Animated.View style={[styles.content, animatedFadeStyle]}>
            {renderBeat()}
          </Animated.View>
        </SafeAreaView>
      </View>
    </View>
  );
}

// -- Styles -------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    backgroundColor: "#000000",
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#000000",
  },
  content: {
    flex: 1,
  },
  audioPromptContainer: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  audioPromptText: {
    fontFamily: "monospace",
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 3,
    textAlign: "center",
    marginTop: 16,
  },
  beginButton: {
    marginTop: 32,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 4,
  },
  beginButtonText: {
    fontFamily: "monospace",
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    letterSpacing: 4,
    textAlign: "center",
  },
});
