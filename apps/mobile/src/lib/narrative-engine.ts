/**
 * Dynamic Narrative Engine
 *
 * Generates story text based on user behavior.
 * Entries are stored in MMKV as narrative_entries array.
 */

import { getJSON, setJSON } from "../db/storage";
import { selectIdentityMeta, type Archetype } from "../stores/useIdentityStore";
import { getCurrentChapter, type Chapter } from "../data/chapters";
import { ARCHETYPE_STORIES, type StoryEntry } from "../data/archetype-stories";

// ─── Types ──────────────────────────────────────────────────────────────────

export type NarrativeEntry = {
  date: string;
  text: string;
  type: "protocol" | "streak" | "neglect" | "perfect" | "level_up" | "skill_node" | "phase" | "milestone" | "day_one" | "story";
};

const STORAGE_KEY = "narrative_entries";
const MAX_ENTRIES = 100;

// ─── Read / Write ───────────────────────────────────────────────────────────

export function getNarrativeEntries(): NarrativeEntry[] {
  return getJSON<NarrativeEntry[]>(STORAGE_KEY, []);
}

export function getLatestNarrative(): NarrativeEntry | null {
  const entries = getNarrativeEntries();
  return entries.length > 0 ? entries[entries.length - 1] : null;
}

export function addEntry(entry: NarrativeEntry): void {
  const entries = getNarrativeEntries();
  entries.push(entry);
  // Keep only the latest MAX_ENTRIES
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
  setJSON(STORAGE_KEY, entries);
}

// ─── Day counter ────────────────────────────────────────────────────────────

