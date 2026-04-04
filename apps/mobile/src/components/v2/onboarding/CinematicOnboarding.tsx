import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import { initAudio } from "../../../lib/protocol-audio";
import { useStoryStore } from "../../../stores/useStoryStore";
import { useModeStore, type IdentityArchetype } from "../../../stores/useModeStore";
import { useOnboardingStore } from "../../../stores/useOnboardingStore";
import type { EngineKey } from "../../../db/schema";

// ── Beat components ──────────────────────────────────────────────────────────

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

// ── Types ────────────────────────────────────────────────────────────────────

type Props = {
  onComplete: () => void;
};

// ── Default tasks for the briefing (Beat 11) ────────────────────────────────

const DEFAULT_BRIEFING_TASKS = [
  { title: "Complete your first workout", engine: "body" },
  { title: "30 minutes deep work session", engine: "mind" },
  { title: "Review your monthly budget", engine: "money" },
  { title: "Start a conversation with someone new", engine: "charisma" },
];

// ── Component ────────────────────────────────────────────────────────────────

export function CinematicOnboarding({ onComplete }: Props) {
  const [currentBeat, setCurrentBeat] = useState(1);

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

  // Initialize audio on mount
  useEffect(() => {
    initAudio();
  }, []);

  // ── Beat rendering ─────────────────────────────────────────────────────────

  const renderBeat = () => {
    switch (currentBeat) {
      // Beat 1: Cold Open
      case 1:
        return (
          <BeatColdOpen
            onComplete={() => setCurrentBeat(2)}
          />
        );

      // Beat 2: What Is This
      case 2:
        return (
          <BeatWhatIsThis
            onComplete={() => setCurrentBeat(3)}
          />
        );

      // Beat 3: Four Engines
      case 3:
        return (
          <BeatFourEngines
            onComplete={() => setCurrentBeat(4)}
          />
        );

      // Beat 4: Identify (name input)
      case 4:
        return (
          <BeatIdentify
            onComplete={(name: string) => {
              nameRef.current = name;
              setUserName(name);
              setCurrentBeat(5);
            }}
          />
        );

      // Beat 5: Quiz (archetype determination)
      case 5:
        return (
          <BeatQuiz
            onComplete={(archetype: string) => {
              archetypeRef.current = archetype;
              setIdentity(archetype as IdentityArchetype);
              setCurrentBeat(6);
            }}
          />
        );

      // Beat 6: Reveal (archetype reveal cinematic)
      case 6:
        return (
          <BeatReveal
            archetype={archetypeRef.current}
            onComplete={() => setCurrentBeat(7)}
          />
        );

      // Beat 7: Rank Ladder (skippable)
      case 7:
        return (
          <BeatLadder
            onComplete={() => setCurrentBeat(8)}
          />
        );

      // Beat 8: Engine Priority (drag to reorder)
      case 8:
        return (
          <BeatEnginePriority
            archetype={archetypeRef.current}
            onComplete={(engines: string[]) => {
              enginePriorityRef.current = engines;
              setEnginePriority(engines as EngineKey[]);
              setFocusEngines(engines);
              setCurrentBeat(9);
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

              setCurrentBeat(10);
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
              selectedTasksRef.current = tasks.map((t) => ({
                title: t.title,
                engine: t.engine,
              }));
              setCurrentBeat(11);
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
              setCurrentBeat(12);
            }}
          />
        );

      // Beat 12: Done -- mark onboarding complete and exit
      case 12: {
        // Finalize onboarding
        finishOnboarding();
        onComplete();
        return null;
      }

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {renderBeat()}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
});
