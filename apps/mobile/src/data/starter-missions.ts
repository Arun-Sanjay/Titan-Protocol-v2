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
  titan: [
    { engine: "body", title: "Complete a workout (any type)", kind: "main" },
    { engine: "body", title: "Track nutrition", kind: "secondary" },
    { engine: "mind", title: "Deep work block \u2014 60 min on your most important skill", kind: "main" },
    { engine: "mind", title: "Read for 20 min", kind: "secondary" },
    { engine: "money", title: "Work on income-generating project (60 min)", kind: "main" },
    { engine: "money", title: "Track today's spending", kind: "secondary" },
    { engine: "charisma", title: "Start a conversation with someone new", kind: "main" },
    { engine: "charisma", title: "Practice speaking clearly for 2 min (record yourself)", kind: "secondary" },
  ],
  athlete: [
    { engine: "body", title: "Complete a full workout", kind: "main" },
    { engine: "body", title: "Hit protein target", kind: "main" },
    { engine: "body", title: "Stretch or mobility (10 min)", kind: "secondary" },
    { engine: "mind", title: "Read for 15 min", kind: "secondary" },
    { engine: "money", title: "Review spending", kind: "secondary" },
    { engine: "charisma", title: "Talk to someone at the gym", kind: "secondary" },
  ],
  scholar: [
    { engine: "mind", title: "Deep reading (30 min)", kind: "main" },
    { engine: "mind", title: "Learn one new concept and write about it", kind: "main" },
    { engine: "mind", title: "Review yesterday's notes", kind: "secondary" },
    { engine: "body", title: "Exercise for cognitive performance (30 min)", kind: "secondary" },
    { engine: "money", title: "Work on a skill that could earn money", kind: "secondary" },
    { engine: "charisma", title: "Explain something you learned to someone", kind: "secondary" },
  ],
  hustler: [
    { engine: "money", title: "Work on side project or business (90 min)", kind: "main" },
    { engine: "money", title: "Track all income and expenses", kind: "main" },
    { engine: "money", title: "Research one investment or opportunity", kind: "secondary" },
    { engine: "mind", title: "Read business or finance content (15 min)", kind: "secondary" },
    { engine: "body", title: "Exercise to maintain energy (30 min)", kind: "secondary" },
    { engine: "charisma", title: "Reach out to one professional contact", kind: "secondary" },
  ],
  showman: [
    { engine: "charisma", title: "Practice a 2-minute speech (record and review)", kind: "main" },
    { engine: "charisma", title: "Have a meaningful conversation with someone", kind: "main" },
    { engine: "charisma", title: "Give a genuine compliment to a stranger", kind: "secondary" },
    { engine: "mind", title: "Study a great speaker for 15 min", kind: "secondary" },
    { engine: "body", title: "Work out \u2014 confidence starts with how you feel", kind: "secondary" },
    { engine: "money", title: "Track spending", kind: "secondary" },
  ],
  warrior: [
    { engine: "body", title: "Complete an intense workout", kind: "main" },
    { engine: "body", title: "Track nutrition", kind: "secondary" },
    { engine: "mind", title: "Deep work or focused learning (60 min)", kind: "main" },
    { engine: "mind", title: "Journal: what challenged me today?", kind: "secondary" },
    { engine: "money", title: "Review finances briefly", kind: "secondary" },
    { engine: "charisma", title: "Practice one act of social courage", kind: "secondary" },
  ],
  founder: [
    { engine: "mind", title: "Deep work on your project (90 min)", kind: "main" },
    { engine: "mind", title: "Learn one concept in your field", kind: "secondary" },
    { engine: "money", title: "Work on income-generating activity (60 min)", kind: "main" },
    { engine: "money", title: "Track finances", kind: "secondary" },
    { engine: "body", title: "Exercise (30 min)", kind: "secondary" },
    { engine: "charisma", title: "Practice your elevator pitch", kind: "secondary" },
  ],
  charmer: [
    { engine: "charisma", title: "Start a conversation with someone new", kind: "main" },
    { engine: "charisma", title: "Practice confident body language all day", kind: "main" },
    { engine: "body", title: "Complete a workout (look good, feel good)", kind: "main" },
    { engine: "body", title: "Grooming and self-care routine", kind: "secondary" },
    { engine: "mind", title: "Read about communication or social psychology (15 min)", kind: "secondary" },
    { engine: "money", title: "Track spending", kind: "secondary" },
  ],
};

export function getStarterMissions(archetype: string): StarterMission[] {
  return STARTER_MISSIONS[archetype] ?? STARTER_MISSIONS.titan;
}
