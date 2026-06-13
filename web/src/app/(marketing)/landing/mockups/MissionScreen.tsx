import { ArrowUpRight, Filter } from "lucide-react";

const missions = [
  { label: "Deep work block", engine: "MIND", xp: 120, progress: 100 },
  { label: "Cardio · 30 min", engine: "BODY", xp: 80, progress: 100 },
  { label: "Review budget", engine: "MONEY", xp: 60, progress: 60 },
  { label: "Inbox zero", engine: "MIND", xp: 60, progress: 30 },
  { label: "Call mentor", engine: "CHARISMA", xp: 40, progress: 0 },
];

export default function MissionScreen() {
  return (
    <div
      className="relative h-full w-full bg-black text-white overflow-hidden"
      style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
    >
      {/* Top label + heading */}
      <div className="px-5 pt-14">
        <p
          className="text-[7px] font-medium tracking-[0.2em] text-white/40"
          style={{ letterSpacing: "0.22em" }}
        >
          TITAN PROTOCOL
        </p>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-[22px] font-bold tracking-[0.04em] text-white leading-none">
            MISSIONS
          </h1>
          <button className="h-6 w-6 rounded-[4px] border border-white/12 flex items-center justify-center">
            <Filter className="h-2.5 w-2.5 text-white/65" strokeWidth={1.5} />
          </button>
        </div>
        <p className="mt-1.5 text-[8px] text-white/40 leading-snug">
          Today&apos;s queue · 4 / 5 in progress
        </p>
      </div>

      {/* TOTAL XP card */}
      <div className="mx-5 mt-3 rounded-[6px] border border-white/10 p-3">
        <p className="text-[7px] font-medium tracking-[0.2em] text-white/40">
          TOTAL XP TODAY
        </p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-[28px] font-bold tabular-nums leading-none text-white">
            +360
          </span>
          <span className="text-[9px] font-semibold text-white/55">XP</span>
        </div>
      </div>

      {/* Mission list */}
      <div className="mx-5 mt-3 rounded-[6px] border border-white/10 overflow-hidden">
        {missions.map((m, i) => (
          <div
            key={m.label}
            className={`px-3 py-2 ${
              i !== missions.length - 1 ? "border-b border-white/8" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`h-3 w-3 rounded-[2px] border ${
                    m.progress === 100 ? "border-white bg-white" : "border-white/30"
                  } flex items-center justify-center`}
                >
                  {m.progress === 100 && (
                    <svg
                      viewBox="0 0 8 8"
                      className="h-1.5 w-1.5 text-black"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M1 4 L3 6 L7 2" />
                    </svg>
                  )}
                </span>
                <div>
                  <p
                    className={`text-[10px] font-medium ${
                      m.progress === 100
                        ? "text-white/45 line-through"
                        : "text-white"
                    }`}
                  >
                    {m.label}
                  </p>
                  <p className="text-[6px] font-medium tracking-[0.16em] text-white/35 mt-0.5">
                    {m.engine}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[9px] font-bold tabular-nums text-white">
                  +{m.xp}
                </span>
                {m.progress > 0 && m.progress < 100 && (
                  <div className="w-8 h-[2px] rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-white/85"
                      style={{ width: `${m.progress}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom strip */}
      <div className="absolute bottom-3 inset-x-5 rounded-[5px] border border-white/10 px-3 py-2 flex items-center justify-between">
        <span className="text-[7px] font-medium tracking-[0.18em] text-white/45">
          6 ACTIVE · 12 COMPLETED
        </span>
        <ArrowUpRight className="h-2.5 w-2.5 text-white/65" />
      </div>
    </div>
  );
}
