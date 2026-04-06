#!/usr/bin/env node

/**
 * TITAN PROTOCOL — Onboarding Voice Generator
 * 
 * Generates all 30 onboarding voice lines using ElevenLabs TTS API.
 * 
 * SETUP:
 *   1. Get your API key: https://elevenlabs.io/app/settings → API Keys
 *   2. Run: ELEVENLABS_API_KEY=your_key_here node generate-onboarding-voices.js
 *      OR replace YOUR_API_KEY_HERE below
 *   3. Wait ~3-5 minutes
 *   4. Files saved to ./titan-voice-lines/onboarding/ and ./titan-voice-lines/archetypes/
 * 
 * COST: ~4,500 characters — well within Starter plan ($5/mo)
 */

const fs = require('fs');
const path = require('path');

// ══════════════════════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════════════════════

const API_KEY = process.env.ELEVENLABS_API_KEY || 'YOUR_API_KEY_HERE';
const VOICE_ID = '944agegKGy3rRXuTVa3v'; // titan v1
const MODEL_ID = 'eleven_multilingual_v2';
const OUTPUT_DIR = './titan-voice-lines';

const VOICE_SETTINGS = {
  stability: 0.65,
  similarity_boost: 0.80,
  style: 0.25,
  use_speaker_boost: true,
};

// Delay between API calls to avoid rate limits (ms)
const DELAY_BETWEEN_CALLS = 1500;

// ══════════════════════════════════════════════════════════════
// ALL 30 ONBOARDING VOICE LINES
// ══════════════════════════════════════════════════════════════

const LINES = [

  // ─── BEAT 1: COLD OPEN ──────────────────────────────────
  {
    id: 'ONBO-001',
    folder: 'onboarding',
    text: 'Titan Protocol.',
  },
  {
    id: 'ONBO-002',
    folder: 'onboarding',
    text: 'Activated.',
  },

  // ─── BEAT 2: WHAT IS THIS ───────────────────────────────
  {
    id: 'ONBO-003',
    folder: 'onboarding',
    text: "You've been selected for something most people will never see. The Titan Protocol is a personal operating system. It tracks your progress across four domains. It assigns operations. It monitors your consistency. And it pushes you beyond what you thought you were capable of. This is not an app. This is a system. And it just activated for you.",
  },

  // ─── BEAT 3: FOUR ENGINES ───────────────────────────────
  {
    id: 'ONBO-004',
    folder: 'onboarding',
    text: 'Four engines power the protocol. Body. Mind. Money. Charisma. Each one is measured. Each one is trained. Your performance across all four determines your Titan Score.',
  },

  // ─── BEAT 4: IDENTIFY ───────────────────────────────────
  {
    id: 'ONBO-005',
    folder: 'onboarding',
    text: 'Identify yourself.',
  },
  {
    id: 'ONBO-006',
    folder: 'onboarding',
    text: 'Registered.',
  },

  // ─── BEAT 5: THE QUIZ ───────────────────────────────────
  {
    id: 'ONBO-007',
    folder: 'onboarding',
    text: "The protocol adapts to its operator. I need to understand how you're wired. Answer instinctively. Don't overthink it.",
  },
  {
    id: 'ONBO-008',
    folder: 'onboarding',
    text: 'Analyzing response pattern.',
  },

  // ─── BEAT 6: THE REVEAL ─────────────────────────────────
  {
    id: 'ONBO-009',
    folder: 'onboarding',
    text: 'Identity confirmed.',
  },

  // ─── BEAT 7: THE LADDER ─────────────────────────────────
  {
    id: 'ONBO-010',
    folder: 'onboarding',
    text: "Every operator starts at the same rank. Initiate. From there, consistent execution moves you up. Operative. Agent. Specialist. Commander. Vanguard. Sentinel. And at the top... Titan. The rank isn't given. It's earned through sustained, unrelenting performance. Here's the path.",
  },

  // ─── BEAT 8: ENGINE PRIORITY ────────────────────────────
  {
    id: 'ONBO-011',
    folder: 'onboarding',
    text: 'Rank your engines. Drag them into priority order. The protocol weights your daily operations accordingly.',
  },

  // ─── BEAT 9: SCHEDULE + MODE ────────────────────────────
  {
    id: 'ONBO-012',
    folder: 'onboarding',
    text: 'Select your active days and operating mode. Titan Mode runs all four engines. Focus Mode lets you concentrate on fewer. Consistency matters more than volume.',
  },

  // ─── BEAT 10: TASK SELECTION ────────────────────────────
  {
    id: 'ONBO-013',
    folder: 'onboarding',
    text: "Select your operations. These are the tasks you'll execute daily. Start with what you know you can do. Not what sounds impressive. The protocol rewards consistency, not ambition.",
  },
  {
    id: 'ONBO-014',
    folder: 'onboarding',
    text: 'Operations configured.',
  },

  // ─── BEAT 11: FIRST OP BRIEFING ─────────────────────────
  {
    id: 'ONBO-015',
    folder: 'onboarding',
    text: 'Configuration locked. All systems are online.',
  },
  {
    id: 'ONBO-016',
    folder: 'onboarding',
    text: "Your first operation is now active. Codename: First Light. These are the tasks you selected. Complete them before the day ends. This isn't practice. This is day one. Every task you complete is logged. Every engine you feed gets stronger. Your rank, your streak, your stats. They all start now.",
  },
  {
    id: 'ONBO-017',
    folder: 'onboarding',
    text: 'Execute.',
  },

  // ─── BEAT 12: FIRST TASK COMPLETION ─────────────────────
  {
    id: 'FIRST-TASK',
    folder: 'onboarding',
    text: 'First task logged. Your protocol is live.',
  },

  // ─── ARCHETYPE MONOLOGUES ───────────────────────────────
  {
    id: 'ARCH-TITAN',
    folder: 'archetypes',
    text: "Titan. You didn't choose a specialty. You chose everything. Equal weight across all four engines. This is the hardest path in the protocol. And you picked it without hesitating. Good. You'll need that.",
  },
  {
    id: 'ARCH-ATHLETE',
    folder: 'archetypes',
    text: "Athlete. Your body is your primary engine. The protocol will push your physical capacity first, but don't mistake this for a training program. Your body is the foundation. Everything else is built on it.",
  },
  {
    id: 'ARCH-SCHOLAR',
    folder: 'archetypes',
    text: 'Scholar. You lead with your mind. Deep work, focused learning, strategic thinking. The protocol will sharpen that into something dangerous. Intelligence with discipline is an unstoppable combination.',
  },
  {
    id: 'ARCH-HUSTLER',
    folder: 'archetypes',
    text: "Hustler. You think in terms of value, leverage, and return. The protocol respects that. Your money engine leads, but we're going to make sure the other three don't become liabilities.",
  },
  {
    id: 'ARCH-SHOWMAN',
    folder: 'archetypes',
    text: "Showman. Presence. Influence. The ability to command attention and direct it. The protocol will amplify what you already have and build what you're missing.",
  },
  {
    id: 'ARCH-WARRIOR',
    folder: 'archetypes',
    text: 'Warrior. Body and mind, fused together. The oldest formula for power that exists. You operate on discipline, and the protocol will test how deep that goes.',
  },
  {
    id: 'ARCH-FOUNDER',
    folder: 'archetypes',
    text: "Founder. You build systems. You see the architecture behind everything. Mind and money, working together. The protocol is going to give you the structure to build something permanent.",
  },
  {
    id: 'ARCH-CHARMER',
    folder: 'archetypes',
    text: "Charmer. Connection is your weapon. You read people, you adapt, you influence. The protocol will make sure that power is backed by substance.",
  },

];

