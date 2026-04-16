import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";
type StoryState = {
  userName: string;
  currentAct: string | number;
  storyFlags: Record<string, boolean>;
  enginesOnline: Record<string, boolean>;

  setUserName: (name: string) => void;
  markCinematicPlayed: (day: number) => void;
  setAct: (act: string | number) => void;
  setFlag: (flag: string, value?: boolean) => void;
  getCinematicForDay: (day: number) => string | null;
};

// Cinematics that exist — returns a key if not yet played
const CINEMATIC_DAYS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 30, 45, 60, 90, 365];

export const useStoryStore = create<StoryState>((set, get) => ({
  userName: getJSON<string>("story_user_name", ""),
  currentAct: getJSON<number>("story_current_act", 1),
  storyFlags: getJSON<Record<string, boolean>>("story_flags", {}),
  enginesOnline: getJSON<Record<string, boolean>>("story_engines_online", {
    body: true,
    mind: true,
    money: true,
    charisma: true,
  }),

  setUserName: (name) => {
    setJSON("story_user_name", name);
    set({ userName: name });
  },

  markCinematicPlayed: (day) => {
    const key = `cinematic_day_${day}`;
    setJSON(key, true);
    set((s) => ({
      storyFlags: { ...s.storyFlags, [key]: true },
    }));
  },

  setAct: (act) => {
    setJSON("story_current_act", act);
    set({ currentAct: act });
  },

  setFlag: (flag, value = true) => {
    const flags = { ...get().storyFlags, [flag]: value };
    setJSON("story_flags", flags);
    set({ storyFlags: flags });
  },

  getCinematicForDay: (day) => {
    if (!CINEMATIC_DAYS.includes(day)) return null;
    const key = `cinematic_day_${day}`;
    const played = getJSON<boolean>(key, false);
    return played ? null : key;
  },
}));
