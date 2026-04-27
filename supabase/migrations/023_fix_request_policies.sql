-- =============================================================
-- Migration 023: Case-insensitive contact requests policy
-- =============================================================

-- 1. Drop existing policies
drop policy if exists "Users can view requests sent to their email" on public.contact_requests;
drop policy if exists "Users can update requests sent to them" on public.contact_requests;

-- 2. Re-create with case-insensitive check
create policy "Users can view requests sent to their email"
  on public.contact_requests for select
  using (lower(receiver_email) = (select lower(email) from auth.users where id = auth.uid()));

create policy "Users can update requests sent to them"
  on public.contact_requests for update
  using (lower(receiver_email) = (select lower(email) from auth.users where id = auth.uid()))
  with check (lower(receiver_email) = (select lower(email) from auth.users where id = auth.uid()));

-- 3. Also ensure sender_user_id is checkable by owners of the business
drop policy if exists "Users can view requests they sent" on public.contact_requests;
create policy "Users can view requests they sent"
  on public.contact_requests for select
  using (
    auth.uid() = sender_user_id 
    OR 
    exists (
      select 1 from public.business_memberships 
      where business_id = sender_business_id 
      and user_id = auth.uid() 
      and role in ('owner', 'admin')
    )
  );
