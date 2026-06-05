// Raw-SQL imports via Vite's `?raw` loader. See src/vite-env.d.ts for the
// ambient type declaration. The .sql files are the human-readable source
// of truth — keep them in sync with Supabase schema and with mobile's
// copy under mobile/src/db/sqlite/migrations/.
import SQL_001 from "./001_initial.sql?raw";
import SQL_002 from "./002_add_expo_push_token.sql?raw";
import SQL_003 from "./003_add_xp_log.sql?raw";

export interface Migration {
  id: string;
  sql: string;
}

// Ordered registry. New migrations append to this array with a monotonic
// id prefix (`002_*`, `003_*`, …). The migrator refuses to re-apply a
// migration whose id is already present in `schema_migrations`, so a
// migration, once shipped, must never be edited — add a new one instead.
export const migrations: Migration[] = [
  { id: "001_initial", sql: SQL_001 },
  { id: "002_add_expo_push_token", sql: SQL_002 },
  { id: "003_add_xp_log", sql: SQL_003 },
];
