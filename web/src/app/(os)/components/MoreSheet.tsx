import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { BottomSheet } from "../../../components/ui/BottomSheet";
import { NavIcon } from "../../../components/ui/NavIcon";
import { playClick } from "../../../lib/sound";

type MoreSheetProps = {
  open: boolean;
  onClose: () => void;
};

const MORE_GROUPS = [
  {
    label: "Core",
    items: [
      { href: "/app/command", label: "Command Center", icon: "command" },
      { href: "/app/analytics", label: "Analytics", icon: "analytics" },
    ],
  },
  {
    label: "Engines",
    items: [
      { href: "/app/body", label: "Body", icon: "body" },
      { href: "/app/mind", label: "Mind", icon: "mind" },
      { href: "/app/money", label: "Money", icon: "money" },
      { href: "/app/general", label: "General", icon: "general" },
    ],
  },
  {
    label: "Track",
    items: [
      { href: "/app/habits", label: "Habits", icon: "habits" },
      { href: "/app/journal", label: "Journal", icon: "journal" },
      { href: "/app/goals", label: "Goals", icon: "goals" },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/app/focus", label: "Focus Timer", icon: "focus" },
      { href: "/app/body/workouts", label: "Workouts", icon: "workout" },
      { href: "/app/body/sleep", label: "Sleep Tracker", icon: "sleep" },
      { href: "/app/body/weight", label: "Weight Tracker", icon: "weight" },
      { href: "/app/body/nutrition", label: "Nutrition", icon: "nutrition" },
      { href: "/app/money/cashflow", label: "Finance Tracker", icon: "money" },
    ],
  },
  {
    label: "",
    items: [
      { href: "/app/settings", label: "Settings", icon: "settings" },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MoreSheet({ open, onClose }: MoreSheetProps) {
  const { pathname } = useLocation();

  return (
    <BottomSheet open={open} onClose={onClose} title="Navigation">
      <nav className="tx-more-sheet-nav">
        {MORE_GROUPS.map((group) => (
          <div key={group.label || "settings"} className="tx-more-sheet-group">
            {group.label && (
              <p className="tx-more-sheet-group-label">{group.label}</p>
            )}
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`tx-more-sheet-item ${active ? "is-active" : ""}`}
                  onClick={() => {
                    playClick();
                    onClose();
                  }}
                >
                  <NavIcon name={item.icon} size={18} className="tx-more-sheet-icon" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </BottomSheet>
  );
}
