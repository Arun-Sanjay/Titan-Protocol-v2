import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";
import { getTodayKey } from "../lib/date";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StoryAct = "induction" | "foundation" | "building" | "intensify" | "sustain";

export type StoryFlags = {
  day1_played: boolean;
  day2_played: boolean;
  day3_played: boolean;
  day4_played: boolean;
  day5_played: boolean;
  day6_played: boolean;
  day7_played: boolean;
  day14_played: boolean;
  day21_played: boolean;
  day30_played: boolean;
  day45_played: boolean;
  day60_played: boolean;
  day75_played: boolean;
  day90_played: boolean;
  day365_played: boolean;
  titan_mode_played: boolean;
  all_engines_online_played: boolean;
  first_s_rank_played: boolean;
  first_ss_rank_played: boolean;
  crucible_started: boolean;
  crucible_completed: boolean;
  [key: string]: boolean;
};

const DEFAULT_FLAGS: StoryFlags = {
  day1_played: false,
  day2_played: false,
  day3_played: false,
  day4_played: false,
  day5_played: false,
  day6_played: false,
  day7_played: false,
  day14_played: false,
  day21_played: false,
  day30_played: false,
  day45_played: false,
  day60_played: false,
  day75_played: false,
  day90_played: false,
  day365_played: false,
  titan_mode_played: false,
  all_engines_online_played: false,
  first_s_rank_played: false,
  first_ss_rank_played: false,
  crucible_started: false,
  crucible_completed: false,
};

const STORY_KEY = "story_state";
const NAME_KEY = "user_name";

// ─── Store ────────────────────────────────────────────────────────────────────

type StoryState = {
  userName: string;
  currentAct: StoryAct;
  lastCinematicDay: number;
  enginesOnline: Record<string, boolean>;
  storyFlags: StoryFlags;

  load: () => void;
  setUserName: (name: string) => void;
  setAct: (act: StoryAct) => void;
  setFlag: (flag: string, value: boolean) => void;
  markCinematicPlayed: (day: number) => void;
  setEngineOnline: (engine: string, online: boolean) => void;
  getCinematicForDay: (dayNumber: number) => string | null;
};

type PersistedStory = {
  currentAct: StoryAct;
  lastCinematicDay: number;
  enginesOnline: Record<string, boolean>;
  storyFlags: StoryFlags;
};

function persist(data: PersistedStory) {
  setJSON(STORY_KEY, data);
}

export const useStoryStore = create<StoryState>()((set, get) => {
  const saved = getJSON<PersistedStory | null>(STORY_KEY, null);

  return {
    userName: getJSON<string>(NAME_KEY, ""),
    currentAct: saved?.currentAct ?? "induction",
    lastCinematicDay: saved?.lastCinematicDay ?? 0,
    enginesOnline: saved?.enginesOnline ?? { body: false, mind: false, money: false, charisma: false },
    storyFlags: saved?.storyFlags ?? { ...DEFAULT_FLAGS },

    load: () => {
      const data = getJSON<PersistedStory | null>(STORY_KEY, null);
      const name = getJSON<string>(NAME_KEY, "");
      set({
        userName: name,
        currentAct: data?.currentAct ?? "induction",
        lastCinematicDay: data?.lastCinematicDay ?? 0,
        enginesOnline: data?.enginesOnline ?? { body: false, mind: false, money: false, charisma: false },
        storyFlags: data?.storyFlags ?? { ...DEFAULT_FLAGS },
      });
    },

    setUserName: (name) => {
      setJSON(NAME_KEY, name);
      set({ userName: name });
    },

    setAct: (act) => {
      const state = get();
      const data: PersistedStory = {
        currentAct: act,
        lastCinematicDay: state.lastCinematicDay,
        enginesOnline: state.enginesOnline,
        storyFlags: state.storyFlags,
      };
      persist(data);
      set({ currentAct: act });
    },

    setFlag: (flag, value) => {
      const state = get();
      const flags = { ...state.storyFlags, [flag]: value };
      const data: PersistedStory = {
        currentAct: state.currentAct,
        lastCinematicDay: state.lastCinematicDay,
        enginesOnline: state.enginesOnline,
        storyFlags: flags,
      };
      persist(data);
      set({ storyFlags: flags });
    },

    markCinematicPlayed: (day) => {
      const state = get();
      const flagKey = `day${day}_played`;
      const flags = { ...state.storyFlags, [flagKey]: true };
      const data: PersistedStory = {
        currentAct: state.currentAct,
        lastCinematicDay: day,
        enginesOnline: state.enginesOnline,
        storyFlags: flags,
      };
      persist(data);
      set({ lastCinematicDay: day, storyFlags: flags });
    },

    setEngineOnline: (engine, online) => {
      const state = get();
      const engines = { ...state.enginesOnline, [engine]: online };
      const data: PersistedStory = {
        currentAct: state.currentAct,
        lastCinematicDay: state.lastCinematicDay,
        enginesOnline: engines,
        storyFlags: state.storyFlags,
      };
      persist(data);
      set({ enginesOnline: engines });
    },

    getCinematicForDay: (dayNumber) => {
      const { storyFlags } = get();
      // Map day numbers to cinematic component names
      const DAY_CINEMATICS: Record<number, { flag: string; component: string }> = {
        1: { flag: "day1_played", component: "Day1Cinematic" },
        2: { flag: "day2_played", component: "Day2Cinematic" },
        3: { flag: "day3_played", component: "Day3Cinematic" },
        4: { flag: "day4_played", component: "Day4Cinematic" },
        5: { flag: "day5_played", component: "Day5Cinematic" },
        6: { flag: "day6_played", component: "Day6Cinematic" },
        7: { flag: "day7_played", component: "Day7Cinematic" },
        14: { flag: "day14_played", component: "Day14Cinematic" },
        30: { flag: "day30_played", component: "Day30Cinematic" },
        45: { flag: "day45_played", component: "Day45Cinematic" },
        60: { flag: "day60_played", component: "Day60Cinematic" },
        90: { flag: "day90_played", component: "Day90Cinematic" },
        365: { flag: "day365_played", component: "Day365Cinematic" },
      };

      const entry = DAY_CINEMATICS[dayNumber];
      if (!entry) return null;
      if (storyFlags[entry.flag]) return null; // Already played
      return entry.component;
    },
  };
});
