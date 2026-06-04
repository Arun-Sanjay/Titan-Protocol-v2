import * as React from "react";
import {
  useGoals,
  useCreateGoal,
  useDeleteGoal,
} from "@/hooks/queries/useGoals";
import { todayISO } from "../../../../lib/date";

export default function GoalsPage() {
  const [showModal, setShowModal] = React.useState(false);

  const { data: goals } = useGoals();
  const createGoal = useCreateGoal();
  const deleteGoalMut = useDeleteGoal();

  const today = todayISO();

  function daysRemaining(deadline: string): number {
    const todayDate = new Date(today);
    const dl = new Date(deadline);
    const diff = dl.getTime() - todayDate.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  function handleDelete(id: string) {
    deleteGoalMut.mutate(id);
  }

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      <header>
        <p className="tp-kicker">Targets &amp; Progress</p>
        <h1 className="tp-title text-3xl font-bold md:text-4xl">GOALS</h1>
        <p className="mt-1 text-sm text-white/40">Create goals, add tasks to achieve them.</p>
      </header>

      <div className="mt-4">
        <button type="button" onClick={() => setShowModal(true)} className="tp-button inline-flex w-auto px-6">+ Add Goal</button>
      </div>

      <section className="mt-6 space-y-4">
        {(!goals || goals.length === 0) && (
          <div className="body-empty">No active goals yet. Add one to start tracking your progress.</div>
        )}
        {(goals ?? []).map((g: any) => {
          const days = daysRemaining(g.target_date ?? g.deadline ?? today);
          return (
            <div key={g.id} className="tp-panel p-4">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white/90">{g.title}</h3>
                  <div className="mt-1 flex items-center gap-3 text-xs text-white/40 flex-wrap">
                    <span>{days > 0 ? `${days} day${days !== 1 ? "s" : ""} left` : "Expired"}</span>
                    <span className="text-white/20">.</span>
                    <span>Due {g.target_date ?? g.deadline}</span>
                  </div>
                </div>
                <button type="button" onClick={() => handleDelete(g.id)} className="shrink-0 text-white/25 hover:text-red-400 transition-colors text-xs px-2 py-1 rounded border border-transparent hover:border-red-400/30" title="Delete goal">Delete</button>
              </div>
            </div>
          );
        })}
      </section>

      {showModal && <AddGoalModal onClose={() => setShowModal(false)} createGoal={createGoal} />}
    </main>
  );
}

function AddGoalModal({ onClose, createGoal }: { onClose: () => void; createGoal: any }) {
  const [title, setTitle] = React.useState("");
  const [deadline, setDeadline] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const canSave = title.trim().length > 0 && deadline.length > 0;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      createGoal.mutate({ title: title.trim(), targetDate: deadline });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="body-modal" onClick={onClose}>
      <div className="body-modal-panel" onClick={(e) => e.stopPropagation()}>
        <p className="tp-kicker">New Goal</p>
        <h2 className="text-lg font-bold text-white/90 mt-1">Add Goal</h2>
        <div className="mt-5 space-y-4">
          <div><label className="body-label">Goal title</label><input type="text" className="body-input" placeholder='e.g. "Get lean"' value={title} onChange={(e) => setTitle(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === "Enter" && canSave) handleSave(); }} /></div>
          <div><label className="body-label">Deadline</label><input type="date" className="body-input" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></div>
        </div>
        <div className="mt-6 flex gap-2">
          <button type="button" onClick={handleSave} disabled={saving || !canSave} className="tp-button inline-flex w-auto px-6 disabled:opacity-40">{saving ? "Saving..." : "Create Goal"}</button>
          <button type="button" onClick={onClose} className="tp-button tp-button-inline inline-flex w-auto px-5">Cancel</button>
        </div>
      </div>
    </div>
  );
}
