/**
 * Pre-built starter missions per identity archetype.
 * Populated into engines when onboarding completes.
 */

import type { EngineKey } from "../db/schema";

export type StarterMission = {
  engine: EngineKey;
  title: string;
  kind: "main" | "secondary";
};

const STARTER_MISSIONS: Record<string, StarterMission[]> = {
  warrior: [
    { engine: "body", title: "Complete a workout (strength or cardio)", kind: "main" },
    { engine: "body", title: "Stretch or mobility work (10 min)", kind: "secondary" },
    { engine: "body", title: "Track nutrition for the day", kind: "secondary" },
    { engine: "mind", title: "Read for 15 minutes", kind: "secondary" },
    { engine: "money", title: "Review today's spending", kind: "secondary" },
    { engine: "general", title: "Plan tomorrow before bed", kind: "main" },
    { engine: "general", title: "Complete one household task", kind: "secondary" },
  ],
  monk: [
    { engine: "mind", title: "Meditate or practice mindfulness (15 min)", kind: "main" },
    { engine: "mind", title: "Read philosophy or psychology (20 min)", kind: "main" },
    { engine: "mind", title: "Journal: reflect on one decision today", kind: "secondary" },
    { engine: "body", title: "Morning exercise or yoga (30 min)", kind: "main" },
    { engine: "body", title: "Cold exposure (2 min)", kind: "secondary" },
    { engine: "general", title: "Declutter one area of your space", kind: "secondary" },
    { engine: "money", title: "Review budget briefly", kind: "secondary" },
  ],
  titan: [
    { engine: "body", title: "Intense workout (45+ min)", kind: "main" },
    { engine: "body", title: "Hit protein target", kind: "secondary" },
    { engine: "mind", title: "Deep work block (90 min)", kind: "main" },
    { engine: "mind", title: "Learn one new concept", kind: "secondary" },
    { engine: "money", title: "Work on income-generating project", kind: "main" },
    { engine: "money", title: "Track all expenses", kind: "secondary" },
    { engine: "general", title: "Complete top 3 priorities for the day", kind: "main" },
    { engine: "general", title: "Plan tomorrow's schedule", kind: "secondary" },
  ],
  operator: [
    { engine: "body", title: "Exercise (30 min)", kind: "main" },
    { engine: "mind", title: "Read or learn (20 min)", kind: "main" },
    { engine: "money", title: "Review finances or work on side project", kind: "main" },
    { engine: "general", title: "Complete most important task of the day", kind: "main" },
    { engine: "body", title: "Track sleep quality", kind: "secondary" },
    { engine: "mind", title: "Practice one mental model", kind: "secondary" },
    { engine: "general", title: "Plan tomorrow", kind: "secondary" },
  ],
  architect: [
    { engine: "money", title: "Work on business/investment strategy (60 min)", kind: "main" },
    { engine: "money", title: "Track income and expenses", kind: "main" },
    { engine: "money", title: "Read financial/business content (15 min)", kind: "secondary" },
    { engine: "mind", title: "Systems thinking: map one process", kind: "main" },
    { engine: "mind", title: "Read strategy content (15 min)", kind: "secondary" },
    { engine: "body", title: "Exercise (30 min)", kind: "secondary" },
    { engine: "general", title: "Weekly review and planning", kind: "secondary" },
  ],
  scholar: [
    { engine: "mind", title: "Deep reading (30+ min)", kind: "main" },
    { engine: "mind", title: "Take notes on what you learned", kind: "main" },
    { engine: "mind", title: "Teach or explain a concept to someone", kind: "secondary" },
    { engine: "mind", title: "Review spaced repetition cards", kind: "secondary" },
    { engine: "body", title: "Exercise to support cognition (30 min)", kind: "secondary" },
    { engine: "money", title: "Track spending briefly", kind: "secondary" },
    { engine: "general", title: "Organize learning notes", kind: "secondary" },
  ],
};

export function getStarterMissions(archetype: string): StarterMission[] {
  return STARTER_MISSIONS[archetype] ?? STARTER_MISSIONS.operator;
}
