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

  // ─── Cinematic voice lines (Day 1–30) ─────────────────────────────────────
  // Day 1
  "CIN-D1-001": require("../../assets/audio/protocol/cinematics/CIN-D1-001.mp3"),
  "CIN-D1-002": require("../../assets/audio/protocol/cinematics/CIN-D1-002.mp3"),
  "CIN-D1-003": require("../../assets/audio/protocol/cinematics/CIN-D1-003.mp3"),
  // Day 2
  "CIN-D2-001": require("../../assets/audio/protocol/cinematics/CIN-D2-001.mp3"),
  "CIN-D2-002": require("../../assets/audio/protocol/cinematics/CIN-D2-002.mp3"),
  // Day 3
  "CIN-D3-001": require("../../assets/audio/protocol/cinematics/CIN-D3-001.mp3"),
  "CIN-D3-002": require("../../assets/audio/protocol/cinematics/CIN-D3-002.mp3"),
  // Day 4
  "CIN-D4-001": require("../../assets/audio/protocol/cinematics/CIN-D4-001.mp3"),
  "CIN-D4-002": require("../../assets/audio/protocol/cinematics/CIN-D4-002.mp3"),
  // Day 5
  "CIN-D5-001": require("../../assets/audio/protocol/cinematics/CIN-D5-001.mp3"),
  "CIN-D5-002": require("../../assets/audio/protocol/cinematics/CIN-D5-002.mp3"),
  // Day 6 (branching)
  "CIN-D6-UP": require("../../assets/audio/protocol/cinematics/CIN-D6-UP.mp3"),
  "CIN-D6-FLAT": require("../../assets/audio/protocol/cinematics/CIN-D6-FLAT.mp3"),
  "CIN-D6-DOWN": require("../../assets/audio/protocol/cinematics/CIN-D6-DOWN.mp3"),
  // Day 7 (branching)
  "CIN-D7-HIGH": require("../../assets/audio/protocol/cinematics/CIN-D7-HIGH.mp3"),
  "CIN-D7-MID": require("../../assets/audio/protocol/cinematics/CIN-D7-MID.mp3"),
  "CIN-D7-LOW": require("../../assets/audio/protocol/cinematics/CIN-D7-LOW.mp3"),
  // Day 8-13 (new: "The Prove It Week")
  "CIN-D8-001": require("../../assets/audio/protocol/cinematics/CIN-D8-001.mp3"),
  "CIN-D8-002": require("../../assets/audio/protocol/cinematics/CIN-D8-002.mp3"),
  "CIN-D8-003": require("../../assets/audio/protocol/cinematics/CIN-D8-003.mp3"),
  "CIN-D9-001": require("../../assets/audio/protocol/cinematics/CIN-D9-001.mp3"),
  "CIN-D9-002": require("../../assets/audio/protocol/cinematics/CIN-D9-002.mp3"),
  "CIN-D9-003": require("../../assets/audio/protocol/cinematics/CIN-D9-003.mp3"),
  "CIN-D10-001": require("../../assets/audio/protocol/cinematics/CIN-D10-001.mp3"),
  "CIN-D10-002": require("../../assets/audio/protocol/cinematics/CIN-D10-002.mp3"),
  "CIN-D10-003": require("../../assets/audio/protocol/cinematics/CIN-D10-003.mp3"),
  "CIN-D11-001": require("../../assets/audio/protocol/cinematics/CIN-D11-001.mp3"),
  "CIN-D11-002": require("../../assets/audio/protocol/cinematics/CIN-D11-002.mp3"),
  "CIN-D12-001": require("../../assets/audio/protocol/cinematics/CIN-D12-001.mp3"),
  "CIN-D12-002": require("../../assets/audio/protocol/cinematics/CIN-D12-002.mp3"),
  "CIN-D12-003": require("../../assets/audio/protocol/cinematics/CIN-D12-003.mp3"),
  "CIN-D13-001": require("../../assets/audio/protocol/cinematics/CIN-D13-001.mp3"),
  "CIN-D13-002": require("../../assets/audio/protocol/cinematics/CIN-D13-002.mp3"),
  "CIN-D13-003": require("../../assets/audio/protocol/cinematics/CIN-D13-003.mp3"),
  // Day 14 (branching)
  "CIN-D14-HIGH": require("../../assets/audio/protocol/cinematics/CIN-D14-HIGH.mp3"),
  "CIN-D14-MID": require("../../assets/audio/protocol/cinematics/CIN-D14-MID.mp3"),
  "CIN-D14-LOW": require("../../assets/audio/protocol/cinematics/CIN-D14-LOW.mp3"),
  // Day 30
  "CIN-D30-001": require("../../assets/audio/protocol/cinematics/CIN-D30-001.mp3"),
  "CIN-D30-002": require("../../assets/audio/protocol/cinematics/CIN-D30-002.mp3"),

  // ─── Rank promotion voice lines ────────────────────────────────────────────
  "RANK-OPERATIVE": require("../../assets/audio/protocol/ranks/RANK-OPERATIVE.mp3"),
  "RANK-AGENT": require("../../assets/audio/protocol/ranks/RANK-AGENT.mp3"),
  "RANK-SPECIALIST": require("../../assets/audio/protocol/ranks/RANK-SPECIALIST.mp3"),
  "RANK-COMMANDER": require("../../assets/audio/protocol/ranks/RANK-COMMANDER.mp3"),
  "RANK-VANGUARD": require("../../assets/audio/protocol/ranks/RANK-VANGUARD.mp3"),
  "RANK-SENTINEL": require("../../assets/audio/protocol/ranks/RANK-SENTINEL.mp3"),
  "RANK-TITAN": require("../../assets/audio/protocol/ranks/RANK-TITAN.mp3"),
  "RANK-DEMOTED": require("../../assets/audio/protocol/ranks/RANK-DEMOTED.mp3"),

  // ─── Boss confrontation voice lines ────────────────────────────────────────
  // Unlock (generic)
  "BOSS-UNLOCK-001": require("../../assets/audio/protocol/bosses/BOSS-UNLOCK-001.mp3"),
  "BOSS-UNLOCK-002": require("../../assets/audio/protocol/bosses/BOSS-UNLOCK-002.mp3"),
  "BOSS-UNLOCK-003": require("../../assets/audio/protocol/bosses/BOSS-UNLOCK-003.mp3"),
  // Unlock (boss-specific)
  "BOSS-FOUNDATION": require("../../assets/audio/protocol/bosses/BOSS-FOUNDATION.mp3"),
  "BOSS-CRUCIBLE": require("../../assets/audio/protocol/bosses/BOSS-CRUCIBLE.mp3"),
  "BOSS-PERFECT": require("../../assets/audio/protocol/bosses/BOSS-PERFECT.mp3"),
  "BOSS-GAUNTLET": require("../../assets/audio/protocol/bosses/BOSS-GAUNTLET.mp3"),
  // Activate
  "BOSS-ACT-001": require("../../assets/audio/protocol/bosses/BOSS-ACT-001.mp3"),
  "BOSS-ACT-002": require("../../assets/audio/protocol/bosses/BOSS-ACT-002.mp3"),
  "BOSS-ACT-003": require("../../assets/audio/protocol/bosses/BOSS-ACT-003.mp3"),
  // Defeat
  "BOSS-WIN-001": require("../../assets/audio/protocol/bosses/BOSS-WIN-001.mp3"),
  "BOSS-WIN-002": require("../../assets/audio/protocol/bosses/BOSS-WIN-002.mp3"),
  "BOSS-WIN-003": require("../../assets/audio/protocol/bosses/BOSS-WIN-003.mp3"),
  "BOSS-WIN-004": require("../../assets/audio/protocol/bosses/BOSS-WIN-004.mp3"),
  // Fail
  "BOSS-FAIL-001": require("../../assets/audio/protocol/bosses/BOSS-FAIL-001.mp3"),
  "BOSS-FAIL-002": require("../../assets/audio/protocol/bosses/BOSS-FAIL-002.mp3"),
  "BOSS-FAIL-003": require("../../assets/audio/protocol/bosses/BOSS-FAIL-003.mp3"),
  "BOSS-FAIL-004": require("../../assets/audio/protocol/bosses/BOSS-FAIL-004.mp3"),

  // ─── Failure & comeback voice lines ────────────────────────────────────────
  // Warning (1 day missed)
  "FAIL-WARN-001": require("../../assets/audio/protocol/failure/FAIL-WARN-001.mp3"),
  "FAIL-WARN-002": require("../../assets/audio/protocol/failure/FAIL-WARN-002.mp3"),
  "FAIL-WARN-003": require("../../assets/audio/protocol/failure/FAIL-WARN-003.mp3"),
  // Breach (2 days missed)
  "FAIL-BREACH-001": require("../../assets/audio/protocol/failure/FAIL-BREACH-001.mp3"),
  "FAIL-BREACH-002": require("../../assets/audio/protocol/failure/FAIL-BREACH-002.mp3"),
  "FAIL-BREACH-003": require("../../assets/audio/protocol/failure/FAIL-BREACH-003.mp3"),
  // Reset (3+ days missed)
  "FAIL-RESET-001": require("../../assets/audio/protocol/failure/FAIL-RESET-001.mp3"),
  "FAIL-RESET-002": require("../../assets/audio/protocol/failure/FAIL-RESET-002.mp3"),
  "FAIL-RESET-003": require("../../assets/audio/protocol/failure/FAIL-RESET-003.mp3"),
  // Comeback (3-day recovery)
  "FAIL-COMEBACK-001": require("../../assets/audio/protocol/failure/FAIL-COMEBACK-001.mp3"),
  "FAIL-COMEBACK-002": require("../../assets/audio/protocol/failure/FAIL-COMEBACK-002.mp3"),
  "FAIL-COMEBACK-003": require("../../assets/audio/protocol/failure/FAIL-COMEBACK-003.mp3"),
  // Recovery complete
  "FAIL-RESTORED-001": require("../../assets/audio/protocol/failure/FAIL-RESTORED-001.mp3"),
  "FAIL-RESTORED-002": require("../../assets/audio/protocol/failure/FAIL-RESTORED-002.mp3"),
  "FAIL-RESTORED-003": require("../../assets/audio/protocol/failure/FAIL-RESTORED-003.mp3"),

  // ─── Surprise operations ──────────────────────────────────────────────────
  "SURP-EMRG-001": require("../../assets/audio/protocol/surprises/SURP-EMRG-001.mp3"),
  "SURP-EMRG-002": require("../../assets/audio/protocol/surprises/SURP-EMRG-002.mp3"),
  "SURP-EMRG-003": require("../../assets/audio/protocol/surprises/SURP-EMRG-003.mp3"),
  "SURP-BONUS-001": require("../../assets/audio/protocol/surprises/SURP-BONUS-001.mp3"),
  "SURP-BONUS-002": require("../../assets/audio/protocol/surprises/SURP-BONUS-002.mp3"),
  "SURP-BONUS-003": require("../../assets/audio/protocol/surprises/SURP-BONUS-003.mp3"),
  "SURP-TRANS-001": require("../../assets/audio/protocol/surprises/SURP-TRANS-001.mp3"),
  "SURP-TRANS-002": require("../../assets/audio/protocol/surprises/SURP-TRANS-002.mp3"),
  "SURP-TRANS-003": require("../../assets/audio/protocol/surprises/SURP-TRANS-003.mp3"),
  "SURP-TRANS-004": require("../../assets/audio/protocol/surprises/SURP-TRANS-004.mp3"),
  "SURP-2XP-001": require("../../assets/audio/protocol/surprises/SURP-2XP-001.mp3"),
  "SURP-2XP-002": require("../../assets/audio/protocol/surprises/SURP-2XP-002.mp3"),

  // ─── Daily operation voice lines ─────────────────────────────────────────
  "OP-FIRST-LIGHT": require("../../assets/audio/protocol/operations/OP-FIRST-LIGHT.mp3"),
  "OP-MAINTAIN": require("../../assets/audio/protocol/operations/OP-MAINTAIN.mp3"),
  "OP-RECOVERY": require("../../assets/audio/protocol/operations/OP-RECOVERY.mp3"),
  "OP-ENGINE-REC": require("../../assets/audio/protocol/operations/OP-ENGINE-REC.mp3"),
  "OP-MOMENTUM": require("../../assets/audio/protocol/operations/OP-MOMENTUM.mp3"),
  "OP-REBUILD": require("../../assets/audio/protocol/operations/OP-REBUILD.mp3"),
  "OP-FULL-SPEC": require("../../assets/audio/protocol/operations/OP-FULL-SPEC.mp3"),
  "OP-REBALANCE": require("../../assets/audio/protocol/operations/OP-REBALANCE.mp3"),
  "OP-REFOCUS": require("../../assets/audio/protocol/operations/OP-REFOCUS.mp3"),

  // ─── Daily greetings ─────────────────────────────────────────────────────
  "DAILY-001": require("../../assets/audio/protocol/daily/DAILY-001.mp3"),
  "DAILY-002": require("../../assets/audio/protocol/daily/DAILY-002.mp3"),
  "DAILY-003": require("../../assets/audio/protocol/daily/DAILY-003.mp3"),
  "DAILY-004": require("../../assets/audio/protocol/daily/DAILY-004.mp3"),

  // ─── Task completion acknowledgments ──────────────────────────────────────
  "TASK-ACK-001": require("../../assets/audio/protocol/daily/TASK-ACK-001.mp3"),
  "TASK-ACK-002": require("../../assets/audio/protocol/daily/TASK-ACK-002.mp3"),
  "TASK-ACK-003": require("../../assets/audio/protocol/daily/TASK-ACK-003.mp3"),
  "TASK-ACK-004": require("../../assets/audio/protocol/daily/TASK-ACK-004.mp3"),

  // ─── End-of-day protocol complete ─────────────────────────────────────────
  "DAY-DONE-HIGH": require("../../assets/audio/protocol/daily/DAY-DONE-HIGH.mp3"),
  "DAY-DONE-MID": require("../../assets/audio/protocol/daily/DAY-DONE-MID.mp3"),
  "DAY-DONE-LOW": require("../../assets/audio/protocol/daily/DAY-DONE-LOW.mp3"),
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
      let resolved = false;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (resolved) return;
        if (status.isLoaded && status.didJustFinish) {
          resolved = true;
          // Only unload if we're still the active sound
          if (currentSound === sound) {
            currentSound = null;
            sound.unloadAsync().catch(() => {});
          }
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

// ─── Operation & Daily voice helpers ───────────────────────────────────────

/** Map operation type to its voice line ID. */
const OPERATION_VOICE_MAP: Record<string, string> = {
  FIRST_LIGHT: "OP-FIRST-LIGHT",
  MAINTAIN_PRESSURE: "OP-MAINTAIN",
  RECOVERY: "OP-RECOVERY",
  ENGINE_RECOVERY: "OP-ENGINE-REC",
  MOMENTUM: "OP-MOMENTUM",
  REBUILD: "OP-REBUILD",
  FULL_SPECTRUM: "OP-FULL-SPEC",
  REBALANCE: "OP-REBALANCE",
  REFOCUS: "OP-REFOCUS",
};

/**
 * Get the voice line ID for a given operation type.
 * @example getOperationVoiceId("MOMENTUM") // => "OP-MOMENTUM"
 */
export function getOperationVoiceId(operationType: string): string {
  return OPERATION_VOICE_MAP[operationType] ?? "OP-MAINTAIN";
}

/**
 * Get a daily greeting voice line ID, cycling through variants by day number.
 * @example getDailyGreetingId(14) // => "DAILY-003" (14 % 4 + 1 = 3)
 */
export function getDailyGreetingId(dayNumber: number): string {
  // Math.abs handles negative day numbers, +1 makes it 1-indexed (DAILY-001 to DAILY-004)
  const variant = (Math.abs(dayNumber) % 4) + 1;
  return `DAILY-${String(variant).padStart(3, "0")}`;
}

/** Task acknowledgment voice line IDs. */
const TASK_ACK_IDS = ["TASK-ACK-001", "TASK-ACK-002", "TASK-ACK-003", "TASK-ACK-004"];

/**
 * Play a random task completion acknowledgment voice line (fire-and-forget).
 * Throttled: won't play if another ack played within the last 2 seconds.
 */
let lastTaskAckTime = 0;
export function playRandomTaskAck(): void {
  const now = Date.now();
  if (now - lastTaskAckTime < 2000) return; // Throttle: 2s minimum gap
  lastTaskAckTime = now;
  const id = TASK_ACK_IDS[Math.floor(Math.random() * TASK_ACK_IDS.length)];
  playVoiceLineAsync(id);
}

/**
 * Get the end-of-day voice line ID based on performance level.
 * @param titanScore - The day's overall Titan Score (0-100)
 */
export function getDayDoneVoiceId(titanScore: number): string {
  if (titanScore >= 80) return "DAY-DONE-HIGH";
  if (titanScore >= 50) return "DAY-DONE-MID";
  return "DAY-DONE-LOW";
}

// ─── Failure & comeback voice helpers ──────────────────────────────────────

const FAIL_WARN_IDS = ["FAIL-WARN-001", "FAIL-WARN-002", "FAIL-WARN-003"];
const FAIL_BREACH_IDS = ["FAIL-BREACH-001", "FAIL-BREACH-002", "FAIL-BREACH-003"];
const FAIL_RESET_IDS = ["FAIL-RESET-001", "FAIL-RESET-002", "FAIL-RESET-003"];
const FAIL_COMEBACK_IDS = ["FAIL-COMEBACK-001", "FAIL-COMEBACK-002", "FAIL-COMEBACK-003"];
const FAIL_RESTORED_IDS = ["FAIL-RESTORED-001", "FAIL-RESTORED-002", "FAIL-RESTORED-003"];

function randomFrom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Get a random voice line ID for the given integrity status. */
export function getFailureVoiceId(status: "WARNING" | "BREACH" | "RESET"): string {
  switch (status) {
    case "WARNING": return randomFrom(FAIL_WARN_IDS);
    case "BREACH": return randomFrom(FAIL_BREACH_IDS);
    case "RESET": return randomFrom(FAIL_RESET_IDS);
  }
}

/** Get a random comeback voice line ID. */
export function getComebackVoiceId(): string {
  return randomFrom(FAIL_COMEBACK_IDS);
}

/** Get a random recovery complete voice line ID. */
export function getRestoredVoiceId(): string {
  return randomFrom(FAIL_RESTORED_IDS);
}

// ─── Boss voice helpers ────────────────────────────────────────────────────

const BOSS_UNLOCK_GENERIC = ["BOSS-UNLOCK-001", "BOSS-UNLOCK-002", "BOSS-UNLOCK-003"];
const BOSS_SPECIFIC_MAP: Record<string, string> = {
  boss_foundation_test: "BOSS-FOUNDATION",
  boss_crucible: "BOSS-CRUCIBLE",
  boss_perfect_week: "BOSS-PERFECT",
  boss_gauntlet: "BOSS-GAUNTLET",
};
const BOSS_ACT_IDS = ["BOSS-ACT-001", "BOSS-ACT-002", "BOSS-ACT-003"];
const BOSS_WIN_IDS = ["BOSS-WIN-001", "BOSS-WIN-002", "BOSS-WIN-003", "BOSS-WIN-004"];
const BOSS_FAIL_IDS = ["BOSS-FAIL-001", "BOSS-FAIL-002", "BOSS-FAIL-003", "BOSS-FAIL-004"];

/**
 * Get the boss unlock voice line ID. Uses boss-specific line if available,
 * otherwise a random generic unlock line.
 */
export function getBossUnlockVoiceId(bossId: string): string {
  return BOSS_SPECIFIC_MAP[bossId] ?? randomFrom(BOSS_UNLOCK_GENERIC);
}

/** Get a random boss activate voice line ID. */
export function getBossActivateVoiceId(): string {
  return randomFrom(BOSS_ACT_IDS);
}

/** Get a random boss defeat voice line ID. */
export function getBossDefeatVoiceId(): string {
  return randomFrom(BOSS_WIN_IDS);
}

/** Get a random boss fail voice line ID. */
export function getBossFailVoiceId(): string {
  return randomFrom(BOSS_FAIL_IDS);
}

// ─── Rank promotion voice helpers ──────────────────────────────────────────

/** Get the voice line ID for a rank promotion. */
export function getRankPromotionVoiceId(rank: string): string {
  const id = `RANK-${rank.toUpperCase()}`;
  // Initiate has no promotion line (it's the starting rank)
  if (rank === "initiate") return "RANK-OPERATIVE";
  return AUDIO_FILES[id] ? id : "RANK-OPERATIVE";
}

/** Get the rank demotion voice line ID. */
export function getRankDemotionVoiceId(): string {
  return "RANK-DEMOTED";
}
