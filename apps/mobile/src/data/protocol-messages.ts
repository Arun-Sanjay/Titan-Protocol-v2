/**
 * Protocol dashboard messages — 60+ templates organized by phase and performance.
 * Used for inline messages on the dashboard (not full-screen cinematics).
 * Variables: [NAME], [ENGINE], [SCORE], [STREAK], [WEAK_ENGINE], [STRONG_ENGINE], [DAY]
 */

import { getJSON, setJSON } from "../db/storage";

export type ProtocolMessage = {
  text: string;
  phase: string;         // "foundation" | "building" | "intensify" | "sustain" | "any"
  performance: string;   // "high" | "moderate" | "low" | "any"
  priority: number;      // Higher = used first. Messages with same priority rotate.
};

export const PROTOCOL_MESSAGES: ProtocolMessage[] = [
  // ─── Foundation Phase (Days 8-30) ──────────────────────────────────────────

  // High performance
  { text: "[NAME]. Day [DAY]. Your consistency is building. Protocol is watching.", phase: "foundation", performance: "high", priority: 1 },
  { text: "Your [STRONG_ENGINE] engine is performing. Now make the others match.", phase: "foundation", performance: "high", priority: 1 },
  { text: "[STREAK]-day streak. The compound effect is real. Don't break it.", phase: "foundation", performance: "high", priority: 1 },
  { text: "Your output is above baseline. I'm starting to take you seriously, [NAME].", phase: "foundation", performance: "high", priority: 1 },
  { text: "The data doesn't lie. You're improving. Don't get comfortable.", phase: "foundation", performance: "high", priority: 2 },
  { text: "Day [DAY]. Strong week so far. Keep the engines running.", phase: "foundation", performance: "high", priority: 2 },
  { text: "[NAME], [SCORE]% today. That's above average. Above average is where we start.", phase: "foundation", performance: "high", priority: 2 },

  // Moderate performance
  { text: "[NAME]. Day [DAY]. You're surviving. But surviving isn't thriving.", phase: "foundation", performance: "moderate", priority: 1 },
  { text: "Your [WEAK_ENGINE] engine needs attention. It's been below 50% for three days.", phase: "foundation", performance: "moderate", priority: 1 },
  { text: "Consistency rate: moderate. I need it higher. You need it higher.", phase: "foundation", performance: "moderate", priority: 1 },
  { text: "Day [DAY]. Not bad. Not great. I expect better from you, [NAME].", phase: "foundation", performance: "moderate", priority: 2 },
  { text: "Your [STRONG_ENGINE] is carrying the team. The others are coasting.", phase: "foundation", performance: "moderate", priority: 2 },
  { text: "[NAME]. You're showing up. That's step one. Step two is showing up strong.", phase: "foundation", performance: "moderate", priority: 2 },

  // Low performance
  { text: "[NAME]. Your numbers are going the wrong direction. Fix it today.", phase: "foundation", performance: "low", priority: 1 },
  { text: "Your [WEAK_ENGINE] engine has been offline for too long. This is a warning.", phase: "foundation", performance: "low", priority: 1 },
  { text: "I don't accept excuses and neither should you. Day [DAY]. Execute.", phase: "foundation", performance: "low", priority: 1 },
  { text: "Your consistency dropped. I'm watching. Are you?", phase: "foundation", performance: "low", priority: 2 },
  { text: "[NAME]. I've seen recruits quit at this stage. Don't be one of them.", phase: "foundation", performance: "low", priority: 2 },

  // ─── Building Phase (Days 31-60) ───────────────────────────────────────────

  // High
  { text: "[NAME]. Building Phase. Day [DAY]. Your trajectory is UP. Maintain.", phase: "building", performance: "high", priority: 1 },
  { text: "Three consecutive strong days. I'm pushing the intensity up.", phase: "building", performance: "high", priority: 1 },
  { text: "[STREAK]-day streak in Building Phase. This is where good becomes great.", phase: "building", performance: "high", priority: 1 },
  { text: "Your [STRONG_ENGINE] is at [SCORE]%. Now bring [WEAK_ENGINE] up to match.", phase: "building", performance: "high", priority: 2 },
  { text: "The person who started on Day 1 wouldn't recognize you. Keep going.", phase: "building", performance: "high", priority: 2 },

  // Moderate
  { text: "[NAME]. Building Phase requires more than Foundation Phase effort.", phase: "building", performance: "moderate", priority: 1 },
  { text: "You're maintaining. But this phase is about building, not maintaining.", phase: "building", performance: "moderate", priority: 1 },
  { text: "Your [WEAK_ENGINE] is still the weak link. Address it. Today.", phase: "building", performance: "moderate", priority: 2 },
  { text: "Day [DAY]. Adequate. But you didn't start this to be adequate.", phase: "building", performance: "moderate", priority: 2 },

  // Low
  { text: "[NAME]. Your Building Phase numbers are below Foundation Phase levels. That's backwards.", phase: "building", performance: "low", priority: 1 },
  { text: "This is where most people plateau. I need you to push through it.", phase: "building", performance: "low", priority: 1 },
  { text: "Your consistency is declining. Less tasks today. More focus. Prove something.", phase: "building", performance: "low", priority: 2 },

  // ─── Intensify Phase (Days 61-90) ──────────────────────────────────────────

  // High
  { text: "[NAME]. Intensify Phase. You're in elite territory now.", phase: "intensify", performance: "high", priority: 1 },
  { text: "I stopped suggesting missions. You build your own operations now. And you're executing.", phase: "intensify", performance: "high", priority: 1 },
  { text: "[STREAK] days. The data speaks for itself.", phase: "intensify", performance: "high", priority: 2 },
  { text: "Day [DAY]. At this point I'm not training you. I'm observing what you've become.", phase: "intensify", performance: "high", priority: 2 },

  // Moderate
  { text: "[NAME]. You've come too far to coast now. Intensify means intensify.", phase: "intensify", performance: "moderate", priority: 1 },
  { text: "Day [DAY]. Good isn't good enough anymore. Not at this stage.", phase: "intensify", performance: "moderate", priority: 2 },

  // Low
  { text: "[NAME]. You earned Intensify Phase. Don't waste it.", phase: "intensify", performance: "low", priority: 1 },
  { text: "The standards are higher here. Rise to meet them or admit you peaked.", phase: "intensify", performance: "low", priority: 2 },

  // ─── Sustain Phase (Day 91+) ───────────────────────────────────────────────

  // High
  { text: "[NAME]. Day [DAY]. You don't need my motivation anymore. You are the motivation.", phase: "sustain", performance: "high", priority: 1 },
  { text: "Sustain Phase. The protocol never ends. Neither do you.", phase: "sustain", performance: "high", priority: 1 },
  { text: "[STREAK] days. At this point, quitting would feel stranger than continuing.", phase: "sustain", performance: "high", priority: 2 },

  // Moderate
  { text: "[NAME]. Even in Sustain, there's no coasting. Maintain the standard.", phase: "sustain", performance: "moderate", priority: 1 },
  { text: "Day [DAY]. You've proven you can do this. Now prove you won't stop.", phase: "sustain", performance: "moderate", priority: 2 },

  // Low
  { text: "[NAME]. After [DAY] days, I expect more. You expect more. Act like it.", phase: "sustain", performance: "low", priority: 1 },

  // ─── Any Phase (generic, used as fallbacks) ────────────────────────────────

  { text: "[NAME]. Day [DAY]. Execute.", phase: "any", performance: "any", priority: 0 },
  { text: "Another day. Another operation. Show up.", phase: "any", performance: "any", priority: 0 },
  { text: "[NAME]. The only thing between you and your goals is consistency. Be consistent today.", phase: "any", performance: "any", priority: 0 },
  { text: "Protocol is watching. Always.", phase: "any", performance: "any", priority: 0 },
  { text: "[NAME]. Your engines are waiting. Activate them.", phase: "any", performance: "any", priority: 0 },
];

