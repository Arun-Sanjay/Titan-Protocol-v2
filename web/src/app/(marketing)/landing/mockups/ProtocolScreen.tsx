import { ArrowRight, Check, Sun } from "lucide-react";

const checklist = [
  { label: "Review today's missions", done: true },
  { label: "Check engine scores", done: true },
  { label: "Activate focus mode", done: false },
];

export default function ProtocolScreen() {
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
        <div className="mt-1 flex items-center gap-1.5">
          <Sun className="h-3 w-3 text-white" strokeWidth={1.5} />
          <h1 className="text-[20px] font-bold tracking-[0.04em] text-white leading-none">
            MORNING
          </h1>
        </div>
        <p className="mt-1.5 text-[8px] text-white/40 leading-snug">
          Tuesday, October 14
        </p>
      </div>

      {/* Intention card */}
      <div className="mx-5 mt-3 rounded-[6px] border border-white/10 p-3">
        <p className="text-[7px] font-medium tracking-[0.2em] text-white/40">
          TODAY&apos;S INTENTION
        </p>
        <p className="mt-1.5 text-[11px] font-medium text-white leading-relaxed">
          Ship the landing page redesign and close 3 deep-work blocks before 6 PM.
        </p>
        <div className="mt-2.5 flex items-center justify-between text-[7px] text-white/35">
          <span>72 / 280 chars</span>
          <span className="h-1 w-1 rounded-full bg-white animate-blink" />
        </div>
      </div>

      {/* Checklist */}
      <div className="mx-5 mt-3">
        <p className="text-[7px] font-medium tracking-[0.2em] text-white/40 px-1">
          PROTOCOL CHECKLIST
        </p>
        <div className="mt-1.5 rounded-[6px] border border-white/10 overflow-hidden">
          {checklist.map((item, i) => (
            <div
              key={item.label}
              className={`flex items-center gap-2.5 px-3 py-2 ${
                i !== checklist.length - 1 ? "border-b border-white/6" : ""
              }`}
            >
              <span
                className={`flex h-3 w-3 items-center justify-center rounded-[2px] border flex-shrink-0 ${
                  item.done ? "border-white bg-white" : "border-white/20"
                }`}
              >
                {item.done && (
                  <Check className="h-1.5 w-1.5 text-black" strokeWidth={3} />
                )}
              </span>
              <span
                className={`text-[10px] font-medium ${
                  item.done ? "text-white/40 line-through" : "text-white"
                }`}
              >
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Energy budget */}
      <div className="mx-5 mt-3 rounded-[6px] border border-white/10 p-3">
        <p className="text-[7px] font-medium tracking-[0.2em] text-white/40">
          ENERGY BUDGET
        </p>
        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span className="text-[20px] font-bold tabular-nums leading-none text-white">
            82
          </span>
          <span className="text-[10px] font-semibold text-white/55">%</span>
        </div>
        <div className="mt-2 h-[3px] w-full rounded-full bg-white/8 overflow-hidden">
          <div className="h-full w-[82%] bg-white" />
        </div>
      </div>

      {/* Begin button */}
      <div className="absolute bottom-4 inset-x-5">
        <button className="w-full h-9 rounded-[5px] border border-white bg-white text-black font-bold text-[10px] tracking-[0.14em] flex items-center justify-center gap-1.5">
          BEGIN PROTOCOL
          <ArrowRight className="h-2.5 w-2.5" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
