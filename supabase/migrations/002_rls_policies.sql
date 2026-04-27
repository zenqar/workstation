-- =============================================================
-- Migration 002: Row Level Security Policies
-- All tenant data is isolated per business_id
-- =============================================================

-- Helper function: returns the business IDs the current user belongs to
create or replace function auth.user_business_ids()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select business_id
  from business_memberships
  where user_id = auth.uid()
    and status = 'active';
$$;

-- Helper function: returns the user's role in a specific business
create or replace function auth.user_role_in_business(p_business_id uuid)
returns user_role
language sql stable security definer
set search_path = public
as $$
  select role
  from business_memberships
  where user_id = auth.uid()
    and business_id = p_business_id
    and status = 'active'
  limit 1;
$$;

-- Helper function: checks if current user is a platform admin
create or replace function auth.is_platform_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from platform_admins
    where user_id = auth.uid()
      and is_active = true
  );
$$;

-- Helper function: check if role has write permission
create or replace function auth.role_can_write(p_business_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    auth.user_role_in_business(p_business_id) in ('owner','admin','accountant','staff'),
    false
  );
$$;

-- Helper function: check if role has manage permission (owner/admin/accountant)
create or replace function auth.role_can_manage(p_business_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    auth.user_role_in_business(p_business_id) in ('owner','admin','accountant'),
    false
  );
$$;

-- =============================================================
-- Enable RLS on all tables
-- =============================================================

alter table profiles                enable row level security;
alter table businesses              enable row level security;
alter table business_memberships    enable row level security;
alter table business_settings       enable row level security;
alter table contacts                enable row level security;
alter table accounts                enable row level security;
alter table invoices                enable row level security;
alter table invoice_items           enable row level security;
alter table payments                enable row level security;
alter table expenses                enable row level security;
alter table money_transactions      enable row level security;
alter table fx_rate_snapshots       enable row level security;
alter table platform_admins         enable row level security;
alter table admin_audit_logs        enable row level security;
alter table file_attachments        enable row level security;

-- =============================================================
-- PROFILES
-- Users can only read/update their own profile
-- =============================================================

create policy "profiles: own read"
  on profiles for select
  using (id = auth.uid() or auth.is_platform_admin());

create policy "profiles: own update"
  on profiles for update
  using (id = auth.uid());

create policy "profiles: own insert"
  on profiles for insert
  with check (id = auth.uid());

-- =============================================================
-- BUSINESSES
-- Members can see their businesses; only owner/admin can update
-- =============================================================

create policy "businesses: member read"
  on businesses for select
  using (
    id in (select auth.user_business_ids())
    or auth.is_platform_admin()
  );

create policy "businesses: owner/admin update"
  on businesses for update
  using (
    auth.user_role_in_business(id) in ('owner', 'admin')
  );

create policy "businesses: authenticated insert"
  on businesses for insert
  with check (auth.uid() is not null);

create policy "businesses: owner delete"
  on businesses for delete
  using (auth.user_role_in_business(id) = 'owner');

-- =============================================================
-- BUSINESS MEMBERSHIPS
-- =============================================================

create policy "memberships: member read own business"
  on business_memberships for select
  using (
    business_id in (select auth.user_business_ids())
    or user_id = auth.uid()
    or auth.is_platform_admin()
  );

create policy "memberships: owner/admin manage"
  on business_memberships for insert
  with check (
    auth.user_role_in_business(business_id) in ('owner', 'admin')
  );

create policy "memberships: owner/admin update"
  on business_memberships for update
  using (
    auth.user_role_in_business(business_id) in ('owner', 'admin')
  );

create policy "memberships: owner delete"
  on business_memberships for delete
  using (
    auth.user_role_in_business(business_id) = 'owner'
    or user_id = auth.uid()  -- users can remove themselves
  );

-- =============================================================
-- BUSINESS SETTINGS
-- =============================================================

create policy "settings: member read"
  on business_settings for select
  using (business_id in (select auth.user_business_ids()));

create policy "settings: owner/admin write"
  on business_settings for all
  using (
    auth.user_role_in_business(business_id) in ('owner', 'admin')
  );

-- =============================================================
-- CONTACTS
-- =============================================================

create policy "contacts: member read"
  on contacts for select
  using (business_id in (select auth.user_business_ids()));

create policy "contacts: writer insert"
  on contacts for insert
  with check (
    exists (
      select 1 from business_memberships m
      where m.business_id = contacts.business_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role in ('owner', 'admin', 'accountant', 'staff')
    )
  );

create policy "contacts: writer update"
  on contacts for update
  using (
    exists (
      select 1 from business_memberships m
      where m.business_id = contacts.business_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role in ('owner', 'admin', 'accountant', 'staff')
    )
  );

create policy "contacts: manager delete"
  on contacts for delete
  using (
    business_id in (select auth.user_business_ids())
    and auth.role_can_manage(business_id)
  );

-- =============================================================
-- ACCOUNTS
-- =============================================================

create policy "accounts: member read"
  on accounts for select
  using (business_id in (select auth.user_business_ids()));

create policy "accounts: manager write"
  on accounts for insert
  with check (
    business_id in (select auth.user_business_ids())
    and auth.role_can_manage(business_id)
  );

