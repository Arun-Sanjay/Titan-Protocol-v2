/**
 * Phase 4.1: Re-export the achievement store so screens import from
 * this barrel instead of directly from the store file.
 */

export { useAchievementStore as useAchievementData } from "../stores/useAchievementStore";
