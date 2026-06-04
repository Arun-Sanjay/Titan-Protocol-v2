import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";

import { playClick } from "../../lib/sound";

type CommandAction = {
  id: string;
  label: string;
  run: () => void;
};

export function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);

  const actions = React.useMemo<CommandAction[]>(
    () => [
      { id: "dashboard", label: "Go to Dashboard", run: () => navigate("/app") },
      { id: "analytics", label: "Go to Analytics", run: () => navigate("/app/analytics") },
      { id: "command", label: "Go to Command Center", run: () => navigate("/app/command") },
      { id: "focus", label: "Go to Focus Timer", run: () => navigate("/app/focus") },
      { id: "body", label: "Go to Body", run: () => navigate("/app/body") },
      { id: "workouts", label: "Go to Workouts", run: () => navigate("/app/body/workouts") },
      { id: "weight", label: "Go to Weight Tracker", run: () => navigate("/app/body/weight") },
      { id: "nutrition", label: "Go to Nutrition", run: () => navigate("/app/body/nutrition") },
      { id: "sleep", label: "Go to Sleep Tracker", run: () => navigate("/app/body/sleep") },
      { id: "mind", label: "Go to Mind", run: () => navigate("/app/mind") },
      { id: "money", label: "Go to Money", run: () => navigate("/app/money") },
      { id: "deep-work", label: "Go to Deep Work", run: () => navigate("/app/money/deep-work") },
      { id: "budgets", label: "Go to Budgets", run: () => navigate("/app/money/budgets") },
      { id: "general", label: "Go to General", run: () => navigate("/app/general") },
      { id: "habits", label: "Go to Habits", run: () => navigate("/app/habits") },
      { id: "journal", label: "Go to Journal", run: () => navigate("/app/journal") },
      { id: "goals", label: "Go to Goals", run: () => navigate("/app/goals") },
      { id: "settings", label: "Go to Settings", run: () => navigate("/app/settings") },
    ],
    [navigate],
  );

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((previous) => !previous);
      }
      if (
        event.key.toLowerCase() === "f" &&
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey
      ) {
        event.preventDefault();
        navigate("/app/focus");
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  function runAction(action: CommandAction) {
    playClick();
    action.run();
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center bg-black/60 px-4 pt-[12vh]">
      <Command
        label="Titan OS Command Palette"
        className="hud-panel w-full max-w-xl overflow-hidden rounded-md border border-white/20 bg-black/90 shadow-none"
      >
        <Command.Input
          autoFocus
          placeholder="Type a command..."
          className="w-full border-b border-white/10 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-white/45"
        />
        <Command.List className="max-h-72 overflow-y-auto p-2">
          <Command.Empty className="px-3 py-2 text-sm text-white/50">No results found.</Command.Empty>
          <Command.Group heading="Navigation">
            {actions.map((action) => (
              <Command.Item
                key={action.id}
                onSelect={() => runAction(action)}
                className="cursor-pointer rounded-sm px-3 py-2 text-sm text-white/85 outline-none transition hover:bg-white/8 data-[selected=true]:bg-white/12"
              >
                {action.label}
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