/**
 * Get a dashboard message for today. Rotates through messages,
 * avoiding repeats within 7 days.
 */
export function getDashboardMessage(
  userName: string,
  dayNumber: number,
  phase: string,
  performance: string,
  streak: number,
  score: number,
  weakEngine: string,
  strongEngine: string,
): string {
  // Filter eligible messages
  const eligible = PROTOCOL_MESSAGES.filter((m) =>
    (m.phase === phase || m.phase === "any") &&
    (m.performance === performance || m.performance === "any"),
  ).sort((a, b) => b.priority - a.priority);

  if (eligible.length === 0) return `${userName}. Day ${dayNumber}. Execute.`;

  // Check recently used
  const recentIds = getJSON<number[]>("recent_message_ids", []);

  // Find first unused message
  let selected = eligible.find((_, i) => !recentIds.includes(i));
  let selectedIdx = eligible.indexOf(selected!);
  if (!selected) {
    // All used, reset and pick first
    selectedIdx = 0;
    selected = eligible[0];
  }

  // Track usage
  const newRecent = [...recentIds.slice(-6), selectedIdx]; // Keep last 7
  setJSON("recent_message_ids", newRecent);

  // Replace variables
  let text = selected.text;
  text = text.replace(/\[NAME\]/g, userName || "Recruit");
  text = text.replace(/\[DAY\]/g, String(dayNumber));
  text = text.replace(/\[STREAK\]/g, String(streak));
  text = text.replace(/\[SCORE\]/g, String(score));
  text = text.replace(/\[WEAK_ENGINE\]/g, weakEngine || "weakest");
  text = text.replace(/\[STRONG_ENGINE\]/g, strongEngine || "strongest");

  return text;
}
