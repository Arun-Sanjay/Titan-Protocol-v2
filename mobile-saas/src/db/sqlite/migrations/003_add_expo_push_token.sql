-- M5 schema mirror: add expo_push_token column to local profiles cache so
-- the column survives a restoreFromCloud round-trip and is writable when the
-- push-token registration code (src/lib/push-token.ts) calls cloudUpsert.
--
-- SQLite has no IF NOT EXISTS for ADD COLUMN; the migrator only runs each
-- migration once (tracked in schema_migrations) so re-application is not a
-- concern.
ALTER TABLE profiles ADD COLUMN expo_push_token TEXT;
