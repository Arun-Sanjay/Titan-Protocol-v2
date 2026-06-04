// Shared types for the platform-specific client impls.

export interface RunResult {
  /** Rows affected by INSERT/UPDATE/DELETE. */
  changes: number;
  /** Row id for INSERT. 0 if not applicable or unavailable. */
  lastInsertRowId: number;
}

export interface ClientImpl {
  all<T = unknown>(sql: string, params?: unknown): Promise<T[]>;
  get<T = unknown>(sql: string, params?: unknown): Promise<T | null>;
  run(sql: string, params?: unknown): Promise<RunResult>;
  exec(source: string): Promise<void>;
  transaction<T>(task: (tx: unknown) => Promise<T>): Promise<T>;
}
