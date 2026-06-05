import * as React from "react";

/**
 * Celebration overlay — black-metallic HUD theme.
 *
 * Exposes three things via context:
 *   - triggerConfetti(): a burst of metallic (gold/silver/steel) confetti.
 *   - celebrateRankUp({...}): a centered "RANK UP" / "LEVEL UP" HUD banner +
 *     rank-tinted confetti + a short triumphant chord. Driven by RankUpWatcher
 *     off the rank_up_events queue.
 *   - showAchievement(toast): a corner toast (kept for future achievement use,
 *     re-themed to the metallic palette).
 *
 * No rainbow — particles + accents use a dark metallic palette tinted with the
 * rank's color so it sits on the HUD's black background.
 */

// ─── Palette ─────────────────────────────────────────────────────────────────

/** Metallic confetti — gold / light-gold / silver / white-silver / steel. */
const METALLIC = ["#d4af37", "#f5d76e", "#c0c0c0", "#e8e8e8", "#9a7d3a", "#b8b8b8"];
/** Gold accent used for kickers / labels. */
const GOLD = "#d4af37";

// ─── Toast ───────────────────────────────────────────────────────────────────

export type AchievementToast = {
  id: string;
  icon: string;
  title: string;
  description: string;
};

export type RankUpCelebration = {
  rankName: string;
  level: number;
  color: string;
  /** true when the rank tier (name) changed; false for a same-rank level-up. */
  isMajor: boolean;
};

type CelebrationContextType = {
  showAchievement: (toast: Omit<AchievementToast, "id">) => void;
  triggerConfetti: () => void;
  celebrateRankUp: (params: RankUpCelebration) => void;
};

const CelebrationContext = React.createContext<CelebrationContextType>({
  showAchievement: () => {},
  triggerConfetti: () => {},
  celebrateRankUp: () => {},
});

export function useCelebration() {
  return React.useContext(CelebrationContext);
}

// ─── Confetti ────────────────────────────────────────────────────────────────

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
};

function ConfettiCanvas({
  active,
  colors,
}: {
  active: boolean;
  colors: string[];
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const particlesRef = React.useRef<Particle[]>([]);
  const animFrameRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Particle[] = [];
    for (let i = 0; i < 90; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        color: colors[Math.floor(Math.random() * colors.length)]!,
        size: Math.random() * 7 + 3,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
      });
    }
    particlesRef.current = particles;

    let elapsed = 0;
    function animate() {
      if (!ctx || !canvas) return;
      elapsed++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // gravity
        p.rotation += p.rotationSpeed;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - elapsed / 130);
        // thin metallic shards
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (elapsed < 130) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    }
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [active, colors]);

  if (!active) return null;
  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[10001]"
    />
  );
}

// ─── Rank-up banner ──────────────────────────────────────────────────────────

