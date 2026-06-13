import { Check, ChevronRight, Crown } from "lucide-react";

const ranks = [
  "Initiate",
  "Operative",
  "Agent",
  "Specialist",
  "Commander",
  "Vanguard",
  "Sentinel",
  "Titan",
];

const CURRENT = 5; // Commander = index 4 (1-indexed = 5)

export default function RankScreen() {
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
        <h1 className="mt-1 text-[22px] font-bold tracking-[0.04em] text-white leading-none">
          RANK
        </h1>
        <p className="mt-1.5 text-[8px] text-white/40 leading-snug">
          Eight tiers from Initiate to Titan.
        </p>
      </div>

      {/* Current rank card */}
      <div className="mx-5 mt-3 rounded-[6px] border border-white/10 p-4 text-center">
        <div className="flex h-11 w-11 mx-auto items-center justify-center rounded-[6px] border border-white/15 bg-white/[0.04]">
          <Crown className="h-5 w-5 text-white" strokeWidth={1.5} />
        </div>
        <p className="mt-2 text-[18px] font-bold tracking-[-0.01em] text-white leading-none">
          COMMANDER
        </p>
        <p className="mt-1 text-[7px] font-medium tracking-[0.18em] text-white/45">
          RANK 5 OF 8
        </p>

        {/* Progress to next */}
        <div className="mt-3 text-left">
          <div className="flex items-center justify-between text-[6px] font-medium tracking-[0.14em] text-white/40">
            <span>NEXT · VANGUARD</span>
            <span className="text-white/75">77%</span>
          </div>
          <div className="mt-1 h-[3px] w-full rounded-full bg-white/8 overflow-hidden">
            <div className="h-full w-[77%] bg-white" />
          </div>
        </div>
      </div>

      {/* Rank ladder */}
      <div className="mx-5 mt-3">
        <p className="text-[7px] font-medium tracking-[0.2em] text-white/40 px-1">
          RANK LADDER
        </p>
        <div className="mt-1.5 rounded-[6px] border border-white/10 overflow-hidden">
          {ranks.map((rank, i) => {
            const isPast = i < CURRENT - 1;
            const isCurrent = i === CURRENT - 1;
            return (
              <div
                key={rank}
                className={`flex items-center justify-between px-2.5 py-1.5 ${
                  i !== ranks.length - 1 ? "border-b border-white/6" : ""
                } ${isCurrent ? "bg-white/[0.04]" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-3 w-3 items-center justify-center rounded-[2px] border ${
                      isPast
                        ? "border-white/30 bg-white/15"
                        : isCurrent
                          ? "border-white bg-white"
                          : "border-white/12"
                    }`}
                  >
                    {isPast && (
                      <Check className="h-1.5 w-1.5 text-white" strokeWidth={3} />
                    )}
                    {isCurrent && (
                      <ChevronRight
                        className="h-1.5 w-1.5 text-black"
                        strokeWidth={3}
                      />
                    )}
                  </span>
                  <span
                    className={`text-[9px] font-medium ${
                      isCurrent
                        ? "text-white"
                        : isPast
                          ? "text-white/55"
                          : "text-white/30"
                    }`}
                  >
                    {rank}
                  </span>
                </div>
                {isCurrent && (
                  <span className="text-[6px] font-bold tracking-[0.14em] text-white/85">
                    YOU
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom stats */}
      <div className="absolute bottom-3 inset-x-5 grid grid-cols-2 gap-2">
        <div className="rounded-[5px] border border-white/10 px-2.5 py-1.5">
          <p className="text-[6px] font-medium tracking-[0.16em] text-white/40">
            STREAK
          </p>
          <p className="text-[11px] font-bold tabular-nums text-white">47 days</p>
        </div>
        <div className="rounded-[5px] border border-white/10 px-2.5 py-1.5 text-right">
          <p className="text-[6px] font-medium tracking-[0.16em] text-white/40">
            AVG SCORE
          </p>
          <p className="text-[11px] font-bold tabular-nums text-white">85%</p>
        </div>
      </div>
    </div>
  );
}
