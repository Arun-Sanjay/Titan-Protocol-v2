/**
 * Terminal Transmission System
 *
 * Replaces the old daily-quote system. Each app open shows a different
 * protocol-themed transmission that rotates via session counter.
 * Context-aware messages reference real user data when available.
 */

import { getJSON, setJSON } from "../db/storage";

export type Transmission = {
  text: string;
  /** If true, message contains [VARS] that need substitution */
  dynamic: boolean;
};

// ─── Static transmissions (no user data needed) ──────────────────────────────

const STATIC_TRANSMISSIONS: Transmission[] = [
  { text: "The protocol does not care about your feelings. It cares about your output.", dynamic: false },
  { text: "Discipline is a system. Systems don't need motivation.", dynamic: false },
  { text: "Every day you show up, you are voting for who you want to become.", dynamic: false },
  { text: "You are not here to survive. You are here to operate.", dynamic: false },
  { text: "Comfort is the enemy of growth. The protocol knows this.", dynamic: false },
  { text: "Your potential is not a ceiling. It's a floor you haven't stood on yet.", dynamic: false },
  { text: "The gap between who you are and who you could be is filled with reps.", dynamic: false },
  { text: "No one is coming to save you. That's the best news you'll ever hear.", dynamic: false },
  { text: "Small daily improvements compound into results that seem impossible.", dynamic: false },
  { text: "The hardest part is already over. You started.", dynamic: false },
  { text: "Average is a choice. So is extraordinary.", dynamic: false },
  { text: "The pain of discipline weighs ounces. The pain of regret weighs tons.", dynamic: false },
  { text: "You don't rise to the level of your goals. You fall to the level of your systems.", dynamic: false },
  { text: "Execute first. Analyze later. Excuses never.", dynamic: false },
  { text: "The only metric that matters today: did you show up?", dynamic: false },
  { text: "Your engines are waiting. The protocol is watching. Begin.", dynamic: false },
  { text: "Consistency beats intensity. Every single time.", dynamic: false },
  { text: "The person you were yesterday set the bar. Raise it.", dynamic: false },
  { text: "Rest is earned. Not assumed.", dynamic: false },
  { text: "Your future self is watching you right now. Make them proud.", dynamic: false },
  { text: "One percent better every day. That's the protocol.", dynamic: false },
  { text: "The world rewards operators. Not dreamers.", dynamic: false },
  { text: "Every rep counts. Every task matters. Nothing is wasted.", dynamic: false },
  { text: "Momentum is built one decision at a time.", dynamic: false },
  { text: "The protocol doesn't negotiate. Neither should you.", dynamic: false },
  { text: "What you do when no one is watching defines everything.", dynamic: false },
  { text: "There is no finish line. Only the next level.", dynamic: false },
  { text: "Your weakest engine is your biggest opportunity.", dynamic: false },
  { text: "Today's discomfort is tomorrow's baseline.", dynamic: false },
  { text: "Excuses are expensive. Discipline is free.", dynamic: false },
  { text: "The mission doesn't pause for your mood.", dynamic: false },
  { text: "You chose this. Now prove you meant it.", dynamic: false },
  { text: "Progress is invisible until it's undeniable.", dynamic: false },
  { text: "The compound effect doesn't care if you believe in it.", dynamic: false },
  { text: "Every engine online. Every day. No exceptions.", dynamic: false },
  { text: "The protocol rewards those who show up when it's hard.", dynamic: false },
  { text: "You are not behind. You are exactly where your habits put you.", dynamic: false },
  { text: "Titans aren't born. They're built. One day at a time.", dynamic: false },
  { text: "Your streak is proof. Your score is data. Your growth is real.", dynamic: false },
  { text: "The best time to start was yesterday. The second best time is now.", dynamic: false },
  { text: "Doubt kills more operations than failure ever will.", dynamic: false },
  { text: "Stop planning. Start executing. The protocol is live.", dynamic: false },
  { text: "You are the weapon. The protocol is the forge.", dynamic: false },
  { text: "Pain is temporary. Your Titan Score is permanent.", dynamic: false },
  { text: "The difference between good and great is one more rep.", dynamic: false },
  { text: "Your ceiling is someone else's floor. Keep climbing.", dynamic: false },
  { text: "The protocol doesn't reward perfection. It rewards persistence.", dynamic: false },
  { text: "Systems beat willpower. That's why you're here.", dynamic: false },
  { text: "Today is not a day off. Today is Day [DAY].", dynamic: true },
  { text: "You've been operational for [DAY] days. Don't stop now.", dynamic: true },
];

