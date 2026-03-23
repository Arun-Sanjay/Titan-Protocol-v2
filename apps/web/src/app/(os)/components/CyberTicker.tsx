"use client";

import * as React from "react";
import { useDailyPlanning } from "./DailyPlanningProvider";

export function CyberTicker() {
  const planning = useDailyPlanning();

  const titanPct = planning.titan.percent.toFixed(1);
  const enginesActive = planning.titan.enginesActiveCount;
  const mainOpen = planning.summary.incompleteMainCount;

  return (
    <div className="cyber-ticker">
      <span>SYS.TITAN</span>
      <span className="cyber-ticker-sep">{"//"}</span>
      <span>SCORE: <span className="cyber-ticker-val">{titanPct}%</span></span>
      <span className="cyber-ticker-sep">{"//"}</span>
      <span>ENGINES: <span className="cyber-ticker-val">{enginesActive}/4</span></span>
      <span className="cyber-ticker-sep">{"//"}</span>
      <span>MAIN.OPEN: <span className="cyber-ticker-val">{mainOpen}</span></span>
      <span className="cyber-ticker-sep">{"//"}</span>
      <span>DATE: <span className="cyber-ticker-val">{planning.dateKey}</span></span>
      <span className="cyber-ticker-sep">{"//"}</span>
      <span>STATUS: <span className="cyber-ticker-val">OPERATIONAL</span></span>
      <span className="cyber-ticker-cursor">_</span>
    </div>
  );
}
