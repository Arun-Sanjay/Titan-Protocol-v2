/**
 * Local-cache data export. Builds a single JSON document of every synced
 * table for the signed-in user (read from the SQLite cache, which mirrors the
 * cloud). Powers the "Export my data" button in Settings — restores the
 * portability promise the marketing once made and gives users a real escape
 * hatch / backup (audit §5.12).
 */
import { all } from "../db/sqlite/client";
import { rowFromSqlite, stripSyncColumns } from "../db/sqlite/coerce";
import { SYNCED_TABLES } from "./tables";

export interface DataExport {
  app: string;
  version: number;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

/** Gather every live (non-tombstoned) row across all synced tables. */
export async function buildDataExport(): Promise<DataExport> {
  const tables: Record<string, unknown[]> = {};
  for (const table of SYNCED_TABLES) {
    try {
      const rows = await all<Record<string, unknown>>(
        `SELECT * FROM ${table} WHERE _deleted = 0`,
      );
      tables[table] = rows.map((r) =>
        stripSyncColumns(rowFromSqlite(table, r)),
      );
    } catch {
      // Table may be absent on a lagging local schema — skip it.
    }
  }
  return {
    app: "Titan Protocol",
    version: 1,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

/** Build the export and trigger a browser download of the JSON file. */
export async function downloadDataExport(): Promise<void> {
  const data = await buildDataExport();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = `titan-protocol-export-${data.exportedAt.slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
