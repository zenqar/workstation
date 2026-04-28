-- =============================================================
-- Migration 025: Fix contact requests RLS policy
-- =============================================================

-- 1. Drop existing policies
drop policy if exists "Users can view requests sent to their email" on public.contact_requests;
drop policy if exists "Users can update requests sent to them" on public.contact_requests;

-- 2. Re-create with JWT email check
-- We use auth.jwt() ->> 'email' because regular users cannot query auth.users directly in RLS policies.
create policy "Users can view requests sent to their email"
  on public.contact_requests for select
  using (lower(receiver_email) = lower(auth.jwt() ->> 'email'));

create policy "Users can update requests sent to them"
  on public.contact_requests for update
  using (lower(receiver_email) = lower(auth.jwt() ->> 'email'))
  with check (lower(receiver_email) = lower(auth.jwt() ->> 'email'));
