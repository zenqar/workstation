-- =============================================================
-- Migration 032: Secure Support Messages
-- =============================================================

create table if not exists public.support_messages (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  sender_type text not null check (sender_type in ('admin', 'business')),
  sender_user_id uuid references auth.users(id) on delete set null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table support_messages is 'Secure messaging between Platform Admins and Businesses';

create index if not exists idx_support_messages_business_id on support_messages(business_id);

-- RLS
alter table public.support_messages enable row level security;

create policy "Businesses can view their own support messages"
  on public.support_messages for select
  to authenticated
  using (
    business_id in (select business_id from business_memberships where user_id = auth.uid() and status = 'active')
  );

create policy "Businesses can insert support messages"
  on public.support_messages for insert
  to authenticated
  with check (
    sender_type = 'business' and 
    business_id in (select business_id from business_memberships where user_id = auth.uid() and status = 'active')
  );

-- Admins use SERVICE_ROLE which bypasses RLS, so no admin policies needed here.

-- Notify PostgREST to reload schema
notify pgrst, 'reload schema';
