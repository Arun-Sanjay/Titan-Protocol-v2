import * as Speech from "expo-speech";
import { getJSON, setJSON } from "../db/storage";

const VOICE_KEY = "voice_enabled";

export function isVoiceEnabled(): boolean {
  return getJSON<boolean>(VOICE_KEY, true);
}

export function toggleVoice(): boolean {
  const current = isVoiceEnabled();
  setJSON(VOICE_KEY, !current);
  return !current;
}

// Core speak function with protocol voice settings
export function speak(text: string, options?: { pitch?: number; rate?: number }): void {
  if (!isVoiceEnabled()) return;

  Speech.speak(text, {
    pitch: options?.pitch ?? 0.9,
    rate: options?.rate ?? 0.85,
    language: "en-US",
  });
}

export function stopSpeaking(): void {
  Speech.stop();
}

// Contextual voice functions
export function speakBriefing(operationName: string, message: string): void {
  speak(`Operation: ${operationName}. ${message}`);
}

export function speakRankUp(rankName: string): void {
  speak(`Rank promotion confirmed. You are now ${rankName}.`, { pitch: 0.85, rate: 0.8 });
}

export function speakFieldOp(event: "started" | "completed" | "failed", opName: string): void {
  const messages = {
    started: `Field operation initiated: ${opName}.`,
    completed: `Field operation complete: ${opName}. Rewards granted.`,
    failed: `Field operation failed: ${opName}. Cooldown active.`,
  };
  speak(messages[event]);
}

export function speakAchievement(name: string): void {
  speak(`Achievement unlocked: ${name}.`);
}

export function speakWeeklyDebrief(avgScore: number, streak: number): void {
  speak(`Weekly debrief. Average score: ${avgScore} percent. Current streak: ${streak} days.`, { rate: 0.9 });
}
