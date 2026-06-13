// 1-day free-trial marker — mirror of Supabase profiles.trial_started_at.
// Entitlement reads as Pro while now < trial_started_at + 24h (or an active
// subscription exists). Metro ships no .sql loader, so the SQL is a string.
export const SQL = `ALTER TABLE profiles ADD COLUMN trial_started_at TEXT;`;
