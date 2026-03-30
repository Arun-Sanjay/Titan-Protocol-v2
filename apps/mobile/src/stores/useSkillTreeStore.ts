import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";
import type { EngineKey } from "../db/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SkillNode = {
  id: string;
  name: string;
  description: string;
  conditionText: string;
};

export type SkillBranch = {
  id: string;
  name: string;
  nodes: SkillNode[];
};

// ─── Tree Definitions ─────────────────────────────────────────────────────────

export const SKILL_TREES: Record<EngineKey, SkillBranch[]> = {
  body: [
    {
      id: "body_strength",
      name: "Strength",
      nodes: [
        { id: "body_str_1", name: "Committed",   description: "You've started your physical journey.",       conditionText: "Add first body task" },
        { id: "body_str_2", name: "Consistent",  description: "7 days of showing up.",                      conditionText: "7-day streak" },
        { id: "body_str_3", name: "Disciplined", description: "Two weeks of daily discipline.",              conditionText: "14-day streak" },
        { id: "body_str_4", name: "Iron Will",   description: "A month of relentless effort.",               conditionText: "30-day streak" },
        { id: "body_str_5", name: "Titan",       description: "You've become the machine.",                  conditionText: "60-day streak" },
      ],
    },
    {
      id: "body_endurance",
      name: "Endurance",
      nodes: [
        { id: "body_end_1", name: "Active",       description: "Your first completed body task.",            conditionText: "Complete 1 body task" },
        { id: "body_end_2", name: "Durable",      description: "Built a base of activity.",                  conditionText: "Complete 10 body tasks" },
        { id: "body_end_3", name: "Relentless",   description: "Fifty completions — you don't stop.",        conditionText: "Complete 50 body tasks" },
        { id: "body_end_4", name: "Unstoppable",  description: "100 tasks. Pure relentlessness.",            conditionText: "Complete 100 body tasks" },
      ],
    },
    {
      id: "body_recovery",
      name: "Recovery",
      nodes: [
        { id: "body_rec_1", name: "Rested",        description: "You've prioritized recovery.",             conditionText: "Log first recovery task" },
        { id: "body_rec_2", name: "Restored",      description: "Regular recovery practice established.",   conditionText: "7 recovery tasks completed" },
        { id: "body_rec_3", name: "Recovered",     description: "Recovery is now a habit.",                 conditionText: "21 recovery tasks completed" },
        { id: "body_rec_4", name: "Peak Recovery", description: "You've mastered the art of recovery.",     conditionText: "50 recovery tasks completed" },
      ],
    },
    {
      id: "body_nutrition",
      name: "Nutrition",
      nodes: [
        { id: "body_nut_1", name: "Aware",     description: "Beginning to track your nutrition.",           conditionText: "Add first nutrition goal" },
        { id: "body_nut_2", name: "Mindful",   description: "Conscious eating is your norm.",               conditionText: "7 nutrition tasks completed" },
        { id: "body_nut_3", name: "Balanced",  description: "You've found nutritional balance.",            conditionText: "21 nutrition tasks completed" },
        { id: "body_nut_4", name: "Optimized", description: "Nutrition is your superpower.",                conditionText: "50 nutrition tasks completed" },
      ],
    },
  ],

  mind: [
    {
      id: "mind_focus",
      name: "Focus",
      nodes: [
        { id: "mind_foc_1", name: "Curious",    description: "Your mind is open.",                          conditionText: "Add first mind task" },
        { id: "mind_foc_2", name: "Sharp",      description: "You're building mental clarity.",              conditionText: "7-day mind streak" },
        { id: "mind_foc_3", name: "Focused",    description: "Deep concentration is your default.",          conditionText: "14-day mind streak" },
        { id: "mind_foc_4", name: "Deep Focus", description: "Distraction can't touch you.",                conditionText: "30-day mind streak" },
        { id: "mind_foc_5", name: "Flow State", description: "You operate at peak cognitive capacity.",      conditionText: "60-day mind streak" },
      ],
    },
    {
      id: "mind_learning",
      name: "Learning",
      nodes: [
        { id: "mind_lrn_1", name: "Student", description: "You've committed to learning.",                  conditionText: "Complete 1 mind task" },
        { id: "mind_lrn_2", name: "Learner",  description: "Knowledge is building.",                        conditionText: "Complete 10 mind tasks" },
        { id: "mind_lrn_3", name: "Scholar",  description: "Your mind is your greatest asset.",             conditionText: "Complete 50 mind tasks" },
        { id: "mind_lrn_4", name: "Sage",     description: "Wisdom flows from everything you do.",          conditionText: "Complete 100 mind tasks" },
      ],
    },
    {
      id: "mind_clarity",
      name: "Mental Clarity",
      nodes: [
        { id: "mind_cla_1", name: "Clear",       description: "The fog is lifting.",                        conditionText: "Complete 5 mind sessions" },
        { id: "mind_cla_2", name: "Calm",        description: "Equanimity is your baseline.",               conditionText: "Complete 15 mind sessions" },
        { id: "mind_cla_3", name: "Centered",    description: "Nothing shakes your inner calm.",            conditionText: "Complete 30 mind sessions" },
        { id: "mind_cla_4", name: "Enlightened", description: "Total mental mastery achieved.",             conditionText: "Complete 60 mind sessions" },
      ],
    },
    {
      id: "mind_resilience",
      name: "Resilience",
      nodes: [
        { id: "mind_res_1", name: "Stable",       description: "You handle setbacks with grace.",           conditionText: "Complete first protocol session" },
        { id: "mind_res_2", name: "Grounded",     description: "Your roots go deep.",                       conditionText: "Complete 7 protocol sessions" },
        { id: "mind_res_3", name: "Resilient",    description: "Obstacles are fuel, not barriers.",         conditionText: "Complete 21 protocol sessions" },
        { id: "mind_res_4", name: "Unshakeable",  description: "Nothing can stop your momentum.",           conditionText: "Complete 50 protocol sessions" },
      ],
    },
  ],

  money: [
    {
      id: "money_wealth",
      name: "Wealth Building",
      nodes: [
        { id: "money_wlt_1", name: "Aware",       description: "You see your financial reality.",           conditionText: "Add first money task" },
        { id: "money_wlt_2", name: "Budgeting",   description: "Your money has direction.",                 conditionText: "7-day money streak" },
        { id: "money_wlt_3", name: "Saving",      description: "You're building a foundation.",             conditionText: "14-day money streak" },
        { id: "money_wlt_4", name: "Investing",   description: "Your money works for you.",                 conditionText: "30-day money streak" },
        { id: "money_wlt_5", name: "Compounding", description: "Wealth grows exponentially now.",           conditionText: "60-day money streak" },
      ],
    },
    {
      id: "money_income",
      name: "Income",
      nodes: [
        { id: "money_inc_1", name: "Earner",     description: "You take your income seriously.",            conditionText: "Complete 1 money task" },
        { id: "money_inc_2", name: "Builder",    description: "You're creating income streams.",            conditionText: "Complete 10 money tasks" },
        { id: "money_inc_3", name: "Multiplier", description: "Multiple streams flow.",                     conditionText: "Complete 50 money tasks" },
        { id: "money_inc_4", name: "Abundant",   description: "Abundance is your reality.",                 conditionText: "Complete 100 money tasks" },
      ],
    },
    {
      id: "money_skills",
      name: "Financial Skills",
      nodes: [
        { id: "money_skl_1", name: "Studying",   description: "Investing in financial knowledge.",          conditionText: "Complete 5 money tasks" },
        { id: "money_skl_2", name: "Developing", description: "Your financial IQ is rising.",               conditionText: "Complete 15 money tasks" },
        { id: "money_skl_3", name: "Expert",     description: "You understand money at a deep level.",      conditionText: "Complete 30 money tasks" },
        { id: "money_skl_4", name: "Master",     description: "Financial mastery achieved.",                conditionText: "Complete 60 money tasks" },
      ],
    },
    {
      id: "money_mindset",
      name: "Mindset",
      nodes: [
        { id: "money_mnd_1", name: "Shifting",      description: "Leaving scarcity thinking behind.",      conditionText: "Complete first money review" },
        { id: "money_mnd_2", name: "Growing",       description: "Abundance thinking takes root.",         conditionText: "Complete 7 money reviews" },
        { id: "money_mnd_3", name: "Thriving",      description: "You operate from abundance.",            conditionText: "Complete 21 money reviews" },
        { id: "money_mnd_4", name: "Abundant Mind", description: "Your mindset creates your wealth.",      conditionText: "Complete 50 money reviews" },
      ],
    },
  ],

  general: [
    {
      id: "gen_productivity",
      name: "Productivity",
      nodes: [
        { id: "gen_prd_1", name: "Starting",   description: "You've taken the first step.",                conditionText: "Add first general task" },
        { id: "gen_prd_2", name: "Consistent", description: "Showing up is your superpower.",              conditionText: "7-day general streak" },
        { id: "gen_prd_3", name: "Systematic", description: "You have systems for everything.",            conditionText: "14-day general streak" },
        { id: "gen_prd_4", name: "Machine",    description: "Peak productivity is your normal.",           conditionText: "30-day general streak" },
      ],
    },
    {
      id: "gen_organization",
      name: "Organization",
      nodes: [
        { id: "gen_org_1", name: "Aware",      description: "You see the chaos clearly.",                  conditionText: "Complete 1 general task" },
        { id: "gen_org_2", name: "Organized",  description: "Everything has its place.",                   conditionText: "Complete 10 general tasks" },
        { id: "gen_org_3", name: "Optimized",  description: "Your environment fuels performance.",         conditionText: "Complete 30 general tasks" },
        { id: "gen_org_4", name: "Masterful",  description: "Organizational mastery achieved.",            conditionText: "Complete 60 general tasks" },
      ],
    },
    {
      id: "gen_planning",
      name: "Planning",
      nodes: [
        { id: "gen_pln_1", name: "Reactive",  description: "You've recognized the need to plan.",         conditionText: "Add first planning task" },
        { id: "gen_pln_2", name: "Planning",  description: "Tomorrow is never a surprise.",               conditionText: "Complete 7 planning sessions" },
        { id: "gen_pln_3", name: "Strategic", description: "You think weeks ahead.",                      conditionText: "Complete 21 planning sessions" },
        { id: "gen_pln_4", name: "Visionary", description: "You operate from a clear future.",            conditionText: "Complete 50 planning sessions" },
      ],
    },
    {
      id: "gen_habits",
      name: "Habits",
      nodes: [
        { id: "gen_hab_1", name: "Building",  description: "You're aware of your habits.",                conditionText: "Add first habit" },
        { id: "gen_hab_2", name: "Forming",   description: "Patterns are beginning to emerge.",           conditionText: "Complete 14 habit checks" },
        { id: "gen_hab_3", name: "Solid",     description: "Your habits are dependable.",                 conditionText: "Complete 42 habit checks" },
        { id: "gen_hab_4", name: "Automatic", description: "Your habits run your excellence.",            conditionText: "Complete 90 habit checks" },
      ],
    },
  ],
};