create policy "accounts: manager update"
  on accounts for update
  using (
    business_id in (select auth.user_business_ids())
    and auth.role_can_manage(business_id)
  );

create policy "accounts: owner delete"
  on accounts for delete
  using (
    auth.user_role_in_business(business_id) in ('owner', 'admin')
  );

-- =============================================================
-- INVOICES
-- =============================================================

create policy "invoices: member read"
  on invoices for select
  using (business_id in (select auth.user_business_ids()));

create policy "invoices: writer insert"
  on invoices for insert
  with check (
    business_id in (select auth.user_business_ids())
    and auth.role_can_write(business_id)
  );

create policy "invoices: writer update draft"
  on invoices for update
  using (
    business_id in (select auth.user_business_ids())
    and auth.role_can_write(business_id)
  );

create policy "invoices: manager delete"
  on invoices for delete
  using (
    business_id in (select auth.user_business_ids())
    and auth.role_can_manage(business_id)
  );

-- =============================================================
-- INVOICE ITEMS
-- =============================================================

create policy "invoice_items: member read"
  on invoice_items for select
  using (business_id in (select auth.user_business_ids()));

create policy "invoice_items: writer write"
  on invoice_items for insert
  with check (
    business_id in (select auth.user_business_ids())
    and auth.role_can_write(business_id)
  );

create policy "invoice_items: writer update"
  on invoice_items for update
  using (
    business_id in (select auth.user_business_ids())
    and auth.role_can_write(business_id)
  );

create policy "invoice_items: writer delete"
  on invoice_items for delete
  using (
    business_id in (select auth.user_business_ids())
    and auth.role_can_write(business_id)
  );

-- =============================================================
-- PAYMENTS
-- =============================================================

create policy "payments: member read"
  on payments for select
  using (business_id in (select auth.user_business_ids()));

create policy "payments: writer insert"
  on payments for insert
  with check (
    business_id in (select auth.user_business_ids())
    and auth.role_can_write(business_id)
  );

create policy "payments: manager update"
  on payments for update
  using (
    business_id in (select auth.user_business_ids())
    and auth.role_can_manage(business_id)
  );

create policy "payments: manager delete"
  on payments for delete
  using (
    business_id in (select auth.user_business_ids())
    and auth.role_can_manage(business_id)
  );

-- =============================================================
-- EXPENSES
-- =============================================================

create policy "expenses: member read"
  on expenses for select
  using (business_id in (select auth.user_business_ids()));

create policy "expenses: writer insert"
  on expenses for insert
  with check (
    business_id in (select auth.user_business_ids())
    and auth.role_can_write(business_id)
  );

create policy "expenses: writer update"
  on expenses for update
  using (
    business_id in (select auth.user_business_ids())
    and auth.role_can_write(business_id)
  );

create policy "expenses: manager delete"
  on expenses for delete
  using (
    business_id in (select auth.user_business_ids())
    and auth.role_can_manage(business_id)
  );

-- =============================================================
-- MONEY TRANSACTIONS (append-only from business perspective)
-- =============================================================

create policy "txn: member read"
  on money_transactions for select
  using (business_id in (select auth.user_business_ids()));

create policy "txn: writer insert"
  on money_transactions for insert
  with check (
    business_id in (select auth.user_business_ids())
    and auth.role_can_write(business_id)
  );

-- No update/delete for regular users — ledger is immutable

-- =============================================================
-- FX RATE SNAPSHOTS (public read, no user writes)
-- =============================================================

create policy "fx: public read"
  on fx_rate_snapshots for select
  using (true);

-- Only service role can insert (via API route)

-- =============================================================
-- PLATFORM ADMINS (service role only — no user policies)
-- Regular users cannot read this table
-- =============================================================

-- No policies — blocked for all authenticated users unless they are admin
-- The admin client uses service role key which bypasses RLS

-- =============================================================
-- ADMIN AUDIT LOGS (service role only)
-- =============================================================

-- No policies — admin client manages this

-- =============================================================
-- FILE ATTACHMENTS
-- =============================================================

create policy "attachments: member read"
  on file_attachments for select
  using (business_id in (select auth.user_business_ids()));

create policy "attachments: writer insert"
  on file_attachments for insert
  with check (
    business_id in (select auth.user_business_ids())
    and auth.role_can_write(business_id)
  );

create policy "attachments: manager delete"
  on file_attachments for delete
  using (
    business_id in (select auth.user_business_ids())
    and auth.role_can_manage(business_id)
  );

-- =============================================================
-- PUBLIC INVOICE VERIFICATION VIEW
-- Safe, minimal public read for verification page
-- No auth required — but only exposes safe fields
-- =============================================================

create or replace view public_invoice_verification with (security_invoker = true) as
  select
    i.verification_token,
    i.invoice_number,
    i.status,
    i.issue_date,
    i.due_date,
    i.total,
    i.currency,
    i.amount_paid,
    b.name        as business_name,
    b.logo_url    as business_logo_url,
    c.name        as customer_name
  from invoices i
  join businesses b on b.id = i.business_id
  left join contacts c on c.id = i.contact_id
  where i.status not in ('draft', 'cancelled');

-- Grant anonymous read on the view only
grant select on public_invoice_verification to anon;
