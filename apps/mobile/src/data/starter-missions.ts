/**
 * Pre-built starter missions per identity archetype.
 * 5-6 missions per engine, ~20-24 total per archetype.
 */

import type { EngineKey } from "../db/schema";

export type StarterMission = {
  engine: EngineKey;
  title: string;
  kind: "main" | "secondary";
};

const STARTER_MISSIONS: Record<string, StarterMission[]> = {
  titan: [
    // Body (6)
    { engine: "body", title: "Complete a full workout", kind: "main" },
    { engine: "body", title: "Hit your protein target", kind: "main" },
    { engine: "body", title: "Track all meals today", kind: "secondary" },
    { engine: "body", title: "Stretch or mobility work (10 min)", kind: "secondary" },
    { engine: "body", title: "Get 7+ hours of sleep", kind: "secondary" },
    { engine: "body", title: "Drink 3L of water", kind: "secondary" },
    // Mind (6)
    { engine: "mind", title: "Deep work block (90 min)", kind: "main" },
    { engine: "mind", title: "Read for 30 minutes", kind: "main" },
    { engine: "mind", title: "Learn one new concept and write about it", kind: "secondary" },
    { engine: "mind", title: "Journal: reflect on today's decisions", kind: "secondary" },
    { engine: "mind", title: "Solve a hard problem you've been avoiding", kind: "secondary" },
    { engine: "mind", title: "Meditate for 10 minutes", kind: "secondary" },
    // Money (5)
    { engine: "money", title: "Work on income-generating project (60 min)", kind: "main" },
    { engine: "money", title: "Track all expenses today", kind: "main" },
    { engine: "money", title: "Research one investment opportunity", kind: "secondary" },
    { engine: "money", title: "Review your weekly budget", kind: "secondary" },
    { engine: "money", title: "Learn a professional skill (30 min)", kind: "secondary" },
    // Charisma (5)
    { engine: "charisma", title: "Start a conversation with someone new", kind: "main" },
    { engine: "charisma", title: "Practice a 2-min speech (record yourself)", kind: "main" },
    { engine: "charisma", title: "Give a genuine compliment to a stranger", kind: "secondary" },
    { engine: "charisma", title: "Practice active listening all day", kind: "secondary" },
    { engine: "charisma", title: "Lead or contribute to a group discussion", kind: "secondary" },
  ],
  athlete: [
    // Body (6)
    { engine: "body", title: "Complete a full workout (strength or cardio)", kind: "main" },
    { engine: "body", title: "Hit your protein target", kind: "main" },
    { engine: "body", title: "Track all meals today", kind: "main" },
    { engine: "body", title: "Stretch or mobility (15 min)", kind: "secondary" },
    { engine: "body", title: "Get 8 hours of sleep", kind: "secondary" },
    { engine: "body", title: "Cold shower or ice bath", kind: "secondary" },
    // Mind (5)
    { engine: "mind", title: "Read for 15 minutes", kind: "secondary" },
    { engine: "mind", title: "Watch a training or technique video", kind: "secondary" },
    { engine: "mind", title: "Visualize your next workout performance", kind: "secondary" },
    { engine: "mind", title: "Journal: what pushed my limits today?", kind: "secondary" },
    { engine: "mind", title: "Learn about a new training method", kind: "secondary" },
    // Money (5)
    { engine: "money", title: "Review today's spending", kind: "secondary" },
    { engine: "money", title: "Research a fitness-related income opportunity", kind: "secondary" },
    { engine: "money", title: "Track expenses for the week", kind: "secondary" },
    { engine: "money", title: "Plan one money-saving meal prep", kind: "secondary" },
    { engine: "money", title: "Review subscriptions you don't use", kind: "secondary" },
    // Charisma (5)
    { engine: "charisma", title: "Talk to someone at the gym", kind: "secondary" },
    { engine: "charisma", title: "Share your fitness progress with someone", kind: "secondary" },
    { engine: "charisma", title: "Help someone with their form or routine", kind: "secondary" },
    { engine: "charisma", title: "Post or share a workout update", kind: "secondary" },
    { engine: "charisma", title: "Introduce yourself to someone new", kind: "secondary" },
  ],
  scholar: [
    // Mind (6)
    { engine: "mind", title: "Deep reading session (30+ min)", kind: "main" },
    { engine: "mind", title: "Learn one new concept and write about it", kind: "main" },
    { engine: "mind", title: "Review and organize yesterday's notes", kind: "main" },
    { engine: "mind", title: "Complete a spaced repetition review", kind: "secondary" },
    { engine: "mind", title: "Watch an educational lecture or talk", kind: "secondary" },
    { engine: "mind", title: "Solve a challenging problem in your field", kind: "secondary" },
    // Body (5)
    { engine: "body", title: "Exercise for cognitive performance (30 min)", kind: "secondary" },
    { engine: "body", title: "Take a walk while thinking about a problem", kind: "secondary" },
    { engine: "body", title: "Track meals for brain fuel optimization", kind: "secondary" },
    { engine: "body", title: "Get 7+ hours of sleep for memory consolidation", kind: "secondary" },
    { engine: "body", title: "Stretch and reset between study sessions", kind: "secondary" },
    // Money (5)
    { engine: "money", title: "Work on a skill that could earn money", kind: "secondary" },
    { engine: "money", title: "Research one course or certification ROI", kind: "secondary" },
    { engine: "money", title: "Track spending briefly", kind: "secondary" },
    { engine: "money", title: "Read about financial literacy (15 min)", kind: "secondary" },
    { engine: "money", title: "Apply knowledge to a project with income potential", kind: "secondary" },
    // Charisma (5)
    { engine: "charisma", title: "Explain something you learned to someone", kind: "secondary" },
    { engine: "charisma", title: "Ask a thoughtful question in a conversation", kind: "secondary" },
    { engine: "charisma", title: "Join a discussion or study group", kind: "secondary" },
    { engine: "charisma", title: "Share an insight on social media", kind: "secondary" },
    { engine: "charisma", title: "Teach a concept to someone who needs help", kind: "secondary" },
  ],
  hustler: [
    // Money (6)
    { engine: "money", title: "Work on side project or business (90 min)", kind: "main" },
    { engine: "money", title: "Track all income and expenses", kind: "main" },
    { engine: "money", title: "Research one investment or opportunity", kind: "main" },
    { engine: "money", title: "Follow up on an invoice or lead", kind: "secondary" },
    { engine: "money", title: "Read business or finance content (15 min)", kind: "secondary" },
    { engine: "money", title: "Review and optimize your budget", kind: "secondary" },
    // Mind (5)
    { engine: "mind", title: "Deep work on your most important project", kind: "main" },
    { engine: "mind", title: "Read about business strategy (20 min)", kind: "secondary" },
    { engine: "mind", title: "Plan your next income move", kind: "secondary" },
    { engine: "mind", title: "Journal: what's my most leveraged action?", kind: "secondary" },
    { engine: "mind", title: "Study a successful person in your field", kind: "secondary" },
    // Body (5)
    { engine: "body", title: "Exercise to maintain energy (30 min)", kind: "secondary" },
    { engine: "body", title: "Track meals — your body fuels your hustle", kind: "secondary" },
    { engine: "body", title: "Get enough sleep to perform tomorrow", kind: "secondary" },
    { engine: "body", title: "Take a break and move every 90 min", kind: "secondary" },
    { engine: "body", title: "Drink water throughout the day", kind: "secondary" },
    // Charisma (5)
    { engine: "charisma", title: "Reach out to one professional contact", kind: "secondary" },
    { engine: "charisma", title: "Practice your elevator pitch", kind: "secondary" },
    { engine: "charisma", title: "Send a cold email or DM", kind: "secondary" },
    { engine: "charisma", title: "Have a conversation about your project", kind: "secondary" },
    { engine: "charisma", title: "Ask someone for feedback on your work", kind: "secondary" },
  ],
  showman: [
    // Charisma (6)
    { engine: "charisma", title: "Practice a 2-minute speech (record and review)", kind: "main" },
    { engine: "charisma", title: "Have a meaningful conversation with someone", kind: "main" },
    { engine: "charisma", title: "Give a genuine compliment to a stranger", kind: "main" },
    { engine: "charisma", title: "Lead a meeting or group discussion", kind: "secondary" },
    { engine: "charisma", title: "Practice storytelling — tell one story well today", kind: "secondary" },
    { engine: "charisma", title: "Make eye contact and smile with 5 people", kind: "secondary" },
    // Mind (5)
    { engine: "mind", title: "Study a great speaker or performer (15 min)", kind: "secondary" },
    { engine: "mind", title: "Read about communication or persuasion", kind: "secondary" },
    { engine: "mind", title: "Journal: when was I most charismatic today?", kind: "secondary" },
    { engine: "mind", title: "Learn a new joke or interesting fact to share", kind: "secondary" },
    { engine: "mind", title: "Reflect on a conversation — what could I improve?", kind: "secondary" },
    // Body (5)
    { engine: "body", title: "Work out — confidence starts with how you feel", kind: "secondary" },
    { engine: "body", title: "Practice confident posture all day", kind: "secondary" },
    { engine: "body", title: "Grooming and self-care routine", kind: "secondary" },
    { engine: "body", title: "Get enough sleep for peak energy", kind: "secondary" },
    { engine: "body", title: "Dress intentionally — look the part", kind: "secondary" },
    // Money (5)
    { engine: "money", title: "Track spending", kind: "secondary" },
    { engine: "money", title: "Explore how your speaking skills can earn money", kind: "secondary" },
    { engine: "money", title: "Review your finances briefly", kind: "secondary" },
    { engine: "money", title: "Research a monetizable skill", kind: "secondary" },
    { engine: "money", title: "Network with someone who could open doors", kind: "secondary" },
  ],
  warrior: [
    // Body (6)
    { engine: "body", title: "Complete an intense workout", kind: "main" },
    { engine: "body", title: "Track nutrition — fuel the machine", kind: "main" },
    { engine: "body", title: "Cold exposure (2 min)", kind: "secondary" },
    { engine: "body", title: "Stretch and recover (15 min)", kind: "secondary" },
    { engine: "body", title: "Push past a physical comfort zone", kind: "secondary" },
    { engine: "body", title: "Get 7+ hours of quality sleep", kind: "secondary" },
    // Mind (6)
    { engine: "mind", title: "Deep work or focused learning (60 min)", kind: "main" },
    { engine: "mind", title: "Read something challenging (30 min)", kind: "main" },
    { engine: "mind", title: "Journal: what challenged me today?", kind: "secondary" },
    { engine: "mind", title: "Meditate — train your focus (10 min)", kind: "secondary" },
    { engine: "mind", title: "Practice a mental model on a real decision", kind: "secondary" },
    { engine: "mind", title: "Learn one new thing outside your comfort zone", kind: "secondary" },
    // Money (5)
    { engine: "money", title: "Review finances briefly", kind: "secondary" },
    { engine: "money", title: "Track expenses", kind: "secondary" },
    { engine: "money", title: "Work on a project that builds your future", kind: "secondary" },
    { engine: "money", title: "Save intentionally — move money to savings", kind: "secondary" },
    { engine: "money", title: "Read about investing or financial strategy", kind: "secondary" },
    // Charisma (5)
    { engine: "charisma", title: "Practice one act of social courage", kind: "secondary" },
    { engine: "charisma", title: "Have a difficult conversation you've been avoiding", kind: "secondary" },
    { engine: "charisma", title: "Introduce yourself to someone new", kind: "secondary" },
    { engine: "charisma", title: "Stand up for something you believe in", kind: "secondary" },
    { engine: "charisma", title: "Speak up in a group setting", kind: "secondary" },
  ],
  founder: [
    // Money (6)
    { engine: "money", title: "Work on income-generating activity (60 min)", kind: "main" },
    { engine: "money", title: "Track finances and review cash flow", kind: "main" },
    { engine: "money", title: "Research a market opportunity", kind: "secondary" },
    { engine: "money", title: "Follow up with a client or prospect", kind: "secondary" },
    { engine: "money", title: "Review your revenue/savings goals", kind: "secondary" },
    { engine: "money", title: "Read about business models (15 min)", kind: "secondary" },
    // Mind (6)
    { engine: "mind", title: "Deep work on your project (90 min)", kind: "main" },
    { engine: "mind", title: "Learn one concept in your field", kind: "main" },
    { engine: "mind", title: "Map out a system or process", kind: "secondary" },
    { engine: "mind", title: "Journal: what's my biggest leverage point?", kind: "secondary" },
    { engine: "mind", title: "Read strategy or business content (20 min)", kind: "secondary" },
    { engine: "mind", title: "Solve the hardest problem on your plate", kind: "secondary" },
    // Body (5)
    { engine: "body", title: "Exercise (30 min) — energy for the grind", kind: "secondary" },
    { engine: "body", title: "Track meals", kind: "secondary" },
    { engine: "body", title: "Get enough sleep to think clearly", kind: "secondary" },
    { engine: "body", title: "Take walking breaks between work blocks", kind: "secondary" },
    { engine: "body", title: "Stay hydrated all day", kind: "secondary" },
    // Charisma (5)
    { engine: "charisma", title: "Practice your elevator pitch", kind: "secondary" },
    { engine: "charisma", title: "Network — reach out to one person in your industry", kind: "secondary" },
    { engine: "charisma", title: "Present an idea to someone and get feedback", kind: "secondary" },
    { engine: "charisma", title: "Write a compelling email or message", kind: "secondary" },
    { engine: "charisma", title: "Have a conversation with a mentor or peer", kind: "secondary" },
  ],
  charmer: [
    // Charisma (6)
    { engine: "charisma", title: "Start a conversation with someone new", kind: "main" },
    { engine: "charisma", title: "Practice confident body language all day", kind: "main" },
    { engine: "charisma", title: "Give a genuine compliment to 3 people", kind: "main" },
    { engine: "charisma", title: "Tell a story that makes someone laugh", kind: "secondary" },
    { engine: "charisma", title: "Practice maintaining eye contact", kind: "secondary" },
    { engine: "charisma", title: "Record yourself speaking and review it", kind: "secondary" },
    // Body (6)
    { engine: "body", title: "Complete a workout — look good, feel good", kind: "main" },
    { engine: "body", title: "Grooming and self-care routine", kind: "main" },
    { engine: "body", title: "Dress intentionally today", kind: "secondary" },
    { engine: "body", title: "Skincare routine", kind: "secondary" },
    { engine: "body", title: "Practice great posture all day", kind: "secondary" },
    { engine: "body", title: "Get 8 hours of beauty sleep", kind: "secondary" },
    // Mind (5)
    { engine: "mind", title: "Read about communication or psychology (15 min)", kind: "secondary" },
    { engine: "mind", title: "Study charismatic people — what makes them magnetic?", kind: "secondary" },
    { engine: "mind", title: "Journal: when did I feel most confident today?", kind: "secondary" },
    { engine: "mind", title: "Learn a new conversation technique", kind: "secondary" },
    { engine: "mind", title: "Reflect on your social interactions", kind: "secondary" },
    // Money (5)
    { engine: "money", title: "Track spending", kind: "secondary" },
    { engine: "money", title: "Explore how your social skills can earn money", kind: "secondary" },
    { engine: "money", title: "Review finances briefly", kind: "secondary" },
    { engine: "money", title: "Network with someone in a field you admire", kind: "secondary" },
    { engine: "money", title: "Invest in your appearance or personal brand", kind: "secondary" },
  ],
};

export function getStarterMissions(archetype: string): StarterMission[] {
  return STARTER_MISSIONS[archetype] ?? STARTER_MISSIONS.titan;
}
