-- =============================================================
-- Migration 005: Fix businesses insert RLS policy
-- =============================================================

-- Drop the old policy just in case it was created with stricter rules
-- (like checking created_by which no longer exists in the live DB)
drop policy if exists "businesses: authenticated insert" on businesses;

-- Recreate it to simply allow any authenticated user to insert a business
create policy "businesses: authenticated insert"
  on businesses for insert
  with check (auth.uid() is not null);
