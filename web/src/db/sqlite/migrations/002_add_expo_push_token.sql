-- M5 schema mirror: add expo_push_token column to local profiles cache so
-- the column survives a restoreFromCloud round-trip. Web doesn't use the
-- column today; mirroring keeps the schema aligned with mobile-saas + Supabase
-- so a future profile-row sync doesn't drop the column.
ALTER TABLE profiles ADD COLUMN expo_push_token TEXT;
