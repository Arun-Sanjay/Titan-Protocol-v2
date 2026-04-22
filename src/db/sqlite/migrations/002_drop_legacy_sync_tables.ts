// AUTO-GENERATED from 002_drop_legacy_sync_tables.sql — do not edit
// this template literal directly. See 001_initial.ts for the convention.

export const SQL = `-- Titan Protocol — drop legacy sync-engine scratchpad tables.
--
-- \`pending_mutations\` was the outbox for the pre-local-first Supabase-first
-- architecture: mutations queued here, a background worker pushed them up.
-- The local-first migration removed the writer AND the worker, so the
-- table has been dead weight ever since.
--
-- \`sync_meta\` was a key/value scratchpad for sync state. The last-backup
-- timestamp the user sees in the Profile tab is actually stored in MMKV
-- under \`cloud:last_backup_at\` (see src/components/CloudBackupSection.tsx).
-- Nothing reads or writes this table.
--
-- Safe to drop: the DDL was created lazily via IF NOT EXISTS, so on
-- existing devices the DROP hits the tables; on fresh installs the 001
-- migration still creates them and 002 immediately drops them (harmless).

DROP TABLE IF EXISTS pending_mutations;
DROP TABLE IF EXISTS sync_meta;
`;
