"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { todayISO } from "../../../lib/date";
import { getDailyPlanningModel, type DailyPlanningModel } from "../../../lib/dashboard-stats";
import { EMPTY_SCORE, type TitanScore } from "../../../lib/scoring";

const DEFAULT_TITAN: TitanScore = {
  percent: 0,
  perEngine: { body: EMPTY_SCORE, mind: EMPTY_SCORE, money: EMPTY_SCORE, general: EMPTY_SCORE },
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
    href: "/os/focus",
    cta: "Start focus",
  },
  quickActions: [],
};

const DailyPlanningContext = React.createContext<DailyPlanningModel>(DEFAULT_PLANNING);

export function useDailyPlanning(): DailyPlanningModel {
  return React.useContext(DailyPlanningContext);
}

export function DailyPlanningProvider({ children }: { children: React.ReactNode }) {
  const todayKey = React.useMemo(() => todayISO(), []);
  const planning = useLiveQuery(() => getDailyPlanningModel(todayKey), [todayKey]) ?? DEFAULT_PLANNING;

  return (
    <DailyPlanningContext.Provider value={planning}>
      {children}
    </DailyPlanningContext.Provider>
  );
}
