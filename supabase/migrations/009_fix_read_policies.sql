-- =============================================================
-- Migration 009: Fix Read Policies & Helper Functions
-- Purpose: Ensures the helper functions and read policies
--          are correctly installed so the Dashboard doesn't
--          crash and redirect back to onboarding.
-- =============================================================

-- 1. Create the helper function for checking user businesses
create or replace function public.user_business_ids()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select business_id from business_memberships where user_id = auth.uid() and status = 'active';
$$;

-- 2. Drop legacy policies that might be using old schemas or missing functions
drop policy if exists "businesses: member read" on businesses;
drop policy if exists "memberships: read own" on business_memberships;

-- 3. Recreate the read policy for businesses
create policy "businesses: member read"
  on businesses for select
  using (
    id in (select public.user_business_ids())
  );

-- 4. Recreate the read policy for memberships
create policy "memberships: read own"
  on business_memberships for select
  using (
    user_id = auth.uid()
    or business_id in (select public.user_business_ids())
  );
