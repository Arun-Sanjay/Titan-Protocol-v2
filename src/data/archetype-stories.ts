/**
 * Archetype Story Arcs
 *
 * Unique narrative entries for each of the 8 archetypes across 6 chapters.
 * Triggered at specific day milestones to create a cinematic journey
 * that feels personal to each archetype's identity.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type StoryEntry = {
  day: number;
  chapter: number;
  text: string;
  tone: "dramatic" | "personal";
};

export type ArchetypeStories = Record<string, StoryEntry[]>;

// ─── Story Arcs ─────────────────────────────────────────────────────────────

export const ARCHETYPE_STORIES: ArchetypeStories = {
  // ═══════════════════════════════════════════════════════════════════════════
  // THE TITAN — All engines at full power
  // ═══════════════════════════════════════════════════════════════════════════
  titan: [
    // Chapter 1: The Awakening (Days 1–14)
    { day: 1,  chapter: 1, tone: "dramatic",  text: "The Titan wakes. Four engines ignite simultaneously — body, mind, money, charisma. Most people can barely run one. This one demands all four." },
    { day: 3,  chapter: 1, tone: "personal",  text: "You trained your body. You fed your mind. You moved money. You connected with someone. All in one day. That's not normal — and you should never want to be normal." },
    { day: 5,  chapter: 1, tone: "personal",  text: "Five days in and the pattern is forming. Every engine, every day. Your friends specialize. You refuse to. That refusal is your edge." },
    { day: 7,  chapter: 1, tone: "dramatic",  text: "Seven days. The Titan has touched every engine for a full week. The system is alive. The compound effect has begun its quiet, relentless work." },
    { day: 10, chapter: 1, tone: "personal",  text: "You feel the pull to coast on your strongest engine and neglect the rest. Resist it. A Titan with a weak link is just a person with a hobby." },
    { day: 14, chapter: 1, tone: "dramatic",  text: "Two weeks of total commitment. The Titan has done what most never attempt — sustained excellence across every dimension. Chapter 1 closes with all engines running hot." },

    // Chapter 2: Building the Machine (Days 15–28)
    { day: 15, chapter: 2, tone: "dramatic",  text: "Chapter 2 opens. The Titan enters the forge. The foundations are set — now the machine must be stress-tested. Harder sessions. Deeper focus. Bigger moves." },
    { day: 17, chapter: 2, tone: "personal",  text: "You're starting to notice something: when your body is strong, your mind is sharper. When your mind is sharp, your money moves are better. When money flows, confidence rises. It's all one system." },
    { day: 21, chapter: 2, tone: "dramatic",  text: "Three weeks. Twenty-one days of feeding four engines. The Titan is no longer building habits — the habits are building the Titan." },
    { day: 28, chapter: 2, tone: "personal",  text: "One month. You've done more in four weeks than most do in four months. Don't celebrate yet — this is the baseline now. The floor, not the ceiling." },

    // Chapter 3: The Crucible (Days 29–42)
    { day: 29, chapter: 3, tone: "dramatic",  text: "Chapter 3: The Crucible. The Titan enters the fire. Comfort is the enemy now. Every engine must be pushed past the point of diminishing returns — because that's where growth actually lives." },
    { day: 35, chapter: 3, tone: "personal",  text: "Five weeks. There are days where everything screams at you to pick one lane and abandon the rest. You don't. That discipline across all four engines is what separates a Titan from a specialist." },
    { day: 42, chapter: 3, tone: "dramatic",  text: "Six weeks forged in the crucible. The Titan emerges harder, sharper, more dangerous. Every engine has been tested. None have failed." },

    // Chapter 4: The Expansion (Days 43–56)
    { day: 43, chapter: 4, tone: "dramatic",  text: "Chapter 4: The Expansion. The Titan no longer fits inside the original blueprint. The body demands heavier loads. The mind craves deeper problems. The money wants bigger plays. Charisma commands larger rooms." },
    { day: 49, chapter: 4, tone: "personal",  text: "Seven weeks. People around you have started to notice. They don't understand how you seem sharper, stronger, more present all at once. They don't see the protocol. They just see the result." },
    { day: 56, chapter: 4, tone: "personal",  text: "Eight weeks of all-engine execution. You're not just improving — you're compounding. Each engine feeds the others. The gap between you and who you were on Day 1 is becoming absurd." },

    // Chapter 5: The Reckoning (Days 57–70)
    { day: 57, chapter: 5, tone: "dramatic",  text: "Chapter 5: The Reckoning. The Titan faces the mirror. Raw numbers. Real output. No ego, no excuses. Have the engines actually grown — or have you been going through the motions?" },
    { day: 63, chapter: 5, tone: "personal",  text: "Nine weeks. You know things about yourself now that you didn't know on Day 1. Which engine fights you the hardest. Which one lies to you. Which one you secretly love. That awareness is power." },
    { day: 70, chapter: 5, tone: "dramatic",  text: "Ten weeks. Seventy days. The Titan has outlasted every excuse, every bad day, every reason to quit. The reckoning is over. What remains is unbreakable." },

    // Chapter 6: Ascension (Days 71–84)
    { day: 71, chapter: 6, tone: "dramatic",  text: "Chapter 6: Ascension. The Titan rises. This is no longer about building habits or proving commitment. This is about legacy. Four engines. One protocol. A life designed on purpose." },
    { day: 77, chapter: 6, tone: "personal",  text: "Eleven weeks. You've become someone who operates at a level that most people don't believe is possible. Body, mind, money, charisma — all firing. This is your new normal." },
    { day: 84, chapter: 6, tone: "dramatic",  text: "Eighty-four days. The Titan Protocol is complete. But the Titan is just beginning. The engines don't stop. The protocol doesn't end. It becomes who you are." },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // THE ATHLETE — Body is the foundation
  // ═══════════════════════════════════════════════════════════════════════════
  athlete: [
    // Chapter 1: The Awakening (Days 1–14)
    { day: 1,  chapter: 1, tone: "dramatic",  text: "The Athlete draws first breath. The body is the foundation — every rep, every set, every mile is a brick in the structure of who they're becoming." },
    { day: 3,  chapter: 1, tone: "personal",  text: "Your muscles ache. Your lungs burn from the last set. Good. That ache is the sound of weakness leaving. The body you want is on the other side of the body you have." },
    { day: 5,  chapter: 1, tone: "personal",  text: "You showed up again today when you didn't feel like it. Feelings are irrelevant to athletes. The protocol doesn't care about your mood." },
    { day: 7,  chapter: 1, tone: "dramatic",  text: "Seven days. The Athlete has not missed a single session. The body is already responding — muscles remembering, endurance building. One week of truth." },
    { day: 10, chapter: 1, tone: "personal",  text: "Your body is adapting faster than you expected. Sleep is better. Energy is higher. This isn't motivation — it's physiology rewarding consistency." },
    { day: 14, chapter: 1, tone: "dramatic",  text: "Two weeks of relentless physical output. The Athlete's body is no longer protesting — it's cooperating. Chapter 1 closes with sweat and progress." },

    // Chapter 2: Building the Machine (Days 15–28)
    { day: 15, chapter: 2, tone: "dramatic",  text: "Chapter 2 begins. The Athlete enters the pain cave. Foundations are built — now the real training starts. Heavier loads. Faster times. Fewer excuses." },
    { day: 17, chapter: 2, tone: "personal",  text: "You're eating cleaner without even thinking about it. The body is pulling you toward better fuel. When you train hard, junk food stops making sense." },
    { day: 21, chapter: 2, tone: "dramatic",  text: "Three weeks of unbroken physical discipline. The Athlete's body is transforming — not in the mirror yet, but in capacity. The engine is getting stronger." },
    { day: 28, chapter: 2, tone: "personal",  text: "One month. You can do things today that would have destroyed you on Day 1. Your body isn't the same body. And neither are you." },

    // Chapter 3: The Crucible (Days 29–42)
    { day: 29, chapter: 3, tone: "dramatic",  text: "Chapter 3: The Crucible. The Athlete meets the wall. The body has adapted to the current load — now it must be broken again to grow again. Plateau is not an option." },
    { day: 35, chapter: 3, tone: "personal",  text: "Five weeks in and the temptation is to coast. Your body feels good, so why push harder? Because good is the enemy of great. And you didn't start this to be good." },
    { day: 42, chapter: 3, tone: "dramatic",  text: "Six weeks. The Athlete has pushed through the crucible. The body that entered is not the body that emerged. Stronger. Leaner. Harder to kill." },

    // Chapter 4: The Expansion (Days 43–56)
    { day: 43, chapter: 4, tone: "dramatic",  text: "Chapter 4: The Expansion. The Athlete's physical capacity has outgrown the original program. New benchmarks. New personal records. The body demands more." },
    { day: 49, chapter: 4, tone: "personal",  text: "Seven weeks. People are starting to ask what you're doing. What changed. The answer is simple: you stopped negotiating with yourself about showing up." },
    { day: 56, chapter: 4, tone: "personal",  text: "Eight weeks of treating your body like a machine worth maintaining. You move differently now. You carry yourself like someone who knows what they're capable of." },

    // Chapter 5: The Reckoning (Days 57–70)
    { day: 57, chapter: 5, tone: "dramatic",  text: "Chapter 5: The Reckoning. The Athlete strips away ego and faces the numbers. PRs don't lie. Body composition doesn't lie. Have you actually grown, or just survived?" },
    { day: 63, chapter: 5, tone: "personal",  text: "Nine weeks. You've learned that the body is honest. It rewards exactly what you give it — no more, no less. Every shortcut shows up eventually. So does every hard session." },
    { day: 70, chapter: 5, tone: "dramatic",  text: "Ten weeks of forging the body. The Athlete's physical engine is operating at a level that would have seemed impossible on Day 1. The reckoning confirms it." },

    // Chapter 6: Ascension (Days 71–84)
    { day: 71, chapter: 6, tone: "dramatic",  text: "Chapter 6: Ascension. The Athlete rises above the amateur. This body is no longer a project — it's a weapon. Maintained daily. Sharpened constantly. Deployed with precision." },
    { day: 77, chapter: 6, tone: "personal",  text: "Eleven weeks. Training is no longer something you do. It's something you are. The gym isn't a chore — it's where you go to become the next version of yourself." },
    { day: 84, chapter: 6, tone: "dramatic",  text: "Eighty-four days of physical mastery. The Athlete has built something that can't be bought, borrowed, or faked. The body is the proof. The protocol continues." },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // THE SCHOLAR — The mind is the ultimate weapon
  // ═══════════════════════════════════════════════════════════════════════════
  scholar: [
    // Chapter 1: The Awakening (Days 1–14)
    { day: 1,  chapter: 1, tone: "dramatic",  text: "The Scholar opens the first page. The mind is the ultimate weapon — and today it begins sharpening. Knowledge compounds faster than money when you show up every day." },
    { day: 3,  chapter: 1, tone: "personal",  text: "You read when others scrolled. You studied when others binged. Three days of choosing depth over distraction. The gap is already opening." },
    { day: 5,  chapter: 1, tone: "personal",  text: "Your focus is lengthening. Five days of deliberate cognitive effort and the mind is remembering what it's built for — sustained, deep, uninterrupted thought." },
    { day: 7,  chapter: 1, tone: "dramatic",  text: "Seven days. The Scholar has consumed more real knowledge in one week than most absorb in a month. The mind is not just sharper — it's hungrier." },
    { day: 10, chapter: 1, tone: "personal",  text: "You're starting to connect ideas across domains. That article links to that book which explains that pattern. This is how intellectual capital compounds." },
    { day: 14, chapter: 1, tone: "dramatic",  text: "Two weeks of feeding the mind. The Scholar's cognitive engine hums with new connections, new frameworks, new ways of seeing. Chapter 1 closes with a mind transformed." },

    // Chapter 2: Building the Machine (Days 15–28)
    { day: 15, chapter: 2, tone: "dramatic",  text: "Chapter 2 begins. The Scholar enters the library of deeper waters. Surface knowledge was Chapter 1. Now the real intellectual work begins — synthesis, analysis, original thought." },
    { day: 17, chapter: 2, tone: "personal",  text: "You caught yourself thinking differently today. A problem that would have stumped you two weeks ago — you saw three solutions before your coffee cooled. That's the protocol working." },
    { day: 21, chapter: 2, tone: "dramatic",  text: "Three weeks. Twenty-one days of relentless mental input. The Scholar is no longer collecting information — they're building a mental operating system." },
    { day: 28, chapter: 2, tone: "personal",  text: "One month of prioritizing your mind over everything else. You think faster. You read deeper. You question better. The mind engine doesn't just run — it leads." },

    // Chapter 3: The Crucible (Days 29–42)
    { day: 29, chapter: 3, tone: "dramatic",  text: "Chapter 3: The Crucible. The Scholar faces the hard problems — the ones that can't be solved in a single sitting. Intellectual endurance is now the test." },
    { day: 35, chapter: 3, tone: "personal",  text: "Five weeks in. You've hit the wall where learning feels slow and progress feels invisible. This is where most quit. The Scholar knows that mastery lives on the other side of boredom." },
    { day: 42, chapter: 3, tone: "dramatic",  text: "Six weeks. The Scholar has pushed through the intellectual desert. The mind that emerged is not the mind that entered — it's more patient, more rigorous, more dangerous." },

    // Chapter 4: The Expansion (Days 43–56)
    { day: 43, chapter: 4, tone: "dramatic",  text: "Chapter 4: The Expansion. The Scholar's intellectual reach exceeds the original scope. New fields beckon. Old assumptions crumble. The mind demands bigger problems." },
    { day: 49, chapter: 4, tone: "personal",  text: "Seven weeks. You're the person in the room who sees what others miss. Not because you're smarter — because you've been doing the work they haven't." },
    { day: 56, chapter: 4, tone: "personal",  text: "Eight weeks of building mental infrastructure. You don't just have knowledge — you have a system for acquiring it, testing it, and applying it. That's the difference." },

    // Chapter 5: The Reckoning (Days 57–70)
    { day: 57, chapter: 5, tone: "dramatic",  text: "Chapter 5: The Reckoning. The Scholar turns the lens inward. How much of what you've learned have you actually applied? Knowledge without action is trivia." },
    { day: 63, chapter: 5, tone: "personal",  text: "Nine weeks. You've learned to distrust easy answers and sit with complexity. That patience — that willingness to not know yet — is intellectual maturity." },
    { day: 70, chapter: 5, tone: "dramatic",  text: "Ten weeks of cognitive devotion. The Scholar's mind engine operates with a clarity and speed that the Day 1 version would not recognize. The reckoning is satisfied." },

    // Chapter 6: Ascension (Days 71–84)
    { day: 71, chapter: 6, tone: "dramatic",  text: "Chapter 6: Ascension. The Scholar rises. The mind is no longer just a tool — it's a competitive advantage. Every conversation, every decision, every problem filters through a sharper lens." },
    { day: 77, chapter: 6, tone: "personal",  text: "Eleven weeks. Learning isn't a task on your list anymore. It's how you breathe. Books, ideas, deep work — they're not obligations. They're fuel." },
    { day: 84, chapter: 6, tone: "dramatic",  text: "Eighty-four days of sharpening the ultimate weapon. The Scholar's mind is a fortress of knowledge, a machine of synthesis. The protocol doesn't end. The learning never stops." },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // THE HUSTLER — While they sleep, you build
  // ═══════════════════════════════════════════════════════════════════════════
  hustler: [
    // Chapter 1: The Awakening (Days 1–14)
    { day: 1,  chapter: 1, tone: "dramatic",  text: "The Hustler clocks in. While the world hits snooze, the money engine fires. Every dollar tracked, every opportunity logged, every side hustle mapped. The grind has a name now." },
    { day: 3,  chapter: 1, tone: "personal",  text: "You tracked every dollar today. Income, expenses, leaks. Most people have no idea where their money goes. You're not most people." },
    { day: 5,  chapter: 1, tone: "personal",  text: "Five days of treating money like a system instead of a feeling. You're starting to see patterns — where it flows, where it leaks, where it could multiply." },
    { day: 7,  chapter: 1, tone: "dramatic",  text: "Seven days. The Hustler has a financial pulse for the first time. Numbers replace guesses. Strategy replaces hope. The money engine is awake." },
    { day: 10, chapter: 1, tone: "personal",  text: "You turned down a purchase today because it didn't serve the plan. That's not deprivation — that's strategic thinking. Money is a tool, and you're learning to wield it." },
    { day: 14, chapter: 1, tone: "dramatic",  text: "Two weeks of financial awareness. The Hustler has mapped the terrain — income streams, expenses, opportunities. Chapter 1 closes with clarity where chaos used to live." },

    // Chapter 2: Building the Machine (Days 15–28)
    { day: 15, chapter: 2, tone: "dramatic",  text: "Chapter 2 begins. The Hustler enters build mode. Awareness was step one. Now comes execution — new income streams, optimized spending, money working while you sleep." },
    { day: 17, chapter: 2, tone: "personal",  text: "You're thinking in terms of ROI on everything now. Your time, your energy, your attention — they all have a price. The Hustler calculates before committing." },
    { day: 21, chapter: 2, tone: "dramatic",  text: "Three weeks. Twenty-one days of relentless financial discipline. The Hustler isn't just saving money — they're building an engine that generates it." },
    { day: 28, chapter: 2, tone: "personal",  text: "One month. You've cut waste, identified opportunities, and started building something. The gap between your financial reality and your financial goal is shrinking daily." },

    // Chapter 3: The Crucible (Days 29–42)
    { day: 29, chapter: 3, tone: "dramatic",  text: "Chapter 3: The Crucible. The Hustler faces the slow months. Revenue doesn't always climb. Deals fall through. The money engine is tested by patience and persistence." },
    { day: 35, chapter: 3, tone: "personal",  text: "Five weeks in and the dopamine of quick wins has faded. Real wealth is boring. It's the same disciplined moves repeated until they compound. Stay in the game." },
    { day: 42, chapter: 3, tone: "dramatic",  text: "Six weeks. The Hustler has survived the slow season. When others panicked or quit, the money engine kept running. Discipline beats luck every time." },

    // Chapter 4: The Expansion (Days 43–56)
    { day: 43, chapter: 4, tone: "dramatic",  text: "Chapter 4: The Expansion. The Hustler's money engine outgrows the original plan. New ventures demand attention. Bigger moves require bigger thinking. Scale or stagnate." },
    { day: 49, chapter: 4, tone: "personal",  text: "Seven weeks. You're making money decisions with a clarity that your Day 1 self would envy. Not emotional. Not reactive. Strategic. Calculated. Patient." },
    { day: 56, chapter: 4, tone: "personal",  text: "Eight weeks of building the money engine. Compound interest isn't just a financial concept — it applies to skills, relationships, and reputation too. You're leveraging all of it." },

    // Chapter 5: The Reckoning (Days 57–70)
    { day: 57, chapter: 5, tone: "dramatic",  text: "Chapter 5: The Reckoning. The Hustler opens the books. Net worth. Cash flow. Growth rate. The numbers tell the truth — and the truth demands honest assessment." },
    { day: 63, chapter: 5, tone: "personal",  text: "Nine weeks. You've learned that hustle without strategy is just exhaustion with extra steps. The smartest move is often the one that makes money while you sleep." },
    { day: 70, chapter: 5, tone: "dramatic",  text: "Ten weeks. Seventy days of financial obsession. The Hustler's money engine produces results that would have seemed fictional on Day 1. The reckoning approves." },

    // Chapter 6: Ascension (Days 71–84)
    { day: 71, chapter: 6, tone: "dramatic",  text: "Chapter 6: Ascension. The Hustler rises above the paycheck-to-paycheck existence. Money is no longer a source of stress — it's a system that runs, grows, and compounds." },
    { day: 77, chapter: 6, tone: "personal",  text: "Eleven weeks. You don't hustle out of desperation anymore. You hustle because you see what's possible. The game has changed from survival to strategy." },
    { day: 84, chapter: 6, tone: "dramatic",  text: "Eighty-four days of building the money machine. The Hustler's financial engine is self-sustaining. The grind isn't over — it's just smarter now. The protocol continues." },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // THE SHOWMAN — When you speak, rooms go quiet
  // ═══════════════════════════════════════════════════════════════════════════
  showman: [
    // Chapter 1: The Awakening (Days 1–14)
    { day: 1,  chapter: 1, tone: "dramatic",  text: "The Showman steps into the light. Charisma isn't born — it's forged. Every word practiced, every gesture refined, every room a stage. The performance of a lifetime begins now." },
    { day: 3,  chapter: 1, tone: "personal",  text: "You spoke up today when you normally would have stayed quiet. Your voice shook a little. That's fine. Courage always trembles before it roars." },
    { day: 5,  chapter: 1, tone: "personal",  text: "Five days of investing in how you show up. Your posture, your tone, the way you hold eye contact. These aren't vanity — they're communication weapons." },
    { day: 7,  chapter: 1, tone: "dramatic",  text: "Seven days. The Showman has begun the transformation from wallflower to force of nature. The charisma engine hums with new confidence. People are starting to listen." },
    { day: 10, chapter: 1, tone: "personal",  text: "You made someone laugh today. Really laugh. You held a conversation and left them better than you found them. That's charisma — making others feel your energy." },
    { day: 14, chapter: 1, tone: "dramatic",  text: "Two weeks of deliberate presence work. The Showman's voice is steadier, posture taller, impact deeper. Chapter 1 closes with a performer finding their stage." },

    // Chapter 2: Building the Machine (Days 15–28)
    { day: 15, chapter: 2, tone: "dramatic",  text: "Chapter 2 begins. The Showman takes the bigger stage. Conversations become speeches. Small rooms become crowds. The charisma engine demands a larger audience." },
    { day: 17, chapter: 2, tone: "personal",  text: "You're noticing how people react to you differently now. They lean in when you talk. They remember what you said. That's not an accident — that's the protocol working." },
    { day: 21, chapter: 2, tone: "dramatic",  text: "Three weeks. Twenty-one days of refining the art of influence. The Showman doesn't just enter rooms anymore — they shift the energy of them." },
    { day: 28, chapter: 2, tone: "personal",  text: "One month of building your presence. You used to fear silence in conversation. Now you use it. A pause is a tool. So is a smile. So is knowing when to stop talking." },

    // Chapter 3: The Crucible (Days 29–42)
    { day: 29, chapter: 3, tone: "dramatic",  text: "Chapter 3: The Crucible. The Showman faces the hostile audience — the room that doesn't want to listen. Rejection, awkward silences, flat jokes. Charisma is tested by failure." },
    { day: 35, chapter: 3, tone: "personal",  text: "Five weeks in. You bombed a conversation today. It happens. The difference between a Showman and a talker is what you do with the silence after the failure." },
    { day: 42, chapter: 3, tone: "dramatic",  text: "Six weeks. The Showman has survived the crucible of rejection and come out sharper. The voice that was tested by silence is now comfortable in it." },

    // Chapter 4: The Expansion (Days 43–56)
    { day: 43, chapter: 4, tone: "dramatic",  text: "Chapter 4: The Expansion. The Showman's reach grows. Networking, public speaking, content creation — the charisma engine spills beyond one-on-one and fills arenas." },
    { day: 49, chapter: 4, tone: "personal",  text: "Seven weeks. You walked into a room of strangers today and left with allies. Not because you performed — because you connected. That's the evolution." },
    { day: 56, chapter: 4, tone: "personal",  text: "Eight weeks of building your stage presence. You've learned that real charisma isn't about being the loudest voice — it's about being the most magnetic one." },

    // Chapter 5: The Reckoning (Days 57–70)
    { day: 57, chapter: 5, tone: "dramatic",  text: "Chapter 5: The Reckoning. The Showman asks the hard question — are people listening because of substance, or just spectacle? Charisma without depth is entertainment. With depth, it's leadership." },
    { day: 63, chapter: 5, tone: "personal",  text: "Nine weeks. You've learned that the best speakers listen more than they talk. Influence isn't about volume — it's about timing, empathy, and knowing what the room needs." },
    { day: 70, chapter: 5, tone: "dramatic",  text: "Ten weeks. The Showman's charisma engine is refined, tested, and proven. This isn't performance anymore. It's presence. The reckoning finds substance beneath the stage." },

    // Chapter 6: Ascension (Days 71–84)
    { day: 71, chapter: 6, tone: "dramatic",  text: "Chapter 6: Ascension. The Showman transcends performance. When they speak, rooms go quiet — not because of tricks, but because every word carries weight. This is mastery." },
    { day: 77, chapter: 6, tone: "personal",  text: "Eleven weeks. You don't need to perform anymore. Your presence alone shifts the room. Confidence radiates without a single word. That's the highest form of charisma." },
    { day: 84, chapter: 6, tone: "dramatic",  text: "Eighty-four days of forging the voice. The Showman commands any stage, any room, any crowd. The charisma engine doesn't shut off. It becomes the default mode." },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // THE WARRIOR — Discipline bridges who you are and who you want to be
  // ═══════════════════════════════════════════════════════════════════════════
  warrior: [
    // Chapter 1: The Awakening (Days 1–14)
    { day: 1,  chapter: 1, tone: "dramatic",  text: "The Warrior draws first breath in a world that doesn't know what's coming. Two engines — body and mind — locked together as one weapon. Discipline is now law." },
    { day: 3,  chapter: 1, tone: "personal",  text: "You trained your body this morning and sharpened your mind tonight. Most people do neither. You did both. That's the Warrior's way — no engine left behind." },
    { day: 5,  chapter: 1, tone: "personal",  text: "Your body is sore from training. Your mind is tired from learning. Both are growing. The Warrior doesn't rest one to feed the other — they grow together or not at all." },
    { day: 7,  chapter: 1, tone: "dramatic",  text: "Seven days of dual-engine warfare. The Warrior's body is harder and the mind is sharper. They feed each other — physical discipline creates mental clarity. Mental focus fuels physical performance." },
    { day: 10, chapter: 1, tone: "personal",  text: "You did your hardest workout after your deepest study session today. You should have been exhausted. But the mind powered the body, and the body grounded the mind. That's the loop." },
    { day: 14, chapter: 1, tone: "dramatic",  text: "Two weeks. The Warrior has forged the body-mind connection into something real. Not a theory — a daily practice. Chapter 1 closes with both engines synchronized." },

    // Chapter 2: Building the Machine (Days 15–28)
    { day: 15, chapter: 2, tone: "dramatic",  text: "Chapter 2 opens. The Warrior enters the dojo of deeper work. Physical training intensifies. Mental training deepens. The dual-engine system is stress-tested under real pressure." },
    { day: 17, chapter: 2, tone: "personal",  text: "You've noticed something: on days you train hard, your reading comprehension is better. On days you study deeply, your workouts have more focus. You're not imagining it. The science backs it up." },
    { day: 21, chapter: 2, tone: "dramatic",  text: "Three weeks of body-and-mind warfare. The Warrior has built a system that most people don't believe exists — physical and intellectual excellence running in parallel." },
    { day: 28, chapter: 2, tone: "personal",  text: "One month. Your body is a weapon. Your mind is a fortress. Together they make you something that no single-engine operator can match. The Warrior doesn't specialize — they integrate." },

    // Chapter 3: The Crucible (Days 29–42)
    { day: 29, chapter: 3, tone: "dramatic",  text: "Chapter 3: The Crucible. The Warrior faces the breaking point — when body and mind both scream for rest on the same day. This is where lesser operators crack. The Warrior adapts." },
    { day: 35, chapter: 3, tone: "personal",  text: "Five weeks of dual-engine discipline. There are days when every fiber says stop. The mind begs for distraction. The body begs for the couch. You override both. That's not stubbornness — it's mastery." },
    { day: 42, chapter: 3, tone: "dramatic",  text: "Six weeks in the crucible. The Warrior emerges with a body that doesn't quit and a mind that doesn't wander. The dual engine was tested. It held." },

    // Chapter 4: The Expansion (Days 43–56)
    { day: 43, chapter: 4, tone: "dramatic",  text: "Chapter 4: The Expansion. The Warrior's capacity for pain and learning has grown beyond the original limits. Heavier loads. Harder books. Longer sessions. Both engines demand more." },
    { day: 49, chapter: 4, tone: "personal",  text: "Seven weeks. You're becoming the person who trains before dawn and reads after dark. Not because you have to — because the body and mind are both hungry. Let them feed." },
    { day: 56, chapter: 4, tone: "personal",  text: "Eight weeks of training the body and the mind as one system. You don't separate them anymore. A hard run is meditation. Deep reading is endurance training. It's all the same engine." },

    // Chapter 5: The Reckoning (Days 57–70)
    { day: 57, chapter: 5, tone: "dramatic",  text: "Chapter 5: The Reckoning. The Warrior faces the audit. Has the body actually grown stronger? Has the mind actually grown sharper? Or has discipline become routine without progress?" },
    { day: 63, chapter: 5, tone: "personal",  text: "Nine weeks. You've discovered your true edge: while others are strong but dull, or smart but fragile, you are both. The body-mind weapon has no counter." },
    { day: 70, chapter: 5, tone: "dramatic",  text: "Ten weeks. The Warrior's dual engines have been audited, tested, and confirmed. Stronger. Sharper. More resilient. The reckoning is complete." },

    // Chapter 6: Ascension (Days 71–84)
    { day: 71, chapter: 6, tone: "dramatic",  text: "Chapter 6: Ascension. The Warrior transcends the duality. Body and mind are no longer two engines — they're one system, one identity, one relentless force." },
    { day: 77, chapter: 6, tone: "personal",  text: "Eleven weeks. Discipline isn't a bridge anymore — it's the ground you walk on. Training the body and mind is as automatic as breathing. This is who you are now." },
    { day: 84, chapter: 6, tone: "dramatic",  text: "Eighty-four days of dual-engine warfare. The Warrior stands as proof that body and mind are one weapon. The discipline continues. The protocol is permanent." },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // THE FOUNDER — Think strategically. Build relentlessly.
  // ═══════════════════════════════════════════════════════════════════════════
  founder: [
    // Chapter 1: The Awakening (Days 1–14)
    { day: 1,  chapter: 1, tone: "dramatic",  text: "The Founder launches. Two engines roar to life — money and mind — locked in a feedback loop of strategic thinking and relentless execution. Ideas without revenue die. Revenue without ideas stagnates." },
    { day: 3,  chapter: 1, tone: "personal",  text: "You spotted an opportunity today that three months ago you would have missed. Your mind is sharpening. Your money sense is calibrating. The Founder's dual engine is waking up." },
    { day: 5,  chapter: 1, tone: "personal",  text: "You turned knowledge into a financial decision today. A book you read informed a move you made. That's the Founder's loop — learn, apply, profit, repeat." },
    { day: 7,  chapter: 1, tone: "dramatic",  text: "Seven days. The Founder has established the rhythm — study in the morning, build in the afternoon, review at night. The money-mind engine doesn't rest. It iterates." },
    { day: 10, chapter: 1, tone: "personal",  text: "You're thinking in systems now. Not just 'how do I make money?' but 'how do I build something that makes money while I learn the next thing?' That shift is everything." },
    { day: 14, chapter: 1, tone: "dramatic",  text: "Two weeks of strategic building. The Founder has planted seeds — some intellectual, some financial. Chapter 1 closes with a blueprint that's already generating returns." },

    // Chapter 2: Building the Machine (Days 15–28)
    { day: 15, chapter: 2, tone: "dramatic",  text: "Chapter 2 begins. The Founder enters build mode. The blueprint is drawn — now comes the infrastructure. Systems, processes, scalable thinking. This is where ideas become assets." },
    { day: 17, chapter: 2, tone: "personal",  text: "You automated something today that you used to do manually. That's the Founder mindset — never do a task twice when you can build a system once." },
    { day: 21, chapter: 2, tone: "dramatic",  text: "Three weeks. The Founder's money-mind engine is producing at a rate that surprises even them. Knowledge converts to strategy. Strategy converts to revenue. The loop accelerates." },
    { day: 28, chapter: 2, tone: "personal",  text: "One month. You're not just consuming knowledge anymore — you're weaponizing it. Every book is a business case. Every idea is a potential product. The Founder sees ROI in everything." },

    // Chapter 3: The Crucible (Days 29–42)
    { day: 29, chapter: 3, tone: "dramatic",  text: "Chapter 3: The Crucible. The Founder hits the valley. An idea fails. A project stalls. Revenue plateaus. This is where founders are separated from dreamers." },
    { day: 35, chapter: 3, tone: "personal",  text: "Five weeks and something didn't work. Good. You just learned faster than someone who never tried. Failure isn't the opposite of success for a Founder — it's the price of admission." },
    { day: 42, chapter: 3, tone: "dramatic",  text: "Six weeks in the crucible. The Founder has pivoted, adapted, and rebuilt. The ideas that survived the fire are the ones worth scaling." },

    // Chapter 4: The Expansion (Days 43–56)
    { day: 43, chapter: 4, tone: "dramatic",  text: "Chapter 4: The Expansion. The Founder's operation outgrows the garage. What started as side projects and study sessions is becoming a real machine — with systems, scale, and momentum." },
    { day: 49, chapter: 4, tone: "personal",  text: "Seven weeks. You're starting to think in leverage — how to multiply your time, your knowledge, your capital. Not harder. Smarter. That's the Founder evolution." },
    { day: 56, chapter: 4, tone: "personal",  text: "Eight weeks of turning intelligence into income. The most dangerous person in any room is the one who both understands the system and knows how to build one. That's you." },

    // Chapter 5: The Reckoning (Days 57–70)
    { day: 57, chapter: 5, tone: "dramatic",  text: "Chapter 5: The Reckoning. The Founder audits the empire. Revenue. Knowledge ROI. Time allocation. Is the system producing real value, or are you busy building a monument to effort?" },
    { day: 63, chapter: 5, tone: "personal",  text: "Nine weeks. You've learned to kill projects that don't perform and double down on ones that do. That ruthless prioritization is the hardest skill a Founder acquires." },
    { day: 70, chapter: 5, tone: "dramatic",  text: "Ten weeks. The Founder's money-mind engine has been audited and optimized. What remains is lean, profitable, and intellectually honest. The reckoning is satisfied." },

    // Chapter 6: Ascension (Days 71–84)
    { day: 71, chapter: 6, tone: "dramatic",  text: "Chapter 6: Ascension. The Founder rises above the hustle and into the architecture. Building isn't work anymore — it's identity. Strategy isn't a skill — it's a reflex." },
    { day: 77, chapter: 6, tone: "personal",  text: "Eleven weeks. You see the world differently now. Every problem is an opportunity. Every skill is an asset. Every day is a chance to build something that outlasts the day." },
    { day: 84, chapter: 6, tone: "dramatic",  text: "Eighty-four days of strategic building. The Founder has constructed a machine of mind and money that generates value daily. The protocol doesn't end. The builder never stops." },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // THE CHARMER — First they see you. Then they hear you. Then they remember you.
  // ═══════════════════════════════════════════════════════════════════════════
  charmer: [
    // Chapter 1: The Awakening (Days 1–14)
    { day: 1,  chapter: 1, tone: "dramatic",  text: "The Charmer arrives. Two engines ignite — charisma and body — because presence is built from the outside in and the inside out. They see you before they hear you. Make both count." },
    { day: 3,  chapter: 1, tone: "personal",  text: "You worked on your body and your presence today. You trained, you groomed, you practiced your voice. Most people invest in one or the other. You understand they're the same thing." },
    { day: 5,  chapter: 1, tone: "personal",  text: "Five days of showing up as the best version of yourself — physically and socially. You stood taller today. Spoke clearer. Looked people in the eye longer. Small changes. Massive impact." },
    { day: 7,  chapter: 1, tone: "dramatic",  text: "Seven days. The Charmer has begun the transformation. The body moves with more confidence. The voice carries more weight. People notice — they just can't explain why yet." },
    { day: 10, chapter: 1, tone: "personal",  text: "Someone complimented you today — not just how you look, but how you made them feel. That's the Charmer's real power. Physical presence creates the opening. Emotional intelligence closes it." },
    { day: 14, chapter: 1, tone: "dramatic",  text: "Two weeks of building the dual engine of body and charisma. The Charmer is becoming magnetic. Chapter 1 closes with a presence that lingers after leaving the room." },

    // Chapter 2: Building the Machine (Days 15–28)
    { day: 15, chapter: 2, tone: "dramatic",  text: "Chapter 2 begins. The Charmer raises the stakes. The body gets sharper. The social skills get deeper. First impressions are mastered — now it's time to master lasting impressions." },
    { day: 17, chapter: 2, tone: "personal",  text: "You walked into a room today and felt comfortable immediately. No anxiety, no performance — just presence. That ease didn't exist two weeks ago. Your body and confidence are in sync." },
    { day: 21, chapter: 2, tone: "dramatic",  text: "Three weeks. The Charmer's body-charisma engine is fully synchronized. Physical confidence fuels social confidence. Social wins motivate physical discipline. The loop is airtight." },
    { day: 28, chapter: 2, tone: "personal",  text: "One month. You look better, carry yourself better, and connect with people better than you did on Day 1. And you're just getting started. The best version of you hasn't arrived yet." },

    // Chapter 3: The Crucible (Days 29–42)
    { day: 29, chapter: 3, tone: "dramatic",  text: "Chapter 3: The Crucible. The Charmer faces the mirror on a bad day — tired eyes, low energy, no desire to be social. True presence isn't about good days. It's about consistency on the worst ones." },
    { day: 35, chapter: 3, tone: "personal",  text: "Five weeks. You showed up to a social situation drained and still managed to light up the room. That's when you know the charisma is real — when it works even when you don't feel it." },
    { day: 42, chapter: 3, tone: "dramatic",  text: "Six weeks. The Charmer has been tested by exhaustion, rejection, and self-doubt. The body-charisma engine held firm through every trial." },

    // Chapter 4: The Expansion (Days 43–56)
    { day: 43, chapter: 4, tone: "dramatic",  text: "Chapter 4: The Expansion. The Charmer's sphere of influence grows. Strangers become contacts. Contacts become allies. The body commands attention. The personality keeps it." },
    { day: 49, chapter: 4, tone: "personal",  text: "Seven weeks. You've realized that charm isn't about being liked by everyone — it's about being remembered by the right people. Quality over quantity. Depth over breadth." },
    { day: 56, chapter: 4, tone: "personal",  text: "Eight weeks of building your physical and social presence. You don't walk into rooms anymore — you change them. Not loudly. Not dramatically. Just unmistakably." },

    // Chapter 5: The Reckoning (Days 57–70)
    { day: 57, chapter: 5, tone: "dramatic",  text: "Chapter 5: The Reckoning. The Charmer examines the substance behind the style. Are the connections real? Is the confidence earned? Surface-level charm fades. Depth endures." },
    { day: 63, chapter: 5, tone: "personal",  text: "Nine weeks. You've learned that the deepest connections come from vulnerability, not performance. The body opens doors. The real you walks through them." },
    { day: 70, chapter: 5, tone: "dramatic",  text: "Ten weeks. The Charmer's dual engine has been refined from spectacle to substance. Physical presence meets emotional depth. The reckoning confirms the transformation is real." },

    // Chapter 6: Ascension (Days 71–84)
    { day: 71, chapter: 6, tone: "dramatic",  text: "Chapter 6: Ascension. The Charmer transcends appearance and performance. True magnetism radiates from someone who has done the physical work and the inner work. That person is now you." },
    { day: 77, chapter: 6, tone: "personal",  text: "Eleven weeks. You don't try to be charming anymore. You just are. The body is the vessel. The presence is the energy. Together they create something people don't forget." },
    { day: 84, chapter: 6, tone: "dramatic",  text: "Eighty-four days of forging the complete package. The Charmer stands as proof that physical presence and social magnetism are one system. The protocol continues. The impression is permanent." },
  ],
};
