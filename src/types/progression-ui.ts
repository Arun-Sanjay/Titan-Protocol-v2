export type Phase = "foundation" | "building" | "intensify" | "sustain";

type PhaseInfo = {
  name: string;
  weekRange: string;
  description: string;
};

export const PHASE_INFO: Record<Phase, PhaseInfo> = {
  foundation: { name: "Foundation", weekRange: "1-4", description: "Build your first habits" },
  building: { name: "Building", weekRange: "5-8", description: "Solidify routines" },
  intensify: { name: "Intensify", weekRange: "9-12", description: "Push harder" },
  sustain: { name: "Sustain", weekRange: "13+", description: "Maintain & grow" },
};

export function getPhaseInfo(phase: Phase): PhaseInfo {
  return PHASE_INFO[phase];
}

export function phaseFromWeek(week: number): Phase {
  if (week <= 4) return "foundation";
  if (week <= 8) return "building";
  if (week <= 12) return "intensify";
  return "sustain";
}

export function selectPhaseLabel(info: PhaseInfo): string {
  return `${info.name.toUpperCase()} · WEEKS ${info.weekRange}`;
}

export function selectPhaseProgress(info: PhaseInfo): number {
  const [start, end] = info.weekRange.split("-").map((s) => parseInt(s.replace("+", ""), 10));
  if (!end || isNaN(end)) return 100;
  const span = end - start + 1;
  return Math.round((1 / span) * 100);
}
