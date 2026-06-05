// AUTO-GENERATED from 003_add_expo_push_token.sql — do not edit
// this template literal directly. See 001_initial.ts for the convention.

export const SQL = `-- M5 schema mirror: add expo_push_token column to local profiles cache so
-- the column survives a restoreFromCloud round-trip. Classic doesn't ship
-- push notifications today; mirroring the column keeps the schema aligned
-- with Supabase + mobile-saas + web so cloud-restore writes don't fail on
-- a "no such column" error when the cloud row carries the field.
ALTER TABLE profiles ADD COLUMN expo_push_token TEXT;
`;