function getDayNumber(): number {
  const firstDay = getJSON<string>("first_active_date", "");
  if (!firstDay) return 1;
  const start = new Date(firstDay + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.max(1, Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1);
}

function getArchetypeName(archetype: Archetype | null): string {
  if (!archetype) return "Operator";
  const meta = selectIdentityMeta(archetype);
  return meta?.name ?? "The Titan";
}

// ─── Narrative Generators ───────────────────────────────────────────────────

export function narrativeProtocolComplete(
  archetype: Archetype | null,
  score: number,
  dateKey: string,
): void {
  const day = getDayNumber();
  const name = getArchetypeName(archetype);
  const texts = [
    `Day ${day}: ${name} completed the protocol. Score: ${score}%. The system is running.`,
    `Day ${day}: Protocol executed. ${score}% output. ${name} doesn't skip days.`,
    `Day ${day}: Another protocol locked in. ${score}%. The compound effect continues.`,
    `Day ${day}: ${name} showed up again. ${score}% today. Consistency is the weapon.`,
  ];
  addEntry({ date: dateKey, text: texts[day % texts.length], type: "protocol" });
}

export function narrativeStreakMilestone(
  archetype: Archetype | null,
  streak: number,
  dateKey: string,
): void {
  const day = getDayNumber();
  const name = getArchetypeName(archetype);
  const milestoneTexts: Record<number, string> = {
    7: `Day ${day}: 7 days unbroken. ${name}'s discipline is real — not just talk.`,
    14: `Day ${day}: 14 days. Two weeks of showing up. ${name} is building something most people never will.`,
    30: `Day ${day}: 30 days. A full month. ${name}'s commitment is no longer a question — it's a fact.`,
    60: `Day ${day}: 60 days. ${name} has outlasted most people who ever tried this. The gap is widening.`,
    90: `Day ${day}: 90 days. A quarter year of relentless execution. ${name} is becoming legendary.`,
  };
  const text = milestoneTexts[streak] ?? `Day ${day}: ${streak} days unbroken. ${name}'s streak speaks for itself.`;
  addEntry({ date: dateKey, text, type: "streak" });
}

export function narrativeEngineNeglect(
  archetype: Archetype | null,
  engine: string,
  daysNeglected: number,
  dateKey: string,
): void {
  const day = getDayNumber();
  const engineName = engine.charAt(0).toUpperCase() + engine.slice(1);
  const texts = [
    `Day ${day}: The ${engineName} engine has gone quiet. ${daysNeglected} days without activity. Is this intentional, or has focus drifted?`,
    `Day ${day}: ${engineName} has been idle for ${daysNeglected} days. A Titan doesn't let engines die.`,
    `Day ${day}: Silence from the ${engineName} engine. The system is only as strong as its weakest link.`,
  ];
  addEntry({ date: dateKey, text: texts[day % texts.length], type: "neglect" });
}

export function narrativePerfectDay(
  archetype: Archetype | null,
  dateKey: string,
): void {
  const day = getDayNumber();
  const name = getArchetypeName(archetype);
  const texts = [
    `Day ${day}: Perfect execution. Every engine firing at 100%. This is what ${name} looks like at full power.`,
    `Day ${day}: Flawless. Every task. Every engine. ${name} left nothing on the table today.`,
    `Day ${day}: 100% across the board. Days like this are what separate ${name} from everyone else.`,
  ];
  addEntry({ date: dateKey, text: texts[day % texts.length], type: "perfect" });
}

export function narrativeLevelUp(
  archetype: Archetype | null,
  newLevel: number,
  dateKey: string,
): void {
  const day = getDayNumber();
  const name = getArchetypeName(archetype);
  addEntry({
    date: dateKey,
    text: `Day ${day}: Level ${newLevel} reached. ${name} continues to evolve. The journey is far from over.`,
    type: "level_up",
  });
}

export function narrativeSkillNodeClaimed(
  nodeName: string,
  engine: string,
  dateKey: string,
): void {
  const day = getDayNumber();
  const engineName = engine.charAt(0).toUpperCase() + engine.slice(1);
  addEntry({
    date: dateKey,
    text: `Day ${day}: "${nodeName}" unlocked in the ${engineName} engine. Mastery grows node by node.`,
    type: "skill_node",
  });
}

export function narrativePhaseTransition(
  archetype: Archetype | null,
  newPhase: string,
  dateKey: string,
): void {
  const day = getDayNumber();
  const name = getArchetypeName(archetype);
  const phaseTexts: Record<string, string> = {
    foundation: `Day ${day}: ${name} enters the Foundation phase. The basics matter most. Build the habits. Earn the right to level up.`,
    building: `Day ${day}: ${name} enters the Building phase. The foundation is set. Now it's time to push harder, go deeper, demand more.`,
    intensify: `Day ${day}: ${name} enters the Intensify phase. No more warm-ups. Every session counts. Every engine must perform.`,
    sustain: `Day ${day}: ${name} enters the Sustain phase. You've proven yourself. Now maintain this level of excellence — forever.`,
  };
  addEntry({
    date: dateKey,
    text: phaseTexts[newPhase] ?? `Day ${day}: A new chapter begins. ${name} advances to ${newPhase}.`,
    type: "phase",
  });
}

export function narrativeDayOne(
  archetype: Archetype | null,
  dateKey: string,
): void {
  const name = getArchetypeName(archetype);
  addEntry({
    date: dateKey,
    text: `Day 1: You chose ${name}. Your identity is set. Your engines are loaded. Chapter 1: The Awakening begins now.`,
    type: "day_one",
  });
}

// ─── Archetype Story Arcs ──────────────────────────────────────────────────

export function getStoryForDay(archetype: string | null, dayNumber: number): StoryEntry | null {
  if (!archetype) return null;
  const stories = ARCHETYPE_STORIES[archetype];
  if (!stories) return null;
  return stories.find((s) => s.day === dayNumber) ?? null;
}

// ─── Chapter Narratives ─────────────────────────────────────────────────────

export function narrativeChapterStart(
  archetype: Archetype | null,
  chapter: Chapter,
  dateKey: string,
): void {
  const day = getDayNumber();
  const name = getArchetypeName(archetype);
  addEntry({
    date: dateKey,
    text: `Day ${day}: Chapter ${chapter.number} begins — "${chapter.name}." ${chapter.subtitle} ${name} enters a new phase of the journey.`,
    type: "phase",
  });
}

export function narrativeBossUnlocked(
  chapter: Chapter,
  dateKey: string,
): void {
  const day = getDayNumber();
  addEntry({
    date: dateKey,
    text: `Day ${day}: BOSS CHALLENGE UNLOCKED — "${chapter.bossName}." ${chapter.bossDescription} Complete this to finish Chapter ${chapter.number}.`,
    type: "milestone",
  });
}

export function narrativeBossComplete(
  archetype: Archetype | null,
  chapter: Chapter,
  dateKey: string,
): void {
  const day = getDayNumber();
  const name = getArchetypeName(archetype);
  addEntry({
    date: dateKey,
    text: `Day ${day}: BOSS DEFEATED — "${chapter.bossName}." ${name} has conquered Chapter ${chapter.number}: ${chapter.name}. The next chapter awaits.`,
    type: "milestone",
  });
}
