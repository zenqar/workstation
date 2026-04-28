-- =============================================================
-- Migration 037: Global Permission Helper Migration
-- Purpose: Point all RLS policies to the new public schema helpers
--          to avoid "permission denied for schema auth" errors.
-- =============================================================

-- 1. Update ACCOUNTS
drop policy if exists "accounts: read" on accounts;
drop policy if exists "accounts: manager insert" on accounts;
drop policy if exists "accounts: manager update" on accounts;
drop policy if exists "accounts: manage insert" on accounts;
drop policy if exists "accounts: manage update" on accounts;
drop policy if exists "accounts: manage delete" on accounts;
drop policy if exists "accounts: owner delete" on accounts;

create policy "accounts: read" on accounts for select using (public.user_role_in_business(business_id) is not null or public.is_platform_admin());
create policy "accounts: manage insert" on accounts for insert with check (public.role_can_manage(business_id));
create policy "accounts: manage update" on accounts for update using (public.role_can_manage(business_id));
create policy "accounts: manage delete" on accounts for delete using (public.role_can_manage(business_id));

-- 2. Update CONTACTS
drop policy if exists "contacts: read" on contacts;
drop policy if exists "contacts: writer insert" on contacts;
drop policy if exists "contacts: writer update" on contacts;
drop policy if exists "contacts: manage delete" on contacts;
drop policy if exists "contacts: member read" on contacts;
drop policy if exists "contacts: manager delete" on contacts;

create policy "contacts: read" on contacts for select using (public.user_role_in_business(business_id) is not null or public.is_platform_admin());
create policy "contacts: writer insert" on contacts for insert with check (public.role_can_write(business_id));
create policy "contacts: writer update" on contacts for update using (public.role_can_write(business_id));
create policy "contacts: manage delete" on contacts for delete using (public.role_can_manage(business_id));

-- 3. Update INVOICES
drop policy if exists "invoices: read" on invoices;
drop policy if exists "invoices: writer insert" on invoices;
drop policy if exists "invoices: writer update" on invoices;
drop policy if exists "invoices: manage delete" on invoices;
drop policy if exists "invoices: member read" on invoices;
drop policy if exists "invoices: writer update draft" on invoices;

create policy "invoices: read" on invoices for select using (public.user_role_in_business(business_id) is not null or public.is_platform_admin());
create policy "invoices: writer insert" on invoices for insert with check (public.role_can_write(business_id));
create policy "invoices: writer update" on invoices for update using (public.role_can_write(business_id));
create policy "invoices: manage delete" on invoices for delete using (public.role_can_manage(business_id));

-- 4. Update INVOICE ITEMS
drop policy if exists "items: read" on invoice_items;
drop policy if exists "items: writer insert" on invoice_items;
drop policy if exists "items: writer update" on invoice_items;
drop policy if exists "items: writer delete" on invoice_items;
drop policy if exists "invoice_items: member read" on invoice_items;
drop policy if exists "invoice_items: writer write" on invoice_items;
drop policy if exists "invoice_items: writer update" on invoice_items;
drop policy if exists "invoice_items: writer delete" on invoice_items;

create policy "items: read" on invoice_items for select using (public.user_role_in_business(business_id) is not null or public.is_platform_admin());
create policy "items: writer insert" on invoice_items for insert with check (public.role_can_write(business_id));
create policy "items: writer update" on invoice_items for update using (public.role_can_write(business_id));
create policy "items: writer delete" on invoice_items for delete using (public.role_can_write(business_id));

-- 5. Update EXPENSES
drop policy if exists "expenses: read" on expenses;
drop policy if exists "expenses: writer insert" on expenses;
drop policy if exists "expenses: writer update" on expenses;
drop policy if exists "expenses: manage delete" on expenses;
drop policy if exists "expenses: member read" on expenses;

create policy "expenses: read" on expenses for select using (public.user_role_in_business(business_id) is not null or public.is_platform_admin());
create policy "expenses: writer insert" on expenses for insert with check (public.role_can_write(business_id));
create policy "expenses: writer update" on expenses for update using (public.role_can_write(business_id));
create policy "expenses: manage delete" on expenses for delete using (public.role_can_manage(business_id));

-- 6. Update MONEY TRANSACTIONS
drop policy if exists "transactions: read" on money_transactions;
drop policy if exists "transactions: writer insert" on money_transactions;
drop policy if exists "txn: member read" on money_transactions;
drop policy if exists "txn: writer insert" on money_transactions;

create policy "transactions: read" on money_transactions for select using (public.user_role_in_business(business_id) is not null or public.is_platform_admin());
create policy "transactions: writer insert" on money_transactions for insert with check (public.role_can_write(business_id));

-- 7. Update PAYMENTS
drop policy if exists "payments: member read" on payments;
drop policy if exists "payments: writer insert" on payments;
drop policy if exists "payments: manager update" on payments;
drop policy if exists "payments: manager delete" on payments;

create policy "payments: read" on payments for select using (public.user_role_in_business(business_id) is not null or public.is_platform_admin());
create policy "payments: insert" on payments for insert with check (public.role_can_write(business_id));
create policy "payments: update" on payments for update using (public.role_can_manage(business_id));
create policy "payments: delete" on payments for delete using (public.role_can_manage(business_id));
