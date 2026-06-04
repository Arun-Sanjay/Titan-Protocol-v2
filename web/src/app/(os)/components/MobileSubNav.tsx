import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { NavIcon } from "../../../components/ui/NavIcon";
import { playClick } from "../../../lib/sound";
import { useIsMobile } from "../../../hooks/useIsMobile";

type SubNavTab = {
  href: string;
  label: string;
  icon: string;
};

type MobileSubNavProps = {
  tabs: SubNavTab[];
};

export const ENGINE_TABS: SubNavTab[] = [
  { href: "/app/body", label: "Body", icon: "body" },
  { href: "/app/mind", label: "Mind", icon: "mind" },
  { href: "/app/money", label: "Money", icon: "money" },
  { href: "/app/general", label: "General", icon: "general" },
];

export const TRACK_TABS: SubNavTab[] = [
  { href: "/app/habits", label: "Habits", icon: "habits" },
  { href: "/app/journal", label: "Journal", icon: "journal" },
  { href: "/app/goals", label: "Goals", icon: "goals" },
];

export function MobileSubNav({ tabs }: MobileSubNavProps) {
  const { pathname } = useLocation();
  const isMobile = useIsMobile();

  // Only render on mobile — desktop uses sidebar navigation
  if (!isMobile) return null;

  return (
    <div className="tx-mobile-subnav">
      {tabs.map((tab) => {
        const isActive =
          pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            to={tab.href}
            onClick={playClick}
            className={`tx-mobile-subnav-tab ${isActive ? "is-active" : ""}`}
          >
            <NavIcon name={tab.icon} size={14} className="tx-mobile-subnav-icon" />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
