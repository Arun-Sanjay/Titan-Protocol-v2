import * as React from "react";
import {
  useGymExercises,
  useGymTemplates,
  useGymSessions,
  useActiveGymSession,
  useStartGymSession,
  useEndGymSession,
  useDeleteGymSession,
  useGymSets,
  useAddGymSet,
  useUpdateGymSet,
  useDeleteGymSet,
  useCreateGymExercise,
  useDeleteGymExercise,
  useCreateGymTemplate,
  useDeleteGymTemplate,
} from "@/hooks/queries/useGym";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function formatDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

const MUSCLE_GROUPS = ["All", "Chest", "Back", "Shoulders", "Arms", "Legs", "Core"];

type TabKey = "exercises" | "templates" | "history";

// ─── Main Page Component ─────────────────────────────────────────────────────

export default function WorkoutsPage() {
  const [tab, setTab] = React.useState<TabKey>("templates");

  const { data: activeSession } = useActiveGymSession();

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      <header className="mb-4">
        <h1 className="tp-title text-3xl font-bold md:text-4xl">WORKOUTS</h1>
        <p className="tp-subtitle mt-1 text-sm text-white/70">Track your gym sessions</p>
      </header>

      {activeSession && (
        <div className="tp-panel p-4 mb-4" style={{ border: "1px solid rgba(255,255,255,0.2)" }}>
          <p className="tp-kicker">Active Workout</p>
          <p className="tp-muted">Session in progress. Use the gym app to track sets.</p>
        </div>
      )}

      <div className="tp-tabs mb-4">
        <button type="button" className={`tp-tab ${tab === "exercises" ? "is-active" : ""}`} onClick={() => setTab("exercises")}>Exercises</button>
        <button type="button" className={`tp-tab ${tab === "templates" ? "is-active" : ""}`} onClick={() => setTab("templates")}>Templates</button>
        <button type="button" className={`tp-tab ${tab === "history" ? "is-active" : ""}`} onClick={() => setTab("history")}>History</button>
      </div>

      {tab === "exercises" && <ExerciseLibraryView />}
      {tab === "templates" && <TemplatesView />}
      {tab === "history" && <HistoryView />}
    </main>
  );
}

// ─── Exercise Library View ───────────────────────────────────────────────────

