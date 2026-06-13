import {
  Activity,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Brain,
  ChevronRight,
  Coins,
  Crosshair,
  Dumbbell,
  Flag,
  Flame,
  Heart,
  LayoutDashboard,
  LineChart,
  Moon,
  Scale,
  Settings,
  Timer,
  Users,
  Utensils,
} from "lucide-react";

interface DashboardScreenProps {
  device?: "phone" | "laptop";
}

/**
 * Mini Titan OS dashboard. Renders inside a phone or laptop frame.
 * Visual language matches the real Titan OS app reference:
 *   - Pure black background
 *   - Thin white-outline cards (no fill)
 *   - Massive bold percentages
 *   - Mini sparkline charts on engine cards
 *   - 4-axis radar chart for the engines
 *   - Small-caps labels in white/40
 *   - Left sidebar nav (laptop variant only)
 */
export default function DashboardScreen({
  device = "phone",
}: DashboardScreenProps) {
  if (device === "laptop") {
    return <DashboardLaptop />;
  }
  return <DashboardPhone />;
}

const ENGINES = [
  { key: "BODY", value: 83, delta: -21, deltaUp: false },
  { key: "MIND", value: 100, delta: 14, deltaUp: true },
  { key: "MONEY", value: 57, delta: 8, deltaUp: true },
  { key: "CHARISMA", value: 100, delta: 14, deltaUp: true },
] as const;

/* ============================================================
 *  PHONE LAYOUT
 *  Vertical stack: title → titan score card → engine bars → vs last week
 * ============================================================ */
