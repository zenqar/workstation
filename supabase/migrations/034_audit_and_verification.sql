-- =============================================================
-- Migration 034: Audit Logging & Verification Badges
-- =============================================================

-- 1. Create Audit Logs table
create table if not exists public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_user_id uuid references auth.users(id) on delete set null,
  business_id uuid references businesses(id) on delete cascade,
  action text not null, -- e.g. 'INVOICE_ISSUE', 'BUSINESS_DELETE', 'SETTINGS_UPDATE'
  entity_type text not null, -- e.g. 'invoice', 'business', 'account'
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

comment on table audit_logs is 'Watchdog logs for all platform activities';

-- 2. Add verification tracking to businesses
alter table public.businesses
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id) on delete set null,
  add column if not exists is_premium boolean default false;

-- 3. RLS for Audit Logs (Admins only via SERVICE_ROLE, but let's add basic read for related users if needed)
alter table public.audit_logs enable row level security;

create policy "Users can view audit logs for their own businesses"
  on public.audit_logs for select
  using (
    business_id in (select business_id from business_memberships where user_id = auth.uid())
  );

-- 4. Indexes
create index if not exists idx_audit_logs_business_id on audit_logs(business_id);
create index if not exists idx_audit_logs_actor_user_id on audit_logs(actor_user_id);
create index if not exists idx_audit_logs_created_at on audit_logs(created_at desc);

notify pgrst, 'reload schema';