function ExerciseLibraryView() {
  const { data: exercises } = useGymExercises();
  const createExercise = useCreateGymExercise();
  const deleteExerciseMut = useDeleteGymExercise();
  const [search, setSearch] = React.useState("");
  const [muscleFilter, setMuscleFilter] = React.useState("All");
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newMuscleGroup, setNewMuscleGroup] = React.useState("Chest");
  const [newEquipment, setNewEquipment] = React.useState("Barbell");

  const filtered = React.useMemo(() => {
    let result = exercises ?? [];
    if (muscleFilter !== "All") {
      result = result.filter((e: any) => e.muscle_group === muscleFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((e: any) => (e.name ?? "").toLowerCase().includes(q));
    }
    return result;
  }, [exercises, muscleFilter, search]);

  async function handleAddExercise() {
    const name = newName.trim();
    if (!name) return;
    createExercise.mutate({ name, muscle_group: newMuscleGroup, equipment: newEquipment } as any);
    setNewName("");
    setShowAddModal(false);
  }

  return (
    <div>
      <div className="tp-panel p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search exercises..." className="body-input flex-1 min-w-[200px]" />
          <button type="button" onClick={() => setShowAddModal(true)} className="tp-button w-auto px-4">+ Add Custom Exercise</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {MUSCLE_GROUPS.map((mg) => (
            <button key={mg} type="button" onClick={() => setMuscleFilter(mg)} className={`tp-button tp-button-inline px-3 py-1 text-xs ${muscleFilter === mg ? "is-active" : ""}`}>{mg}</button>
          ))}
        </div>
      </div>

      {(filtered as any[]).map((ex) => (
        <div key={ex.id} className="body-task-row">
          <div className="flex items-center gap-3">
            <span>{ex.name}</span>
            <span className="body-badge">{ex.equipment}</span>
          </div>
          <button type="button" onClick={() => deleteExerciseMut.mutate(ex.id)} className="tp-button tp-button-inline px-2 py-1 text-xs">Delete</button>
        </div>
      ))}

      {showAddModal && (
        <div className="body-modal">
          <div className="body-modal-panel">
            <div className="tp-panel-head">
              <p className="tp-kicker">Add Custom Exercise</p>
              <button type="button" onClick={() => setShowAddModal(false)} className="tp-button tp-button-inline">Close</button>
            </div>
            <div className="mt-4 space-y-4">
              <div><label className="body-label">Name</label><input value={newName} onChange={(e) => setNewName(e.target.value)} className="body-input" placeholder="Exercise name" /></div>
              <div><label className="body-label">Muscle Group</label>
                <select value={newMuscleGroup} onChange={(e) => setNewMuscleGroup(e.target.value)} className="body-select">
                  {MUSCLE_GROUPS.filter((g) => g !== "All").map((g) => (<option key={g} value={g}>{g}</option>))}
                </select>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={handleAddExercise} className="tp-button w-auto px-4">Create</button>
              <button type="button" onClick={() => setShowAddModal(false)} className="tp-button w-auto px-4">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Templates View ──────────────────────────────────────────────────────────

function TemplatesView() {
  const { data: templates } = useGymTemplates();
  const createTemplate = useCreateGymTemplate();
  const deleteTemplateMut = useDeleteGymTemplate();
  const startSession = useStartGymSession();
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [newTemplateName, setNewTemplateName] = React.useState("");

  async function handleCreateTemplate() {
    const name = newTemplateName.trim();
    if (!name) return;
    createTemplate.mutate({ name } as any);
    setNewTemplateName("");
    setShowCreateModal(false);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="tp-kicker">Your Templates</p>
        <button type="button" onClick={() => setShowCreateModal(true)} className="tp-button w-auto px-4">+ Create Template</button>
      </div>

      {(!templates || templates.length === 0) && (
        <div className="tp-panel p-6 text-center"><p className="tp-muted">No templates yet. Create one to get started.</p></div>
      )}

      <div className="space-y-3">
        {(templates ?? []).map((tpl: any) => (
          <div key={tpl.id} className="tp-panel p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="tp-kicker text-base">{tpl.name}</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => startSession.mutate({ template_id: tpl.id, date_key: todayKey() } as any)} className="tp-button w-auto px-3 py-1 text-xs">Start Workout</button>
                <button type="button" onClick={() => deleteTemplateMut.mutate(tpl.id)} className="tp-button tp-button-inline px-2 py-1 text-xs">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showCreateModal && (
        <div className="body-modal">
          <div className="body-modal-panel">
            <div className="tp-panel-head">
              <p className="tp-kicker">Create Template</p>
              <button type="button" onClick={() => setShowCreateModal(false)} className="tp-button tp-button-inline">Close</button>
            </div>
            <div className="mt-4 space-y-4">
              <div><label className="body-label">Template Name</label><input value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} className="body-input" placeholder="e.g. Push Day" /></div>
            </div>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={handleCreateTemplate} className="tp-button w-auto px-4">Create</button>
              <button type="button" onClick={() => setShowCreateModal(false)} className="tp-button w-auto px-4">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── History View ────────────────────────────────────────────────────────────

function HistoryView() {
  const { data: sessions } = useGymSessions();
  const deleteSessionMut = useDeleteGymSession();

  const completedSessions = React.useMemo(
    () => (sessions ?? []).filter((s: any) => s.ended_at !== null),
    [sessions],
  );

  return (
    <div>
      <p className="tp-kicker mb-3">Workout History</p>
      {completedSessions.length === 0 && (
        <div className="tp-panel p-6 text-center"><p className="tp-muted">No completed workouts yet.</p></div>
      )}
      <div className="space-y-2">
        {completedSessions.map((s: any) => {
          const duration = s.ended_at && s.started_at ? new Date(s.ended_at).getTime() - new Date(s.started_at).getTime() : 0;
          return (
            <div key={s.id} className="tp-panel p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">{s.template_name ?? "Workout"}</p>
                  <p className="text-xs tp-muted">{s.date_key} -- {formatDuration(duration)}</p>
                </div>
                <button type="button" onClick={() => deleteSessionMut.mutate(s.id)} className="tp-button tp-button-inline px-2 py-1 text-xs">Delete</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