function RankUpBanner({ rankUp }: { rankUp: RankUpCelebration }) {
  const { rankName, level, color, isMajor } = rankUp;
  return (
    <div style={bannerWrapStyle}>
      <div style={bannerPanelStyle(color, isMajor)}>
        <p style={bannerKickerStyle}>{isMajor ? "RANK UP" : "LEVEL UP"}</p>
        <p style={bannerNameStyle(color)}>{isMajor ? rankName : `LEVEL ${level}`}</p>
        <p style={bannerSubStyle}>
          {isMajor ? `LEVEL ${level} · ${rankName}` : rankName}
        </p>
      </div>
    </div>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function Toast({
  toast,
  onDismiss,
}: {
  toast: AchievementToast;
  onDismiss: (id: string) => void;
}) {
  React.useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{
        background:
          "linear-gradient(135deg, rgba(212,175,55,0.14) 0%, rgba(212,175,55,0.04) 100%)",
        border: "1px solid rgba(212,175,55,0.30)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        animation: "tpSlideInRight 0.3s ease-out",
      }}
    >
      <span className="text-2xl shrink-0">{toast.icon}</span>
      <div className="min-w-0">
        <p
          className="text-xs font-semibold tracking-wider uppercase"
          style={{ color: GOLD }}
        >
          Achievement Unlocked
        </p>
        <p className="text-sm font-medium text-white/90 mt-0.5">{toast.title}</p>
        <p className="text-[11px] text-white/50">{toast.description}</p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 text-white/30 hover:text-white/60 transition-colors"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function CelebrationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = React.useState<AchievementToast[]>([]);
  const [confettiActive, setConfettiActive] = React.useState(false);
  const [confettiColors, setConfettiColors] = React.useState<string[]>(METALLIC);
  const [rankUp, setRankUp] = React.useState<RankUpCelebration | null>(null);

  const fireConfetti = React.useCallback((colors: string[]) => {
    setConfettiColors(colors);
    setConfettiActive(true);
    setTimeout(() => setConfettiActive(false), 2600);
  }, []);

  const triggerConfetti = React.useCallback(
    () => fireConfetti(METALLIC),
    [fireConfetti],
  );

  const playChord = React.useCallback((freqs: number[]) => {
    try {
      const ctx = new AudioContext();
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = "triangle";
        gain.gain.setValueAtTime(0.07, ctx.currentTime + i * 0.09);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + i * 0.09 + 0.7,
        );
        osc.start(ctx.currentTime + i * 0.09);
        osc.stop(ctx.currentTime + i * 0.09 + 0.7);
      });
    } catch {
      // Audio unavailable — visual celebration still fires.
    }
  }, []);

  const celebrateRankUp = React.useCallback(
    (params: RankUpCelebration) => {
      setRankUp(params);
      fireConfetti([params.color, ...METALLIC]);
      playChord(params.isMajor ? [392, 523.25, 659.25, 783.99] : [523.25, 659.25]);
      setTimeout(() => setRankUp(null), 3800);
    },
    [fireConfetti, playChord],
  );

  const showAchievement = React.useCallback(
    (toast: Omit<AchievementToast, "id">) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev, { ...toast, id }]);
      fireConfetti(METALLIC);
      playChord([523.25, 659.25, 783.99]);
    },
    [fireConfetti, playChord],
  );

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = React.useMemo(
    () => ({ showAchievement, triggerConfetti, celebrateRankUp }),
    [showAchievement, triggerConfetti, celebrateRankUp],
  );

  return (
    <CelebrationContext.Provider value={value}>
      {children}

      <ConfettiCanvas active={confettiActive} colors={confettiColors} />

      {rankUp && <RankUpBanner rankUp={rankUp} />}

      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[10000] flex flex-col gap-2 max-w-sm">
          {toasts.map((toast) => (
            <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes tpSlideInRight {
          from { opacity: 0; transform: translateX(100px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes tpRankPop {
          0%   { opacity: 0; transform: scale(0.86) translateY(8px); }
          55%  { opacity: 1; transform: scale(1.02) translateY(0); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
      `,
        }}
      />
    </CelebrationContext.Provider>
  );
}

// ─── Banner styles (black-metallic HUD) ──────────────────────────────────────

const bannerWrapStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 10002,
  display: "grid",
  placeItems: "center",
  pointerEvents: "none",
};

function bannerPanelStyle(color: string, isMajor: boolean): React.CSSProperties {
  return {
    minWidth: 280,
    padding: "26px 40px",
    textAlign: "center",
    borderRadius: 16,
    background:
      "linear-gradient(160deg, var(--tx-panel-solid, #141414) 0%, #0c0c0c 100%)",
    border: `1px solid ${color}`,
    boxShadow: `0 0 ${isMajor ? 60 : 36}px ${color}55, 0 0 0 1px ${color}33, 0 20px 60px rgba(0,0,0,0.6)`,
    backdropFilter: "blur(14px)",
    animation: "tpRankPop 360ms cubic-bezier(0.2, 0.9, 0.2, 1)",
  };
}

const bannerKickerStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.42em",
  textIndent: "0.42em",
  color: GOLD,
  textShadow: `0 0 10px ${GOLD}66`,
};

function bannerNameStyle(color: string): React.CSSProperties {
  return {
    margin: "10px 0 6px",
    fontSize: 30,
    fontWeight: 800,
    letterSpacing: "0.04em",
    color,
    textShadow: `0 0 18px ${color}88`,
  };
}

const bannerSubStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  letterSpacing: "0.12em",
  color: "var(--tx-muted, #808080)",
};
