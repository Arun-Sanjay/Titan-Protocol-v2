/**
 * Quiz scoring logic.
 *
 * Normal answer: +3 to its engine.
 * Titan answer: +2 to its engine + +2 hidden Titan points.
 *
 * If titanPoints >= 8 → "titan"
 * Otherwise → map by dominant engine(s)
 */

import type { EngineKey } from "../db/schema";
import type { IdentityArchetype } from "../stores/useModeStore";
import { QUIZ_QUESTIONS } from "../data/identity-quiz";

export type QuizResult = {
  archetype: IdentityArchetype;
  scores: Record<EngineKey, number>;
  titanPoints: number;
};

export function scoreQuiz(answers: number[]): QuizResult {
  const scores: Record<EngineKey, number> = { body: 0, mind: 0, money: 0, charisma: 0 };
  let titanPoints = 0;

  for (let i = 0; i < QUIZ_QUESTIONS.length; i++) {
    const optionIndex = answers[i];
    if (optionIndex < 0 || optionIndex >= QUIZ_QUESTIONS[i].options.length) continue;

    const option = QUIZ_QUESTIONS[i].options[optionIndex];

    if (option.isTitan) {
      scores[option.engine] += 2;
      titanPoints += 2;
    } else {
      scores[option.engine] += 3;
    }
  }

  // Titan: 4+ titan answers (8+ points) OR all engines within 3 points
  if (titanPoints >= 8) {
    return { archetype: "titan", scores, titanPoints };
  }

  // Check for all-balanced edge case
  const values = Object.values(scores);
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (max - min <= 3 && titanPoints < 8) {
    return { archetype: "titan", scores, titanPoints };
  }

  // Find dominant engine(s)
  const sorted = (Object.entries(scores) as [EngineKey, number][])
    .sort((a, b) => b[1] - a[1]);

  const top = sorted[0];
  const second = sorted[1];
  const isCombo = top[1] - second[1] <= 2;

  if (isCombo) {
    return { archetype: resolveCombo(top[0], second[0]), scores, titanPoints };
  }

  // Single dominant engine
  return { archetype: resolveSingle(top[0]), scores, titanPoints };
}

function resolveSingle(engine: EngineKey): IdentityArchetype {
  const map: Record<EngineKey, IdentityArchetype> = {
    body: "athlete",
    mind: "scholar",
    money: "hustler",
    charisma: "showman",
  };
  return map[engine];
}

function resolveCombo(a: EngineKey, b: EngineKey): IdentityArchetype {
  const pair = new Set([a, b]);

  if (pair.has("body") && pair.has("mind")) return "warrior";
  if (pair.has("mind") && pair.has("money")) return "founder";
  if (pair.has("charisma") && pair.has("body")) return "charmer";

  // Unmapped combos — fall back to higher of the two
  // These have no dedicated archetype per spec
  return resolveSingle(a);
}
