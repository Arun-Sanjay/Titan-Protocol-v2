/**
 * Changelog page. Curated by hand — date + summary + bullets. Lives in
 * code (this file) rather than a CMS so it ships with the app and stays
 * in version control. Update the ENTRIES array when something ships.
 */
export default function ChangelogPage() {
  return (
    <>
      <section className="mk-page-hero">
        <p className="mk-section-kicker">Changelog</p>
        <h1 className="mk-page-title">What's shipping.</h1>
        <p className="mk-page-lede">
          Selected highlights from the SaaS rebuild. Bigger arc lives in
          the SAAS_ROADMAP.md at the repo root.
        </p>
      </section>

      <section className="mk-section" style={{ borderTop: "none", paddingTop: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {ENTRIES.map((e) => (
            <article key={e.date + e.title} className="mk-card" style={{ padding: 28 }}>
              <p className="mk-card-mark">{e.date} · {e.tag}</p>
              <h2 className="mk-card-title">{e.title}</h2>
              <ul style={{ margin: "12px 0 0", padding: "0 0 0 18px" }}>
                {e.bullets.map((b) => (
                  <li
                    key={b}
                    style={{
                      fontSize: 13,
                      lineHeight: 1.6,
                      color: "rgba(232,234,237,0.72)",
                      marginBottom: 6,
                      fontFamily: "ui-sans-serif, system-ui, sans-serif",
                    }}
                  >
                    {b}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

const ENTRIES = [
  {
    date: "2026-05-25",
    tag: "PHASE 2",
    title: "Marketing site + route restructure",
    bullets: [
      "Public landing, pricing, features, changelog, about pages",
      "Auth-gated routes moved from /os to /app",
      "Branded 404 page; redirects + back-compat for old /os links",
      "Sentry / PostHog scaffold ready for env keys",
    ],
  },
  {
    date: "2026-05-24",
    tag: "PHASE 1",
    title: "Hybrid data layer + cross-device sync",
    bullets: [
      "Supabase is the source of truth; SQLite mirrors as a read cache",
      "Realtime channel pushes other devices' changes into this device",
      "First-run cloud pull on fresh sign-in; wipe on sign-out",
      "Manual backup UI removed (sync is continuous now)",
      "47/47 vitest pass, full build clean",
    ],
  },
  {
    date: "2026-05-24",
    tag: "PHASE 0",
    title: "Auth reactivated + CI + working tree clean",
    bullets: [
      "DEV_USER_ID bypass removed; OSLayout's auth gate restored",
      "GitHub Actions CI for web + shared (mobile already had android.yml)",
      "Phase 7 working tree committed across mobile / shared / web",
    ],
  },
  {
    date: "2026-04-22",
    tag: "MIGRATION",
    title: "Local-first migration complete (pre-SaaS)",
    bullets: [
      "Web app moved from cloud-first to local-first SQLite (Phases 1-7)",
      "26 SQLite services, 25 React Query hooks, atomic restore",
      "Shared package trimmed to pure logic + types + data",
    ],
  },
];
