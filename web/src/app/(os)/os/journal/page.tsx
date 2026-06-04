import * as React from "react";
import {
  useJournalEntries,
  useJournalEntry,
  useUpsertJournalEntry,
  useDeleteJournalEntry,
} from "@/hooks/queries/useJournal";
import { todayISO } from "../../../../lib/date";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shiftDate(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const ny = date.getFullYear();
  const nm = String(date.getMonth() + 1).padStart(2, "0");
  const nd = String(date.getDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

function formatDateDisplay(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function previewText(content: string, maxLen = 50): string {
  const single = content.replace(/\n/g, " ").trim();
  if (single.length <= maxLen) return single;
  return single.slice(0, maxLen) + "...";
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function JournalPage() {
  const today = React.useMemo(() => todayISO(), []);

  const [selectedDate, setSelectedDate] = React.useState(today);
  const [editorContent, setEditorContent] = React.useState("");
  const [saveStatus, setSaveStatus] = React.useState<"Saved" | "Saving..." | "No content">("No content");

  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingRef = React.useRef(false);

  // data hooks (local React Query)
  const { data: allEntries } = useJournalEntries();
  const { data: currentEntry } = useJournalEntry(selectedDate);
  const upsertEntry = useUpsertJournalEntry();
  const deleteEntryMut = useDeleteJournalEntry();

  const recentEntries = React.useMemo(
    () => [...(allEntries ?? [])].filter((e: any) => (e.content ?? "").trim().length > 0).sort((a: any, b: any) => ((b.date_key ?? "").localeCompare(a.date_key ?? ""))).slice(0, 30),
    [allEntries],
  );

  // Sync editor with DB entry
  React.useEffect(() => {
    isLoadingRef.current = true;
    if (currentEntry !== undefined) {
      if (currentEntry) {
        setEditorContent((currentEntry as any).content ?? "");
        setSaveStatus(((currentEntry as any).content ?? "").trim() ? "Saved" : "No content");
      } else {
        setEditorContent("");
        setSaveStatus("No content");
      }
    }
    const t = setTimeout(() => { isLoadingRef.current = false; }, 50);
    return () => clearTimeout(t);
  }, [currentEntry]);

  const handleContentChange = React.useCallback(
    (value: string) => {
      setEditorContent(value);
      if (isLoadingRef.current) return;

      if (!value.trim()) {
        setSaveStatus("No content");
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
          if ((currentEntry as any)?.id) deleteEntryMut.mutate((currentEntry as any).id);
          setSaveStatus("No content");
        }, 500);
        return;
      }

      setSaveStatus("Saving...");
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        upsertEntry.mutate({ dateKey: selectedDate, content: value });
        setSaveStatus("Saved");
      }, 500);
    },
    [selectedDate, currentEntry, upsertEntry, deleteEntryMut],
  );

  React.useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  function goToPreviousDay() { setSelectedDate((d) => shiftDate(d, -1)); }
  function goToNextDay() { setSelectedDate((d) => shiftDate(d, 1)); }
  function goToDate(dateKey: string) { setSelectedDate(dateKey); }

  const [showEntries, setShowEntries] = React.useState(false);

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      <header>
        <p className="tp-kicker">Daily Notes</p>
        <h1 className="tp-title text-3xl font-bold md:text-4xl">JOURNAL</h1>
      </header>

      <button type="button" onClick={() => setShowEntries(!showEntries)} className="sm:hidden mt-4 w-full tp-panel p-3 flex items-center justify-between">
        <span className="text-xs font-medium text-white/70 uppercase tracking-wider">{showEntries ? "Hide Entries" : `Recent Entries (${recentEntries.length})`}</span>
      </button>

      <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row gap-4" style={{ minHeight: 520 }}>
        <aside className="tp-panel hidden sm:flex flex-shrink-0 flex-col overflow-hidden" style={{ width: 240 }}>
          <div className="flex-1 overflow-y-auto">
            <p className="tp-kicker px-3 pt-3 pb-1">Recent Entries</p>
            {recentEntries.length === 0 && (<p className="tp-muted px-3 py-4 text-xs text-center">No entries yet.</p>)}
            <div className="space-y-0.5 px-1.5 pb-2">
              {recentEntries.map((entry: any) => {
                const isActive = (entry.date_key ?? entry.dateKey) === selectedDate;
                return (
                  <button key={entry.date_key ?? entry.dateKey} type="button" onClick={() => goToDate(entry.date_key ?? entry.dateKey)}
                    className={`w-full text-left rounded-lg px-2.5 py-2 transition-colors ${isActive ? "bg-[#34d399]/10 border border-[#34d399]/20" : "hover:bg-white/5 border border-transparent"}`}
                  >
                    <p className={`text-xs font-medium ${isActive ? "text-[#34d399]" : "text-white/60"}`}>{entry.date_key ?? entry.dateKey}</p>
                    <p className="text-xs text-white/40 mt-0.5 truncate">{previewText(entry.content ?? "")}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="tp-panel p-3 flex items-center justify-between">
            <button type="button" onClick={goToPreviousDay} className="tp-button tp-button-inline text-xs px-3 py-1.5">Prev</button>
            <div className="text-center min-w-0 px-1">
              <p className="text-xs sm:text-sm font-medium text-white/90 truncate">{formatDateDisplay(selectedDate)}</p>
              {selectedDate === today && (<p className="text-xs text-[#34d399] mt-0.5">Today</p>)}
            </div>
            <button type="button" onClick={goToNextDay} className="tp-button tp-button-inline text-xs px-3 py-1.5">Next</button>
          </div>

          <div className="tp-panel mt-3 flex-1 flex flex-col p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${saveStatus === "Saved" ? "text-[#34d399]" : saveStatus === "Saving..." ? "text-amber-400" : "text-white/30"}`}>{saveStatus}</span>
              <span className="text-xs text-white/30">{wordCount(editorContent)} {wordCount(editorContent) === 1 ? "word" : "words"}</span>
            </div>
            <textarea
              value={editorContent}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="Write your thoughts for the day..."
              className="journal-textarea flex-1 w-full bg-transparent border border-white/10 rounded-lg px-3 py-3 sm:px-4 text-sm text-white font-mono leading-relaxed resize-none placeholder:text-white/20 focus:outline-none focus:border-[#34d399]/30"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