// ══════════════════════════════════════════════════════════════
// GENERATOR
// ══════════════════════════════════════════════════════════════

async function generateVoiceLine(line) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': API_KEY,
    },
    body: JSON.stringify({
      text: line.text,
      model_id: MODEL_ID,
      voice_settings: VOICE_SETTINGS,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error for ${line.id}: ${response.status} — ${error}`);
  }

  // Get audio as buffer
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Create output folder
  const folderPath = path.join(OUTPUT_DIR, line.folder);
  fs.mkdirSync(folderPath, { recursive: true });

  // Save MP3
  const filePath = path.join(folderPath, `${line.id}.mp3`);
  fs.writeFileSync(filePath, buffer);

  return filePath;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   TITAN PROTOCOL — Voice Line Generator          ║');
  console.log('║   Voice: titan v1                                ║');
  console.log(`║   Lines to generate: ${LINES.length}                           ║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  if (API_KEY === 'YOUR_API_KEY_HERE') {
    console.error('❌ ERROR: Set your API key first!');
    console.error('   Run: ELEVENLABS_API_KEY=your_key node generate-onboarding-voices.js');
    console.error('   Or replace YOUR_API_KEY_HERE in the script.');
    process.exit(1);
  }

  // Calculate total characters
  const totalChars = LINES.reduce((sum, l) => sum + l.text.length, 0);
  console.log(`📊 Total characters: ${totalChars.toLocaleString()}`);
  console.log(`💰 Estimated cost: well under $1 of your Starter plan`);
  console.log('');

  let success = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < LINES.length; i++) {
    const line = LINES[i];
    const progress = `[${String(i + 1).padStart(2, '0')}/${LINES.length}]`;

    try {
      process.stdout.write(`${progress} Generating ${line.id}...`);
      const filePath = await generateVoiceLine(line);
      const stats = fs.statSync(filePath);
      const sizeKB = Math.round(stats.size / 1024);
      console.log(` ✅ ${sizeKB}KB → ${filePath}`);
      success++;
    } catch (err) {
      console.log(` ❌ FAILED`);
      console.log(`       ${err.message}`);
      errors.push({ id: line.id, error: err.message });
      failed++;
    }

    // Rate limit delay (skip after last item)
    if (i < LINES.length - 1) {
      await sleep(DELAY_BETWEEN_CALLS);
    }
  }

  // Summary
  console.log('');
  console.log('════════════════════════════════════════════════════');
  console.log(`✅ Generated: ${success}/${LINES.length}`);
  if (failed > 0) {
    console.log(`❌ Failed: ${failed}`);
    errors.forEach(e => console.log(`   → ${e.id}: ${e.error}`));
  }
  console.log(`📁 Output: ${path.resolve(OUTPUT_DIR)}`);
  console.log('');

  // Show file tree
  console.log('📂 titan-voice-lines/');
  const folders = [...new Set(LINES.map(l => l.folder))];
  folders.forEach(folder => {
    const folderPath = path.join(OUTPUT_DIR, folder);
    if (fs.existsSync(folderPath)) {
      console.log(`   ├── ${folder}/`);
      const files = fs.readdirSync(folderPath).sort();
      files.forEach((file, idx) => {
        const prefix = idx === files.length - 1 ? '└──' : '├──';
        console.log(`   │   ${prefix} ${file}`);
      });
    }
  });

  console.log('');
  console.log('Next steps:');
  console.log('  1. Listen to each file — re-run individual lines if needed');
  console.log('  2. Copy titan-voice-lines/ into apps/mobile/assets/audio/protocol/');
  console.log('  3. Wire up the playback system');
  console.log('');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
