/**
 * Identity Quiz — 7 redesigned questions, 4 options each.
 * Scenario-based projection, value conflicts, no obvious "right" answers.
 *
 * Normal answer: +3 to its engine.
 * Titan answer: +2 to its engine + +2 hidden Titan points.
 * Titan threshold: 5+ Titan answers (10+ points) → The Titan.
 */

import type { EngineKey } from "../db/schema";

export type QuizOption = {
  text: string;
  engine: EngineKey;
  isTitan: boolean;
};

export type QuizQuestion = {
  question: string;
  options: QuizOption[];
};

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  // Q1 — Wound question (Titan at position B)
  {
    question: "You find out someone has been talking behind your back. What bothers you most?",
    options: [
      { text: "That they think I'm not smart enough", engine: "mind", isTitan: false },
      { text: "That they don't take me seriously", engine: "charisma", isTitan: true },
      { text: "That they think I'll never make it", engine: "money", isTitan: false },
      { text: "That they think I'm weak", engine: "body", isTitan: false },
    ],
  },

  // Q2 — Projective freedom (Titan at position C)
  {
    question: "You're given one year off with all expenses paid. No obligations. What do you actually do?",
    options: [
      { text: "Train like a professional athlete \u2014 finally no excuses", engine: "body", isTitan: false },
      { text: "Build a business or investment portfolio \u2014 free time is an opportunity", engine: "money", isTitan: false },
      { text: "Reinvent myself completely \u2014 new skills, new habits, come back unrecognizable", engine: "mind", isTitan: true },
      { text: "Travel and meet as many interesting people as possible \u2014 build a global network", engine: "charisma", isTitan: false },
    ],
  },

  // Q3 — Moral dilemma (Titan at position D)
  {
    question: "Two close friends ask for your help on the same night. One needs advice on a personal crisis. The other needs help on a project with a tight deadline. You can only help one.",
    options: [
      { text: "The personal crisis \u2014 people always come first", engine: "charisma", isTitan: false },
      { text: "The personal crisis \u2014 but I'd find a way to send useful resources to the other", engine: "mind", isTitan: false },
      { text: "The project \u2014 deadlines are real and I can help the other friend tomorrow", engine: "money", isTitan: false },
      { text: "Whichever situation I can make a bigger impact on", engine: "money", isTitan: true },
    ],
  },

  // Q4 — Talent discovery (Titan at position B)
  {
    question: "You discover you're naturally talented at something you've never tried before. What matters most to you about that?",
    options: [
      { text: "Understanding WHY I'm good at it \u2014 what's the underlying principle?", engine: "mind", isTitan: false },
      { text: "How good I can actually get if I go all in", engine: "body", isTitan: true },
      { text: "How quickly I can turn this talent into income or opportunity", engine: "money", isTitan: false },
      { text: "How I can use it to stand out or impress people", engine: "charisma", isTitan: false },
    ],
  },

  // Q5 — Fear/failure (Titan at position C)
  {
    question: "What kind of failure would keep you up at night?",
    options: [
      { text: "Letting myself go physically \u2014 looking in the mirror and not recognizing the discipline I used to have", engine: "body", isTitan: false },
      { text: "Choking in a moment that mattered \u2014 freezing when people were watching", engine: "charisma", isTitan: false },
      { text: "Knowing I had potential and wasted it \u2014 looking back at a life of \"almost\"", engine: "mind", isTitan: true },
      { text: "Losing money I worked hard to earn \u2014 or watching an investment fail", engine: "money", isTitan: false },
    ],
  },

  // Q6 — Teaching philosophy (Titan at position A)
  {
    question: "A kid asks you: \"How do I become great at something?\" What do you tell them?",
    options: [
      { text: "Don't just get good \u2014 get so good that people can't ignore you.", engine: "charisma", isTitan: true },
      { text: "Study the best. Learn everything about it. Knowledge is the shortcut.", engine: "mind", isTitan: false },
      { text: "Find a way to get paid for it. If you can make money doing it, you'll never stop.", engine: "money", isTitan: false },
      { text: "Show up every day. Even when you don't want to. Your body and habits will carry you.", engine: "body", isTitan: false },
    ],
  },

  // Q7 — Regret/advice (Titan at position D)
  {
    question: "You can go back 5 years and give yourself one piece of advice. What is it?",
    options: [
      { text: "Take care of your body now. It's harder to fix later.", engine: "body", isTitan: false },
      { text: "Read more. The answers to most of your problems are already written somewhere.", engine: "mind", isTitan: false },
      { text: "Start investing earlier. Every dollar you didn't save is compounding you'll never get back.", engine: "money", isTitan: false },
      { text: "Start before you're ready. The people who win aren't smarter \u2014 they just started.", engine: "money", isTitan: true },
    ],
  },
];
