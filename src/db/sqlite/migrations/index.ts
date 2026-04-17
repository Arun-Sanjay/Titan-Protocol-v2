import { SQL as SQL_001 } from "./001_initial";

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
];
