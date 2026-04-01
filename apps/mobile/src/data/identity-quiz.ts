/**
 * Identity Quiz — 7 questions, 4 options each.
 * Each option maps to an engine. One option per question is the hidden Titan answer.
 * Normal answer: +3 to its engine.
 * Titan answer: +2 to its engine + +2 hidden Titan points.
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
  {
    question: "What would hurt your ego the most?",
    options: [
      { text: "Someone calling you stupid or clueless", engine: "mind", isTitan: false },
      { text: "Someone saying \"you're not as good as you think you are\"", engine: "charisma", isTitan: true },
      { text: "Someone calling you broke or going nowhere", engine: "money", isTitan: false },
      { text: "Someone calling you lazy or out of shape", engine: "body", isTitan: false },
    ],
  },
  {
    question: "You're about to give up on something hard. What keeps you going?",
    options: [
      { text: "The payoff is too big to walk away from.", engine: "money", isTitan: false },
      { text: "My body can handle more than my mind thinks.", engine: "body", isTitan: false },
      { text: "Quitting this means settling. I don't settle.", engine: "body", isTitan: true },
      { text: "I haven't figured it out yet. There's always a solution.", engine: "mind", isTitan: false },
    ],
  },
  {
    question: "Pick the superpower:",
    options: [
      { text: "Remember everything you've ever read or heard.", engine: "mind", isTitan: false },
      { text: "Every business idea you touch succeeds.", engine: "money", isTitan: false },
      { text: "Never get tired. Unlimited physical energy.", engine: "body", isTitan: false },
      { text: "Learn anything to an expert level in one month.", engine: "mind", isTitan: true },
    ],
  },
  {
    question: "What's your biggest flex?",
    options: [
      { text: "What I've built or earned", engine: "money", isTitan: false },
      { text: "How far I've come from where I started", engine: "money", isTitan: true },
      { text: "What my body can do", engine: "body", isTitan: false },
      { text: "What I know that others don't", engine: "mind", isTitan: false },
    ],
  },
  {
    question: "You're watching a movie. Which character do you root for?",
    options: [
      { text: "The genius who sees what nobody else sees", engine: "mind", isTitan: false },
      { text: "The one who started broke and built an empire", engine: "money", isTitan: false },
      { text: "The one everyone underestimated who proved them all wrong", engine: "charisma", isTitan: true },
      { text: "The underdog who outworks everyone physically", engine: "body", isTitan: false },
    ],
  },
  {
    question: "Finish this sentence: \"I respect people who...\"",
    options: [
      { text: "...push their body past what seems possible.", engine: "body", isTitan: false },
      { text: "...are just built different. Whatever they touch, they figure out.", engine: "body", isTitan: true },
      { text: "...turned nothing into something real.", engine: "money", isTitan: false },
      { text: "...know more than everyone and never stop learning.", engine: "mind", isTitan: false },
    ],
  },
  {
    question: "One year from now, what would make you proudest?",
    options: [
      { text: "Being in the best shape of my life.", engine: "body", isTitan: false },
      { text: "Having real financial momentum or a thriving project.", engine: "money", isTitan: false },
      { text: "Being someone I wouldn't have recognized a year ago.", engine: "mind", isTitan: true },
      { text: "Being genuinely sharper and more knowledgeable.", engine: "mind", isTitan: false },
    ],
  },
];
