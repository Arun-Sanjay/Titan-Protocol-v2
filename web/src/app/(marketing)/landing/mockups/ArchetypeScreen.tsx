import { BookOpen, Crown, Dumbbell, TrendingUp } from "lucide-react";

interface Archetype {
  Icon: typeof Crown;
  name: string;
  desc: string;
  weights: { body: number; mind: number; money: number; charisma: number };
  selected?: boolean;
}

const archetypes: Archetype[] = [
  {
    Icon: Crown,
    name: "Titan",
    desc: "Master of all four engines",
    weights: { body: 25, mind: 25, money: 25, charisma: 25 },
    selected: true,
  },
  {
    Icon: Dumbbell,
    name: "Athlete",
    desc: "Body-led performance",
    weights: { body: 50, mind: 20, money: 15, charisma: 15 },
  },
  {
    Icon: BookOpen,
    name: "Scholar",
    desc: "Mind-led, deep learner",
    weights: { body: 15, mind: 55, money: 15, charisma: 15 },
  },
  {
    Icon: TrendingUp,
    name: "Hustler",
    desc: "Money-led, builder",
    weights: { body: 15, mind: 20, money: 50, charisma: 15 },
  },
];

export default function ArchetypeScreen() {
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
          STEP 1 OF 4
        </p>
        <h1 className="mt-1 text-[18px] font-bold tracking-[-0.01em] text-white leading-tight">
          Choose your archetype
        </h1>
        <p className="mt-1.5 text-[8px] text-white/40 leading-snug">
          Each archetype weights the four engines differently.
        </p>
      </div>

      {/* 2x2 grid */}
      <div className="px-5 mt-3 grid grid-cols-2 gap-2">
        {archetypes.map((a) => {
          const Icon = a.Icon;
          return (
            <div
              key={a.name}
              className={`rounded-[6px] p-2.5 ${
                a.selected
                  ? "border border-white/35 bg-white/[0.05]"
                  : "border border-white/10 bg-transparent"
              }`}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-[4px] border border-white/12 bg-white/[0.04]">
                <Icon className="h-3.5 w-3.5 text-white" strokeWidth={1.5} />
              </div>
              <p className="mt-2 text-[11px] font-bold text-white">{a.name}</p>
              <p className="text-[7px] font-medium text-white/40 mt-0.5 leading-snug">
                {a.desc}
              </p>

              {/* Weight bars — monochrome white */}
              <div className="mt-2.5 space-y-[3px]">
                {(["body", "mind", "money", "charisma"] as const).map((key) => (
                  <div key={key} className="flex items-center gap-1">
                    <span className="w-[16px] text-[5px] font-medium tracking-[0.14em] text-white/35 uppercase">
                      {key.slice(0, 3)}
                    </span>
                    <div className="flex-1 h-[2px] rounded-full bg-white/8 overflow-hidden">
                      <div
                        className="h-full bg-white/80"
                        style={{ width: `${a.weights[key]}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom hint */}
      <div className="absolute bottom-4 inset-x-5 rounded-[5px] border border-white/10 px-3 py-2 flex items-center justify-between">
        <span className="text-[7px] font-medium tracking-[0.18em] text-white/45">
          + 4 MORE ARCHETYPES
        </span>
        <span className="text-[7px] font-bold tracking-[0.14em] text-white/85">
          STEP 1 / 4
        </span>
      </div>
    </div>
  );
}
