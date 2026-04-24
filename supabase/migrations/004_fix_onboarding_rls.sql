-- =============================================================
-- Migration 004: Fix onboarding bootstrap — allow first membership insert
-- =============================================================

-- Problem: The existing "memberships: owner/admin manage" INSERT policy requires
-- the user to already be a member of the business. This creates a catch-22 during
-- onboarding — a brand new business has NO members yet, so the insert is blocked
-- by RLS even for the person who just created the business.
--
-- Fix: Add a supplementary policy that allows a user to insert a membership
-- for themselves if they are the `created_by` user of that business AND the
-- role they are assigning themselves is 'owner'. This bootstraps the first member.

create policy "memberships: self-owner bootstrap"
  on business_memberships for insert
  with check (
    -- Must be inserting for themselves
    user_id = auth.uid()
    -- Role must be owner (not allowing privilege escalation)
    and role = 'owner'
    -- The business must have been created by this user
    and exists (
      select 1 from businesses
      where businesses.id = business_memberships.business_id
        and businesses.created_by = auth.uid()
    )
    -- No membership exists yet for this business (true bootstrap only)
    and not exists (
      select 1 from business_memberships bm2
      where bm2.business_id = business_memberships.business_id
    )
  );