// ─── Dynamic transmissions (need user data substitution) ─────────────────────

const DYNAMIC_TRANSMISSIONS: Transmission[] = [
  { text: "Day [DAY]. Protocol integrity: [STREAK] days. All systems nominal.", dynamic: true },
  { text: "Operator [NAME]. [STREAK]-day streak active. Maintain trajectory.", dynamic: true },
  { text: "Day [DAY]. Your [STRONG_ENGINE] engine is leading. Don't let the others fall behind.", dynamic: true },
  { text: "[NAME]. Your streak stands at [STREAK] days. The compound effect is working.", dynamic: true },
  { text: "Alert: [WEAK_ENGINE] subsystem requires attention. Recommended: prioritize recovery.", dynamic: true },
  { text: "Day [DAY]. [NAME], your consistency is being recorded. Make it count.", dynamic: true },
  { text: "Protocol status: ACTIVE. Operator [NAME] — [STREAK] days unbroken.", dynamic: true },
  { text: "Directive: Day [DAY]. [NAME], all engines must fire today.", dynamic: true },
  { text: "[NAME]. Day [DAY] of the protocol. You've outlasted [DAY] versions of yourself.", dynamic: true },
  { text: "Scan complete. [STRONG_ENGINE] output: optimal. [WEAK_ENGINE]: needs work.", dynamic: true },
];

const ALL_TRANSMISSIONS = [...STATIC_TRANSMISSIONS, ...DYNAMIC_TRANSMISSIONS];

const SESSION_COUNT_KEY = "transmission_session_count";

export type TransmissionContext = {
  name?: string;
  dayNumber?: number;
  streak?: number;
  weakEngine?: string;
  strongEngine?: string;
};

/**
 * Get a transmission for this app session. Rotates on each call
 * so every app open shows a different message.
 */
export function getSessionTransmission(ctx?: TransmissionContext): string {
  const count = getJSON<number>(SESSION_COUNT_KEY, 0);
  setJSON(SESSION_COUNT_KEY, count + 1);

  // Select message via session counter
  const transmission = ALL_TRANSMISSIONS[count % ALL_TRANSMISSIONS.length];
  let text = transmission.text;

  // Substitute variables if context available
  if (transmission.dynamic && ctx) {
    text = text.replace(/\[NAME\]/g, ctx.name || "Operator");
    text = text.replace(/\[DAY\]/g, String(ctx.dayNumber || 1));
    text = text.replace(/\[STREAK\]/g, String(ctx.streak || 0));
    text = text.replace(/\[WEAK_ENGINE\]/g, ctx.weakEngine || "weakest");
    text = text.replace(/\[STRONG_ENGINE\]/g, ctx.strongEngine || "strongest");
  } else if (transmission.dynamic) {
    // No context — strip variable placeholders gracefully
    text = text.replace(/\[NAME\]/g, "Operator");
    text = text.replace(/\[DAY\]/g, "—");
    text = text.replace(/\[STREAK\]/g, "—");
    text = text.replace(/\[WEAK_ENGINE\]/g, "—");
    text = text.replace(/\[STRONG_ENGINE\]/g, "—");
  }

  return text;
}

/**
 * Get transmission number for display (e.g., "TRANSMISSION #047")
 */
export function getTransmissionNumber(): string {
  const count = getJSON<number>(SESSION_COUNT_KEY, 0);
  return String(count).padStart(3, "0");
}
