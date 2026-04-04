/**
 * Protocol Audio — ElevenLabs voice-line playback for onboarding & protocol events.
 *
 * Pre-recorded MP3s are bundled in assets/audio/protocol/ and mapped by ID.
 * Uses expo-av for playback; respects the global sound preference from sound.ts.
 *
 * Usage:
 *   import { initAudio, playVoiceLine, playSequence } from "../lib/protocol-audio";
 *   await initAudio();                       // call once on app start
 *   await playVoiceLine("ONBO-001");         // plays and resolves when done
 *   playVoiceLineAsync("ONBO-002");          // fire-and-forget
 *   await playSequence([
 *     { id: "ONBO-003", delayAfter: 500 },
 *     { id: "ONBO-004" },
 *   ]);
 */

import { Audio } from "expo-av";
import { getJSON } from "../db/storage";

// ─── Preference gate ────────────────────────────────────────────────────────

const SOUND_KEY = "sound_enabled";

function isSoundEnabled(): boolean {
  return getJSON<boolean>(SOUND_KEY, true);
}

// ─── Audio file registry ────────────────────────────────────────────────────
// Maps voice-line IDs to static require() calls so Metro can bundle them.

const AUDIO_FILES: Record<string, any> = {
  // Onboarding sequence
  "ONBO-001": require("../../assets/audio/protocol/onboarding/ONBO-001.mp3"),
  "ONBO-002": require("../../assets/audio/protocol/onboarding/ONBO-002.mp3"),
  "ONBO-003": require("../../assets/audio/protocol/onboarding/ONBO-003.mp3"),
  "ONBO-004": require("../../assets/audio/protocol/onboarding/ONBO-004.mp3"),
  "ONBO-005": require("../../assets/audio/protocol/onboarding/ONBO-005.mp3"),
  "ONBO-006": require("../../assets/audio/protocol/onboarding/ONBO-006.mp3"),
  "ONBO-007": require("../../assets/audio/protocol/onboarding/ONBO-007.mp3"),
  "ONBO-008": require("../../assets/audio/protocol/onboarding/ONBO-008.mp3"),
  "ONBO-009": require("../../assets/audio/protocol/onboarding/ONBO-009.mp3"),
  "ONBO-010": require("../../assets/audio/protocol/onboarding/ONBO-010.mp3"),
  "ONBO-011": require("../../assets/audio/protocol/onboarding/ONBO-011.mp3"),
  "ONBO-012": require("../../assets/audio/protocol/onboarding/ONBO-012.mp3"),
  "ONBO-013": require("../../assets/audio/protocol/onboarding/ONBO-013.mp3"),
  "ONBO-014": require("../../assets/audio/protocol/onboarding/ONBO-014.mp3"),
  "ONBO-015": require("../../assets/audio/protocol/onboarding/ONBO-015.mp3"),
  "ONBO-016": require("../../assets/audio/protocol/onboarding/ONBO-016.mp3"),
  "ONBO-017": require("../../assets/audio/protocol/onboarding/ONBO-017.mp3"),
  "FIRST-TASK": require("../../assets/audio/protocol/onboarding/FIRST-TASK.mp3"),

  // Archetype reveal lines
  "ARCH-TITAN": require("../../assets/audio/protocol/archetypes/ARCH-TITAN.mp3"),
  "ARCH-ATHLETE": require("../../assets/audio/protocol/archetypes/ARCH-ATHLETE.mp3"),
  "ARCH-SCHOLAR": require("../../assets/audio/protocol/archetypes/ARCH-SCHOLAR.mp3"),
  "ARCH-HUSTLER": require("../../assets/audio/protocol/archetypes/ARCH-HUSTLER.mp3"),
  "ARCH-SHOWMAN": require("../../assets/audio/protocol/archetypes/ARCH-SHOWMAN.mp3"),
  "ARCH-WARRIOR": require("../../assets/audio/protocol/archetypes/ARCH-WARRIOR.mp3"),
  "ARCH-FOUNDER": require("../../assets/audio/protocol/archetypes/ARCH-FOUNDER.mp3"),
  "ARCH-CHARMER": require("../../assets/audio/protocol/archetypes/ARCH-CHARMER.mp3"),
};

// ─── Playback state ─────────────────────────────────────────────────────────

let currentSound: Audio.Sound | null = null;

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Initialize audio mode for playback (call once on app start).
 * Configures iOS silent-mode override and Android ducking.
 */
export async function initAudio(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
  });
}

/**
 * Play a voice line by ID. Stops any currently playing audio first.
 * Returns a Promise that resolves when the audio finishes playing.
 * No-ops silently if sound is disabled or the ID is unknown.
 */
export async function playVoiceLine(id: string): Promise<void> {
  if (!isSoundEnabled()) return;

  await stopCurrentAudio();

  const source = AUDIO_FILES[id];
  if (!source) {
    console.warn(`[ProtocolAudio] Unknown voice line: ${id}`);
    return;
  }

  try {
    const { sound } = await Audio.Sound.createAsync(source);
    currentSound = sound;

    return new Promise<void>((resolve) => {
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          if (currentSound === sound) currentSound = null;
          resolve();
        }
      });
      sound.playAsync();
    });
  } catch (err) {
    console.warn(`[ProtocolAudio] Failed to play ${id}:`, err);
  }
}

/**
 * Play a voice line without waiting for it to finish.
 * Useful for fire-and-forget playback during animations.
 */
export function playVoiceLineAsync(id: string): void {
  playVoiceLine(id).catch(() => {});
}

/**
 * Stop any currently playing audio and release the resource.
 */
export async function stopCurrentAudio(): Promise<void> {
  if (currentSound) {
    try {
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
    } catch {
      // Already unloaded — safe to ignore
    }
    currentSound = null;
  }
}

/**
 * Play a sequence of voice lines with optional delays between them.
 * Each line plays to completion before the next begins.
 *
 * @example
 *   await playSequence([
 *     { id: "ONBO-001", delayAfter: 800 },
 *     { id: "ONBO-002", delayAfter: 400 },
 *     { id: "ONBO-003" },
 *   ]);
 */
export async function playSequence(
  items: Array<{ id: string; delayAfter?: number }>,
): Promise<void> {
  for (const item of items) {
    await playVoiceLine(item.id);
    if (item.delayAfter) {
      await new Promise((resolve) => setTimeout(resolve, item.delayAfter));
    }
  }
}

/**
 * Get the archetype voice line ID for a given archetype name.
 * @example getArchetypeVoiceId("athlete") // => "ARCH-ATHLETE"
 */
export function getArchetypeVoiceId(archetype: string): string {
  return `ARCH-${archetype.toUpperCase()}`;
}
