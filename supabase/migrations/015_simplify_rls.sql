-- =============================================================
-- Migration 015: Simplify RLS Policies (STABILIZED)
-- Purpose: Comprehensive fix for RLS issues. Adds SELECT policies
--          and uses security-definer helpers for all operations.
-- =============================================================

-- Enable RLS on all relevant tables (just in case)
alter table businesses enable row level security;
alter table business_memberships enable row level security;
alter table contacts enable row level security;
alter table accounts enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table expenses enable row level security;
alter table money_transactions enable row level security;

-- 1. BUSINESSES (Read access for members)
drop policy if exists "businesses: member read" on businesses;
create policy "businesses: member read" on businesses for select 
  using (auth.user_role_in_business(id) is not null);

-- 2. BUSINESS MEMBERSHIPS (Read own memberships)
drop policy if exists "memberships: read own" on business_memberships;
create policy "memberships: read own" on business_memberships for select 
  using (user_id = auth.uid());

-- 3. CONTACTS
drop policy if exists "contacts: read" on contacts;
drop policy if exists "contacts: writer insert" on contacts;
drop policy if exists "contacts: writer update" on contacts;
drop policy if exists "contacts: manage delete" on contacts;

create policy "contacts: read" on contacts for select using (auth.user_role_in_business(business_id) is not null);
create policy "contacts: writer insert" on contacts for insert with check (auth.role_can_write(business_id));
create policy "contacts: writer update" on contacts for update using (auth.role_can_write(business_id));
create policy "contacts: manage delete" on contacts for delete using (auth.role_can_manage(business_id));

-- 4. ACCOUNTS
drop policy if exists "accounts: read" on accounts;
drop policy if exists "accounts: manage insert" on accounts;
drop policy if exists "accounts: manage update" on accounts;
drop policy if exists "accounts: manage delete" on accounts;

create policy "accounts: read" on accounts for select using (auth.user_role_in_business(business_id) is not null);
create policy "accounts: manage insert" on accounts for insert with check (auth.role_can_manage(business_id));
create policy "accounts: manage update" on accounts for update using (auth.role_can_manage(business_id));
create policy "accounts: manage delete" on accounts for delete using (auth.role_can_manage(business_id));

-- 5. INVOICES
drop policy if exists "invoices: read" on invoices;
drop policy if exists "invoices: writer insert" on invoices;
drop policy if exists "invoices: writer update" on invoices;
drop policy if exists "invoices: manage delete" on invoices;

create policy "invoices: read" on invoices for select using (auth.user_role_in_business(business_id) is not null);
create policy "invoices: writer insert" on invoices for insert with check (auth.role_can_write(business_id));
create policy "invoices: writer update" on invoices for update using (auth.role_can_write(business_id));
create policy "invoices: manage delete" on invoices for delete using (auth.role_can_manage(business_id));

-- 6. INVOICE ITEMS
drop policy if exists "items: read" on invoice_items;
drop policy if exists "items: writer insert" on invoice_items;
drop policy if exists "items: writer update" on invoice_items;
drop policy if exists "items: writer delete" on invoice_items;

create policy "items: read" on invoice_items for select using (auth.user_role_in_business(business_id) is not null);
create policy "items: writer insert" on invoice_items for insert with check (auth.role_can_write(business_id));
create policy "items: writer update" on invoice_items for update using (auth.role_can_write(business_id));
create policy "items: writer delete" on invoice_items for delete using (auth.role_can_write(business_id));

-- 7. EXPENSES
drop policy if exists "expenses: read" on expenses;
drop policy if exists "expenses: writer insert" on expenses;
drop policy if exists "expenses: writer update" on expenses;
drop policy if exists "expenses: manage delete" on expenses;

create policy "expenses: read" on expenses for select using (auth.user_role_in_business(business_id) is not null);
create policy "expenses: writer insert" on expenses for insert with check (auth.role_can_write(business_id));
create policy "expenses: writer update" on expenses for update using (auth.role_can_write(business_id));
create policy "expenses: manage delete" on expenses for delete using (auth.role_can_manage(business_id));

-- 8. MONEY TRANSACTIONS
drop policy if exists "transactions: read" on money_transactions;
drop policy if exists "transactions: writer insert" on money_transactions;

create policy "transactions: read" on money_transactions for select using (auth.user_role_in_business(business_id) is not null);
create policy "transactions: writer insert" on money_transactions for insert with check (auth.role_can_write(business_id));