// ─── Store ────────────────────────────────────────────────────────────────────

const UNLOCKS_KEY = "skill_tree_unlocks";

type SkillTreeState = {
  unlockedNodes: Set<string>;
  load: () => void;
  unlockNode: (nodeId: string) => void;
  isUnlocked: (nodeId: string) => boolean;
  /** Returns the first locked node that is immediately unlockable (prev node unlocked or first in branch) */
  getNextUnlockable: (engine: EngineKey) => SkillNode | null;
  getProgress: (engine: EngineKey) => { unlocked: number; total: number };
};

export const useSkillTreeStore = create<SkillTreeState>()((set, get) => ({
  unlockedNodes: new Set(getJSON<string[]>(UNLOCKS_KEY, [])),

  load: () => {
    set({ unlockedNodes: new Set(getJSON<string[]>(UNLOCKS_KEY, [])) });
  },

  unlockNode: (nodeId) => {
    const next = new Set([...get().unlockedNodes, nodeId]);
    setJSON(UNLOCKS_KEY, [...next]);
    set({ unlockedNodes: next });
  },

  isUnlocked: (nodeId) => get().unlockedNodes.has(nodeId),

  getNextUnlockable: (engine) => {
    const { unlockedNodes } = get();
    const branches = SKILL_TREES[engine];
    for (const branch of branches) {
      for (let i = 0; i < branch.nodes.length; i++) {
        const node = branch.nodes[i];
        if (!unlockedNodes.has(node.id)) {
          // Unlockable if it's the first node, or the previous node is unlocked
          if (i === 0 || unlockedNodes.has(branch.nodes[i - 1].id)) {
            return node;
          }
        }
      }
    }
    return null; // all unlocked
  },

  getProgress: (engine) => {
    const { unlockedNodes } = get();
    let total = 0;
    let unlocked = 0;
    for (const branch of SKILL_TREES[engine]) {
      for (const node of branch.nodes) {
        total++;
        if (unlockedNodes.has(node.id)) unlocked++;
      }
    }
    return { unlocked, total };
  },
}));
