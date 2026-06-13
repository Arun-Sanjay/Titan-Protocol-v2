-- 1-day free-trial marker — mirror of Supabase profiles.trial_started_at.
-- Entitlement reads as Pro while now < trial_started_at + 24h (or an active
-- subscription exists). Migrator self-heal treats a duplicate column as
-- already-applied, so this is safe on an existing local cache.
ALTER TABLE profiles ADD COLUMN trial_started_at TEXT;