function DashboardPhone() {
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
        <h1
          className="mt-1 text-[22px] font-bold tracking-[-0.01em] text-white leading-none"
          style={{ letterSpacing: "0.04em" }}
        >
          TITAN OS
        </h1>
        <p className="mt-1.5 text-[8px] text-white/40 leading-snug">
          Your performance OS — four engines, one view.
        </p>
      </div>

      {/* TITAN SCORE card */}
      <div className="mx-5 mt-3 rounded-[6px] border border-white/10 p-3">
        <p className="text-[7px] font-medium tracking-[0.2em] text-white/40">
          TITAN SCORE
        </p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-[32px] font-bold tabular-nums leading-none text-white">
            85
          </span>
          <span className="text-[14px] font-semibold tabular-nums text-white/85">
            .0%
          </span>
        </div>
        <p className="mt-1 text-[8px] text-white/40">4 / 4 engines active today</p>

        {/* Engine bars */}
        <div className="mt-3 space-y-1.5">
          {ENGINES.map((e) => (
            <div key={e.key} className="flex items-center gap-2">
              <span className="w-[44px] text-[7px] font-medium tracking-[0.12em] text-white/55">
                {e.key}
              </span>
              <div className="flex-1 h-[3px] rounded-full bg-white/8 overflow-hidden">
                <div className="h-full bg-white" style={{ width: `${e.value}%` }} />
              </div>
              <span className="w-[28px] text-right text-[8px] font-semibold tabular-nums text-white/75">
                {e.value}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* VS LAST WEEK */}
      <div className="mx-5 mt-3 rounded-[6px] border border-white/10 p-3">
        <p className="text-[7px] font-medium tracking-[0.2em] text-white/40">
          VS LAST WEEK
        </p>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {ENGINES.map((e) => {
            const Arrow = e.deltaUp ? ArrowUp : ArrowDown;
            return (
              <div key={e.key} className="text-center">
                <p className="text-[6px] font-medium tracking-[0.14em] text-white/40">
                  {e.key}
                </p>
                <div className="mt-0.5 flex items-center justify-center gap-0.5">
                  <Arrow className="h-2 w-2 text-white/85" strokeWidth={2.5} />
                  <span className="text-[10px] font-bold tabular-nums text-white">
                    {Math.abs(e.delta)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* THIS WEEK strip */}
      <div className="mx-5 mt-3 rounded-[6px] border border-white/10 p-3">
        <p className="text-[7px] font-medium tracking-[0.2em] text-white/40">
          THIS WEEK
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[6px] font-medium tracking-[0.12em] text-white/40">
              AVG SCORE
            </p>
            <p className="mt-0.5 text-[12px] font-bold tabular-nums text-white">78%</p>
          </div>
          <div>
            <p className="text-[6px] font-medium tracking-[0.12em] text-white/40">
              TASKS DONE
            </p>
            <p className="mt-0.5 text-[12px] font-bold tabular-nums text-white">42</p>
          </div>
          <div>
            <p className="text-[6px] font-medium tracking-[0.12em] text-white/40">
              BEST DAY
            </p>
            <p className="mt-0.5 text-[12px] font-bold tabular-nums text-white">94%</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 *  LAPTOP LAYOUT
 *  Sidebar + main content grid — closely mirrors the reference image.
 * ============================================================ */
function DashboardLaptop() {
  return (
    <div
      className="relative h-full w-full bg-black text-white overflow-hidden flex"
      style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
    >
      {/* === LEFT SIDEBAR === */}
      <aside className="w-[110px] py-3 px-3 flex flex-col">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 bg-white" />
          <p
            className="text-[7px] font-bold tracking-[0.18em] text-white"
            style={{ letterSpacing: "0.18em" }}
          >
            TITAN OS
          </p>
        </div>

        <SidebarSection
          label="CORE"
          items={[
            { Icon: LayoutDashboard, label: "Dashboard", active: true },
            { Icon: Crosshair, label: "Command" },
            { Icon: LineChart, label: "Analytics" },
          ]}
        />
        <SidebarSection
          label="ENGINES"
          items={[
            { Icon: Heart, label: "Body" },
            { Icon: Brain, label: "Mind" },
            { Icon: Coins, label: "Money" },
            { Icon: Users, label: "Charisma" },
          ]}
        />
        <SidebarSection
          label="TRACK"
          items={[
            { Icon: Flame, label: "Habits" },
            { Icon: BookOpen, label: "Journal" },
            { Icon: Flag, label: "Goals" },
          ]}
        />
        <SidebarSection
          label="TOOLS"
          items={[
            { Icon: Timer, label: "Focus" },
            { Icon: Dumbbell, label: "Workouts" },
            { Icon: Moon, label: "Sleep" },
            { Icon: Scale, label: "Weight" },
            { Icon: Utensils, label: "Nutrition" },
          ]}
        />

        <div className="mt-auto pt-2 border-t border-white/8 flex items-center gap-1.5">
          <Settings className="h-2 w-2 text-white/45" strokeWidth={1.5} />
          <span className="text-[7px] font-medium text-white/45">SETTINGS</span>
        </div>
      </aside>

      {/* === MAIN CONTENT === */}
      <main className="flex-1 p-4 overflow-hidden">
        {/* Title */}
        <p
          className="text-[7px] font-medium tracking-[0.2em] text-white/40"
          style={{ letterSpacing: "0.22em" }}
        >
          TITAN PROTOCOL
        </p>
        <h1
          className="mt-0.5 text-[26px] font-bold tracking-[0.02em] leading-none text-white"
          style={{ letterSpacing: "0.04em" }}
        >
          TITAN OS
        </h1>
        <p className="mt-1 text-[7px] text-white/45">
          Your performance operating system — four engines, one view.
        </p>

        {/* Top row: Titan Score + Engine Overview */}
        <div className="mt-3 grid grid-cols-[1.55fr_1fr] gap-2.5">
          {/* TITAN SCORE card */}
          <div className="rounded-[5px] border border-white/10 p-3">
            <p className="text-[6px] font-medium tracking-[0.2em] text-white/40">
              TITAN SCORE
            </p>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-[34px] font-bold tabular-nums leading-none text-white">
                85
              </span>
              <span className="text-[16px] font-semibold tabular-nums text-white/85">
                .0%
              </span>
            </div>
            <p className="mt-0.5 text-[7px] text-white/40">
              4 / 4 engines active today
            </p>
            <div className="mt-2 space-y-1">
              {ENGINES.map((e) => (
                <div key={e.key} className="flex items-center gap-2">
                  <span className="w-[40px] text-[6px] font-medium tracking-[0.14em] text-white/55">
                    {e.key}
                  </span>
                  <div className="flex-1 h-[2px] rounded-full bg-white/8 overflow-hidden">
                    <div className="h-full bg-white" style={{ width: `${e.value}%` }} />
                  </div>
                  <span className="w-[24px] text-right text-[7px] font-semibold tabular-nums text-white/75">
                    {e.value}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ENGINE OVERVIEW radar */}
          <div className="rounded-[5px] border border-white/10 p-3 flex flex-col">
            <p className="text-[6px] font-medium tracking-[0.2em] text-white/40">
              ENGINE OVERVIEW
            </p>
            <div className="flex-1 flex items-center justify-center mt-1">
              <svg viewBox="0 0 120 90" className="w-full h-full max-h-[90px]">
                {/* Outer diamond */}
                <polygon
                  points="60,10 105,45 60,80 15,45"
                  fill="none"
                  stroke="rgba(255,255,255,0.18)"
                  strokeWidth="0.6"
                />
                {/* Mid diamond */}
                <polygon
                  points="60,22 92,45 60,68 28,45"
                  fill="none"
                  stroke="rgba(255,255,255,0.10)"
                  strokeWidth="0.6"
                />
                {/* Inner diamond */}
                <polygon
                  points="60,34 80,45 60,56 40,45"
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="0.6"
                />
                {/* Cross axes */}
                <line
                  x1="60"
                  y1="10"
                  x2="60"
                  y2="80"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="0.4"
                />
                <line
                  x1="15"
                  y1="45"
                  x2="105"
                  y2="45"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="0.4"
                />
                {/* User shape (slightly skewed for character) */}
                <polygon
                  points="60,15 100,45 60,75 22,45"
                  fill="rgba(255,255,255,0.04)"
                  stroke="rgba(255,255,255,0.6)"
                  strokeWidth="0.6"
                />
                {/* Labels */}
                <text
                  x="60"
                  y="6"
                  fill="rgba(255,255,255,0.55)"
                  fontSize="5"
                  textAnchor="middle"
                  fontFamily="Inter,sans-serif"
                >
                  Body
                </text>
                <text
                  x="113"
                  y="47"
                  fill="rgba(255,255,255,0.55)"
                  fontSize="5"
                  textAnchor="middle"
                  fontFamily="Inter,sans-serif"
                >
                  Mind
                </text>
                <text
                  x="60"
                  y="88"
                  fill="rgba(255,255,255,0.55)"
                  fontSize="5"
                  textAnchor="middle"
                  fontFamily="Inter,sans-serif"
                >
                  Money
                </text>
                <text
                  x="7"
                  y="47"
                  fill="rgba(255,255,255,0.55)"
                  fontSize="5"
                  textAnchor="middle"
                  fontFamily="Inter,sans-serif"
                >
                  Char.
                </text>
              </svg>
            </div>
          </div>
        </div>

        {/* VS LAST WEEK strip */}
        <div className="mt-2.5 rounded-[5px] border border-white/10 p-2.5">
          <p className="text-[6px] font-medium tracking-[0.2em] text-white/40">
            VS LAST WEEK
          </p>
          <div className="mt-1.5 grid grid-cols-4 gap-1">
            {ENGINES.map((e) => {
              const Arrow = e.deltaUp ? ArrowUp : ArrowDown;
              return (
                <div key={e.key} className="text-center">
                  <p className="text-[5px] font-medium tracking-[0.14em] text-white/40">
                    {e.key}
                  </p>
                  <div className="mt-0.5 flex items-center justify-center gap-0.5">
                    <Arrow className="h-2 w-2 text-white/85" strokeWidth={2.5} />
                    <span className="text-[11px] font-bold tabular-nums text-white">
                      {Math.abs(e.delta)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Engine cards row */}
        <div className="mt-2.5 grid grid-cols-4 gap-1.5">
          {ENGINES.map((e) => (
            <div key={e.key} className="rounded-[5px] border border-white/10 p-2">
              <div className="flex items-center justify-between">
                <p className="text-[6px] font-bold tracking-[0.14em] text-white/55">
                  {e.key}
                </p>
                <span className="text-[10px] font-bold tabular-nums text-white">
                  {e.value}%
                </span>
              </div>
              <svg
                viewBox="0 0 100 22"
                className="mt-1 w-full h-4"
                preserveAspectRatio="none"
              >
                <path
                  d="M0,18 L14,16 L28,12 L42,14 L56,8 L70,10 L84,6 L100,4"
                  fill="none"
                  stroke="rgba(255,255,255,0.85)"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="mt-1 flex items-center justify-between text-[6px]">
                <span className="text-white/45">Today</span>
                <ChevronRight className="h-2 w-2 text-white/55" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

/* ============================================================
 *  SIDEBAR HELPERS
 * ============================================================ */
interface SidebarItem {
  Icon: typeof Activity;
  label: string;
  active?: boolean;
}

function SidebarSection({
  label,
  items,
}: {
  label: string;
  items: SidebarItem[];
}) {
  return (
    <div className="mt-2.5">
      <p
        className="text-[5px] font-medium tracking-[0.2em] text-white/35"
        style={{ letterSpacing: "0.22em" }}
      >
        {label}
      </p>
      <ul className="mt-1 space-y-0.5">
        {items.map((item) => {
          const Icon = item.Icon;
          return (
            <li
              key={item.label}
              className={`flex items-center gap-1.5 ${
                item.active ? "text-white" : "text-white/55"
              }`}
            >
              <Icon className="h-2 w-2" strokeWidth={1.6} />
              <span className="text-[6.5px] font-medium">{item.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
