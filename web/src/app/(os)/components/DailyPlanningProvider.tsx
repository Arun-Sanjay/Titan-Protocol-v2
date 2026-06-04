import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUserId } from "../../../lib/session";
import { todayISO } from "../../../lib/date";
import { getDailyPlanningModel, type DailyPlanningModel } from "../../../lib/dashboard-stats";
import { EMPTY_SCORE, type TitanScore } from "../../../lib/scoring";

const DEFAULT_TITAN: TitanScore = {
  percent: 0,
  perEngine: { body: EMPTY_SCORE, mind: EMPTY_SCORE, money: EMPTY_SCORE, charisma: EMPTY_SCORE },
  enginesActiveCount: 0,
};

const DEFAULT_PLANNING: DailyPlanningModel = {
  dateKey: todayISO(),
  titan: DEFAULT_TITAN,
  summary: { completedPoints: 0, totalPoints: 0, incompleteMainCount: 0 },
  enginesAtRisk: [],
  topIncompleteMainTasks: [],
  nextBestAction: {
    title: "Lock momentum with a focus block",
    detail: "No urgent risks detected. Convert the day into deep output.",
    href: "/app/focus",
    cta: "Start focus",
  },
  quickActions: [],
};

/** Query key for the dashboard's daily planning model. Lives under the
 *  `dailyPlanning` root so `invalidateScoring(qc)` (see lib/score-invalidation)
 *  hits it whenever a task or completion changes. */
export const dailyPlanningKeys = {
  today: (todayKey: string) => ["dailyPlanning", todayKey] as const,
};

const DailyPlanningContext = React.createContext<DailyPlanningModel>(DEFAULT_PLANNING);

export function useDailyPlanning(): DailyPlanningModel {
  return React.useContext(DailyPlanningContext);
}

export function DailyPlanningProvider({ children }: { children: React.ReactNode }) {
  const userId = useCurrentUserId();
  const todayKey = React.useMemo(() => todayISO(), []);

  // React Query so a `qc.invalidateQueries({ queryKey: ["dailyPlanning"] })`
  // (fired from useToggleCompletion / useCreateTask / Realtime) actually
  // refetches the model. Previously a useState/useEffect tied to todayKey,
  // which only refreshed at midnight — completions during the day never
  // updated the Dashboard's Titan Score.
  const { data } = useQuery({
    queryKey: dailyPlanningKeys.today(todayKey),
    queryFn: () => getDailyPlanningModel(todayKey),
    enabled: Boolean(userId),
    staleTime: 15_000,
  });

  const planning = data ?? DEFAULT_PLANNING;

  return (
    <DailyPlanningContext.Provider value={planning}>
      {children}
    </DailyPlanningContext.Provider>
  );
}
