-- =============================================================
-- Migration 015: Simplify RLS Policies
-- Purpose: Replaces complex manual exists checks with reliable 
--          security-definer helper functions to fix persistent 
--          "RLS violation" errors.
-- =============================================================

-- CONTACTS
drop policy if exists "contacts: writer insert" on contacts;
drop policy if exists "contacts: writer update" on contacts;
drop policy if exists "contacts: manage delete" on contacts;

create policy "contacts: writer insert" on contacts for insert with check (auth.role_can_write(business_id));
create policy "contacts: writer update" on contacts for update using (auth.role_can_write(business_id));
create policy "contacts: manage delete" on contacts for delete using (auth.role_can_manage(business_id));

-- ACCOUNTS
drop policy if exists "accounts: manage insert" on accounts;
drop policy if exists "accounts: manage update" on accounts;
drop policy if exists "accounts: manage delete" on accounts;

create policy "accounts: manage insert" on accounts for insert with check (auth.role_can_manage(business_id));
create policy "accounts: manage update" on accounts for update using (auth.role_can_manage(business_id));
create policy "accounts: manage delete" on accounts for delete using (auth.role_can_manage(business_id));

-- INVOICES
drop policy if exists "invoices: writer insert" on invoices;
drop policy if exists "invoices: writer update" on invoices;
drop policy if exists "invoices: manage delete" on invoices;

create policy "invoices: writer insert" on invoices for insert with check (auth.role_can_write(business_id));
create policy "invoices: writer update" on invoices for update using (auth.role_can_write(business_id));
create policy "invoices: manage delete" on invoices for delete using (auth.role_can_manage(business_id));

-- INVOICE ITEMS
drop policy if exists "items: writer insert" on invoice_items;
drop policy if exists "items: writer update" on invoice_items;
drop policy if exists "items: writer delete" on invoice_items;

create policy "items: writer insert" on invoice_items for insert with check (auth.role_can_write(business_id));
create policy "items: writer update" on invoice_items for update using (auth.role_can_write(business_id));
create policy "items: writer delete" on invoice_items for delete using (auth.role_can_write(business_id));

-- EXPENSES
drop policy if exists "expenses: writer insert" on expenses;
drop policy if exists "expenses: writer update" on expenses;
drop policy if exists "expenses: manage delete" on expenses;

create policy "expenses: writer insert" on expenses for insert with check (auth.role_can_write(business_id));
create policy "expenses: writer update" on expenses for update using (auth.role_can_write(business_id));
create policy "expenses: manage delete" on expenses for delete using (auth.role_can_manage(business_id));

-- MONEY TRANSACTIONS (Record only)
drop policy if exists "transactions: writer insert" on money_transactions;
create policy "transactions: writer insert" on money_transactions for insert with check (auth.role_can_write(business_id));
