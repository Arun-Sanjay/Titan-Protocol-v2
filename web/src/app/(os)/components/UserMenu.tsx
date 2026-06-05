/**
 * Notion / Claude–style account chip. Lives at the top of the sidebar (and
 * the mobile drawer). Shows avatar + name + email and opens a dropdown with
 * the user's rank/level, a Settings link, and Sign out.
 *
 * Everything here is driven by the synced profile (`useProfile()` reads the
 * SQLite cache that Realtime keeps fresh) plus the auth-session email, so it
 * updates live across devices — rename yourself or gain a level on one device
 * and this chip reflects it on the others without a reload.
 */
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useProfile } from "../../../hooks/queries/useProfile";
import { useCurrentUserEmail } from "../../../lib/session";
import { useWebAuth } from "../../../lib/auth";
import { rankForLevel, nextRank, levelProgressPct } from "../../../lib/ranks";
import { playClick } from "../../../lib/sound";

function initialsFrom(name: string | null, email: string | null): string {
  const src = (name && name.trim()) || (email ? email.split("@")[0] : "");
  if (!src) return "?";
  const parts = src.replace(/[._-]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function UserMenu({
  variant = "sidebar",
}: {
  variant?: "sidebar" | "drawer";
}) {
  const { data: profile } = useProfile();
  const email = useCurrentUserEmail();
  const { signOut } = useWebAuth();
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const displayName =
    (profile?.display_name && profile.display_name.trim()) ||
    (email ? email.split("@")[0] : "Operator");
  const level = profile?.level ?? 1;
  const xp = profile?.xp ?? 0;
  const rank = rankForLevel(level);
  const upcoming = nextRank(level);
  const progressPct = levelProgressPct(xp);
  const initials = initialsFrom(profile?.display_name ?? null, email);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleSignOut() {
    if (signingOut) return;
    playClick();
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      navigate("/auth/login", { replace: true });
    }
  }

  return (
    <div ref={ref} style={{ position: "relative" }} data-testid="user-menu">
      <button
        type="button"
        onClick={() => {
          playClick();
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        style={chipStyle(open)}
      >
        <span style={avatarStyle(rank.color)} aria-hidden="true">
          {initials}
        </span>
        <span style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
          <span style={nameStyle} data-testid="user-menu-name">
            {displayName}
          </span>
          <span style={emailStyle}>{email ?? "—"}</span>
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            flexShrink: 0,
            opacity: 0.5,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 140ms",
          }}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div role="menu" style={menuStyle(variant)}>
          <div style={menuHeaderStyle}>
            <span style={avatarStyle(rank.color, 40)} aria-hidden="true">
              {initials}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ ...nameStyle, fontSize: 14 }}>{displayName}</div>
              <div style={emailStyle}>{email ?? "—"}</div>
            </div>
          </div>

          <div style={statRowStyle} data-testid="user-menu-rank">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: rank.color,
                  boxShadow: `0 0 8px ${rank.color}`,
                }}
                aria-hidden="true"
              />
              <span style={{ color: rank.color, fontWeight: 650, letterSpacing: "0.04em" }}>
                {rank.name}
              </span>
            </span>
            <span style={{ color: "var(--tx-muted, #808080)" }}>
              LVL {level} · {xp.toLocaleString()} XP
            </span>
          </div>

          <div style={progressWrapStyle} data-testid="user-menu-progress">
            <div style={progressTrackStyle}>
              <div
                style={{
                  ...progressFillStyle,
                  width: `${progressPct}%`,
                  background: `linear-gradient(90deg, ${rank.color}, ${rank.color}bb)`,
                  boxShadow: `0 0 8px ${rank.color}66`,
                }}
              />
            </div>
            <div style={progressLabelStyle}>
              <span>{xp % 500} / 500 XP</span>
              <span>
                {upcoming
                  ? `Next: ${upcoming.name} · LVL ${upcoming.minLevel}`
                  : "Max rank"}
              </span>
            </div>
          </div>

          <div style={dividerStyle} />

          <Link
            to="/app/settings"
            role="menuitem"
            onClick={() => {
              playClick();
              setOpen(false);
            }}
            style={menuItemStyle}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Settings</span>
          </Link>

          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
            style={{ ...menuItemStyle, color: "#ff6b6b", width: "100%", background: "transparent", border: "none", cursor: signingOut ? "default" : "pointer" }}
            data-testid="sign-out"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>{signingOut ? "Signing out…" : "Sign out"}</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────

function chipStyle(open: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid var(--tx-stroke, rgba(255,255,255,0.08))",
    background: open
      ? "var(--tx-panel, rgba(255,255,255,0.06))"
      : "var(--tx-panel, rgba(255,255,255,0.03))",
    color: "var(--tx-text, #e6e6e6)",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background 140ms, border-color 140ms",
  };
}

function avatarStyle(color: string, size = 30): React.CSSProperties {
  return {
    flexShrink: 0,
    width: size,
    height: size,
    borderRadius: 9,
    display: "grid",
    placeItems: "center",
    fontSize: size <= 30 ? 11 : 14,
    fontWeight: 700,
    letterSpacing: "0.02em",
    color: "#0a0a0a",
    background: `linear-gradient(135deg, ${color}, ${color}aa)`,
    boxShadow: `0 0 0 1px ${color}55, 0 2px 8px ${color}33`,
  };
}

const nameStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12.5,
  fontWeight: 620,
  color: "var(--tx-text, #e6e6e6)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const emailStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10.5,
  color: "var(--tx-muted, #808080)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

function menuStyle(variant: "sidebar" | "drawer"): React.CSSProperties {
  return {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    right: 0,
    zIndex: 60,
    padding: 6,
    borderRadius: 12,
    border: "1px solid var(--tx-stroke, rgba(255,255,255,0.1))",
    background: "var(--tx-panel-solid, #141414)",
    backdropFilter: "blur(12px)",
    boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
    // In the mobile drawer the chip is wide; cap the menu so it reads well.
    minWidth: variant === "drawer" ? 0 : 220,
  };
}

const menuHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 11,
  padding: "10px 10px 12px",
};

const statRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "8px 11px",
  margin: "0 2px",
  borderRadius: 8,
  background: "var(--tx-panel, rgba(255,255,255,0.04))",
  fontSize: 11,
};

const progressWrapStyle: React.CSSProperties = {
  padding: "4px 11px 2px",
  margin: "0 2px",
};

const progressTrackStyle: React.CSSProperties = {
  height: 5,
  borderRadius: 999,
  background: "var(--tx-stroke, rgba(255,255,255,0.08))",
  overflow: "hidden",
};

const progressFillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: 999,
  transition: "width 240ms ease-out",
};

const progressLabelStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  marginTop: 5,
  fontSize: 9.5,
  letterSpacing: "0.03em",
  color: "var(--tx-muted, #808080)",
};

const dividerStyle: React.CSSProperties = {
  height: 1,
  background: "var(--tx-stroke, rgba(255,255,255,0.08))",
  margin: "6px 2px",
};

const menuItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "9px 11px",
  borderRadius: 8,
  fontSize: 12.5,
  fontWeight: 560,
  color: "var(--tx-text, #e6e6e6)",
  textDecoration: "none",
  fontFamily: "inherit",
  letterSpacing: "0.01em",
};
