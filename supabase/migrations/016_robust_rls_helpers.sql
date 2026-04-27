-- =============================================================
-- Migration 016: Robust RLS Helpers (Public Schema)
-- Purpose: Ensures RLS helper functions exist in the public schema
--          to avoid issues with the restricted 'auth' schema.
--          Updates policies to use these public helpers.
-- =============================================================

-- 1. Define helpers in public schema
create or replace function public.user_business_ids()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select business_id
  from public.business_memberships
  where user_id = auth.uid()
    and status = 'active';
$$;

create or replace function public.user_role_in_business(p_business_id uuid)
returns public.user_role
language sql stable security definer
set search_path = public
as $$
  select role
  from public.business_memberships
  where user_id = auth.uid()
    and business_id = p_business_id
    and status = 'active'
  limit 1;
$$;

create or replace function public.role_can_write(p_business_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    public.user_role_in_business(p_business_id) in ('owner','admin','accountant','staff'),
    false
  );
$$;

create or replace function public.role_can_manage(p_business_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    public.user_role_in_business(p_business_id) in ('owner','admin','accountant'),
    false
  );
$$;

-- 2. Update policies to use public helpers
-- CONTACTS
drop policy if exists "contacts: read" on contacts;
drop policy if exists "contacts: writer insert" on contacts;
drop policy if exists "contacts: writer update" on contacts;
drop policy if exists "contacts: manage delete" on contacts;

create policy "contacts: read" on contacts for select using (public.user_role_in_business(business_id) is not null);
create policy "contacts: writer insert" on contacts for insert with check (public.role_can_write(business_id));
create policy "contacts: writer update" on contacts for update using (public.role_can_write(business_id));
create policy "contacts: manage delete" on contacts for delete using (public.role_can_manage(business_id));

-- ACCOUNTS
drop policy if exists "accounts: read" on accounts;
drop policy if exists "accounts: manage insert" on accounts;
drop policy if exists "accounts: manage update" on accounts;
drop policy if exists "accounts: manage delete" on accounts;

create policy "accounts: read" on accounts for select using (public.user_role_in_business(business_id) is not null);
create policy "accounts: manage insert" on accounts for insert with check (public.role_can_manage(business_id));
create policy "accounts: manage update" on accounts for update using (public.role_can_manage(business_id));
create policy "accounts: manage delete" on accounts for delete using (public.role_can_manage(business_id));

-- INVOICES
drop policy if exists "invoices: read" on invoices;
drop policy if exists "invoices: writer insert" on invoices;
drop policy if exists "invoices: writer update" on invoices;
drop policy if exists "invoices: manage delete" on invoices;

create policy "invoices: read" on invoices for select using (public.user_role_in_business(business_id) is not null);
create policy "invoices: writer insert" on invoices for insert with check (public.role_can_write(business_id));
create policy "invoices: writer update" on invoices for update using (public.role_can_write(business_id));
create policy "invoices: manage delete" on invoices for delete using (public.role_can_manage(business_id));

-- INVOICE ITEMS
drop policy if exists "items: read" on invoice_items;
drop policy if exists "items: writer insert" on invoice_items;
drop policy if exists "items: writer update" on invoice_items;
drop policy if exists "items: writer delete" on invoice_items;

create policy "items: read" on invoice_items for select using (public.user_role_in_business(business_id) is not null);
create policy "items: writer insert" on invoice_items for insert with check (public.role_can_write(business_id));
create policy "items: writer update" on invoice_items for update using (public.role_can_write(business_id));
create policy "items: writer delete" on invoice_items for delete using (public.role_can_write(business_id));

-- EXPENSES
drop policy if exists "expenses: read" on expenses;
drop policy if exists "expenses: writer insert" on expenses;
drop policy if exists "expenses: writer update" on expenses;
drop policy if exists "expenses: manage delete" on expenses;

create policy "expenses: read" on expenses for select using (public.user_role_in_business(business_id) is not null);
create policy "expenses: writer insert" on expenses for insert with check (public.role_can_write(business_id));
create policy "expenses: writer update" on expenses for update using (public.role_can_write(business_id));
create policy "expenses: manage delete" on expenses for delete using (public.role_can_manage(business_id));

-- MONEY TRANSACTIONS
drop policy if exists "transactions: read" on money_transactions;
drop policy if exists "transactions: writer insert" on money_transactions;

create policy "transactions: read" on money_transactions for select using (public.user_role_in_business(business_id) is not null);
create policy "transactions: writer insert" on money_transactions for insert with check (public.role_can_write(business_id));
