-- =============================================================
-- Migration 001: Initial Schema
-- Zenqar — Bookkeeping & Invoicing SaaS
-- =============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =============================================================
-- ENUMS
-- =============================================================

create type user_role as enum (
  'owner',
  'admin',
  'accountant',
  'staff',
  'viewer'
);

create type contact_type as enum (
  'customer',
  'supplier',
  'both'
);

create type account_type as enum (
  'cash',
  'bank',
  'wallet',
  'other'
);

create type currency_code as enum (
  'IQD',
  'USD'
);

create type invoice_status as enum (
  'draft',
  'issued',
  'sent',
  'partially_paid',
  'paid',
  'overdue',
  'cancelled'
);

create type transaction_type as enum (
  'payment_received',
  'expense_paid',
  'transfer_in',
  'transfer_out',
  'opening_balance',
  'manual_adjustment',
  'owner_deposit',
  'owner_withdrawal'
);

create type membership_status as enum (
  'active',
  'pending',
  'suspended'
);

create type app_language as enum (
  'en',
  'ar',
  'ku'
);

-- =============================================================
-- PROFILES
-- Extended user data linked to Supabase auth.users
-- =============================================================

create table profiles (
  id                  uuid        primary key references auth.users(id) on delete cascade,
  full_name           text,
  email               text,
  avatar_url          text,
  preferred_language  app_language not null default 'en',
  phone               text,
  is_platform_admin   boolean     not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table profiles is 'Extended user profiles linked to Supabase Auth users';

-- =============================================================
-- BUSINESSES
-- Each business is an isolated tenant
-- =============================================================

create table businesses (
  id                  uuid        primary key default uuid_generate_v4(),
  name                text        not null,
  legal_name          text,
  logo_url            text,
  email               text,
  phone               text,
  website             text,
  address_line1       text,
  address_line2       text,
  city                text,
  country             text        not null default 'Iraq',
  tax_number          text,
  invoice_prefix      text        not null default 'ZQ',
  invoice_sequence    integer     not null default 0,
  default_currency    currency_code not null default 'IQD',
  default_language    app_language  not null default 'en',
  timezone            text        not null default 'Asia/Baghdad',
  is_active           boolean     not null default true,
  created_by          uuid        references auth.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table businesses is 'Tenant businesses — all data is scoped per business_id';
comment on column businesses.invoice_sequence is 'Auto-incremented invoice number counter. Use the get_next_invoice_number() function to increment atomically.';

-- =============================================================
-- BUSINESS MEMBERSHIPS
-- User ↔ Business M:M with role
-- =============================================================

create table business_memberships (
  id            uuid        primary key default uuid_generate_v4(),
  business_id   uuid        not null references businesses(id) on delete cascade,
  user_id       uuid        references auth.users(id) on delete cascade,
  email         text,       -- For pending invites where user hasn't signed up yet
  role          user_role   not null default 'viewer',
  status        membership_status not null default 'active',
  invited_by    uuid        references auth.users(id),
  invited_at    timestamptz,
  joined_at     timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique(business_id, user_id),
  constraint membership_user_or_email check (user_id is not null or email is not null)
);

comment on table business_memberships is 'Links users to businesses with roles. Pending invites have email but no user_id.';

create index idx_memberships_business_id on business_memberships(business_id);
create index idx_memberships_user_id     on business_memberships(user_id);
create index idx_memberships_email       on business_memberships(email);

-- =============================================================
-- BUSINESS SETTINGS
-- Per-business configuration
-- =============================================================

create table business_settings (
  id                        uuid        primary key default uuid_generate_v4(),
  business_id               uuid        not null unique references businesses(id) on delete cascade,
  invoice_due_days          integer     not null default 30,
  invoice_footer_note       text,
  invoice_tax_label         text        not null default 'Tax',
  invoice_tax_rate          numeric(5,2) not null default 0,
  show_tax_on_invoice       boolean     not null default false,
  show_discount_on_invoice  boolean     not null default true,
  payout_bank_name          text,
  payout_account_name       text,
  payout_account_number     text,      -- masked display only
  payout_iban               text,
  payout_swift              text,
  payout_notes              text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

comment on table business_settings is 'Invoice and payment display settings per business';

-- =============================================================
-- CONTACTS
-- Customers and suppliers per business
-- =============================================================

create table contacts (
  id            uuid        primary key default uuid_generate_v4(),
  business_id   uuid        not null references businesses(id) on delete cascade,
  type          contact_type not null default 'customer',
  name          text        not null,
  company_name  text,
  email         text,
  phone         text,
  address       text,
  city          text,
  country       text,
  notes         text,
  is_active     boolean     not null default true,
  created_by    uuid        references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table contacts is 'Customers and suppliers per business';
create index idx_contacts_business_id on contacts(business_id);
create index idx_contacts_type        on contacts(business_id, type);

-- =============================================================
-- ACCOUNTS
-- Money accounts per business (cash, bank, wallet, etc.)
-- =============================================================

create table accounts (
  id              uuid        primary key default uuid_generate_v4(),
  business_id     uuid        not null references businesses(id) on delete cascade,
  name            text        not null,
  account_type    account_type not null default 'cash',
  currency        currency_code not null default 'IQD',
  display_detail  text,       -- masked account number, wallet ID, etc.
  bank_name       text,
  is_active       boolean     not null default true,
  created_by      uuid        references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table accounts is 'Money accounts. Balance is derived from money_transactions, never stored here.';
create index idx_accounts_business_id on accounts(business_id);

-- =============================================================
-- INVOICES
-- =============================================================

create table invoices (
  id                uuid          primary key default uuid_generate_v4(),
  business_id       uuid          not null references businesses(id) on delete cascade,
  invoice_number    text          not null,
  contact_id        uuid          references contacts(id) on delete set null,
  status            invoice_status not null default 'draft',
  currency          currency_code  not null default 'IQD',
  issue_date        date          not null default current_date,
  due_date          date,
  payment_terms     text,

  -- Monetary fields (stored as numeric for precision)
  subtotal          numeric(18,3)  not null default 0,
  discount_amount   numeric(18,3)  not null default 0,
  discount_percent  numeric(5,2)   not null default 0,
  tax_amount        numeric(18,3)  not null default 0,
  tax_rate          numeric(5,2)   not null default 0,
  total             numeric(18,3)  not null default 0,
  amount_paid       numeric(18,3)  not null default 0,
  amount_due        numeric(18,3)  generated always as (total - amount_paid) stored,

  notes             text,
  internal_notes    text,

  -- Immutability snapshot once issued
  snapshot_json     jsonb,
  snapshot_taken_at timestamptz,

  -- QR / Verification
  verification_token text unique default encode(gen_random_bytes(24), 'hex'),

  created_by        uuid          references auth.users(id),
  issued_by         uuid          references auth.users(id),
  issued_at         timestamptz,
  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now(),

  unique(business_id, invoice_number)
);

comment on table invoices is 'Invoice headers. snapshot_json stores immutable copy of issued invoice data.';
create index idx_invoices_business_id    on invoices(business_id);
create index idx_invoices_status         on invoices(business_id, status);
create index idx_invoices_contact_id     on invoices(contact_id);
create index idx_invoices_due_date       on invoices(business_id, due_date);
create index idx_invoices_verification   on invoices(verification_token);

-- =============================================================
-- INVOICE ITEMS
-- Line items for invoices
-- =============================================================

create table invoice_items (
  id            uuid        primary key default uuid_generate_v4(),
  invoice_id    uuid        not null references invoices(id) on delete cascade,
  business_id   uuid        not null references businesses(id) on delete cascade,
  description   text        not null,
  quantity      numeric(12,3) not null default 1,
  unit_price    numeric(18,3) not null default 0,
  subtotal      numeric(18,3) generated always as (quantity * unit_price) stored,
  sort_order    integer     not null default 0,
  created_at    timestamptz not null default now()
);

comment on table invoice_items is 'Line items belonging to an invoice';
create index idx_invoice_items_invoice_id on invoice_items(invoice_id);

-- =============================================================
-- PAYMENTS
-- Payment events against invoices
-- =============================================================

create table payments (
  id                  uuid          primary key default uuid_generate_v4(),
  business_id         uuid          not null references businesses(id) on delete cascade,
  invoice_id          uuid          not null references invoices(id) on delete cascade,
  account_id          uuid          not null references accounts(id),
  amount              numeric(18,3) not null,
  currency            currency_code  not null,
  payment_date        date          not null default current_date,
  reference           text,
  note                text,
  created_by          uuid          references auth.users(id),
  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now()
);

comment on table payments is 'Payment events. Each payment creates a corresponding money_transaction.';
create index idx_payments_business_id  on payments(business_id);
create index idx_payments_invoice_id   on payments(invoice_id);
create index idx_payments_account_id   on payments(account_id);

-- =============================================================
-- EXPENSES
-- =============================================================

create table expenses (
  id              uuid          primary key default uuid_generate_v4(),
  business_id     uuid          not null references businesses(id) on delete cascade,
  account_id      uuid          not null references accounts(id),
  contact_id      uuid          references contacts(id) on delete set null,
  category        text          not null default 'General',
  description     text          not null,
  amount          numeric(18,3) not null,
  currency        currency_code  not null,
  expense_date    date          not null default current_date,
  note            text,
  receipt_url     text,
  created_by      uuid          references auth.users(id),
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

comment on table expenses is 'Expense records. Each expense creates a money_transaction debit.';
create index idx_expenses_business_id  on expenses(business_id);
create index idx_expenses_account_id   on expenses(account_id);
create index idx_expenses_date         on expenses(business_id, expense_date);

-- =============================================================
-- MONEY TRANSACTIONS
-- Unified ledger — all account movements
-- Account balance = SUM of amount where account_id = X
-- Positive = credit (money in), Negative = debit (money out)
-- =============================================================

create table money_transactions (
  id              uuid            primary key default uuid_generate_v4(),
  business_id     uuid            not null references businesses(id) on delete cascade,
  account_id      uuid            not null references accounts(id),
  type            transaction_type not null,
  amount          numeric(18,3)   not null, -- positive = in, negative = out
  currency        currency_code    not null,
  reference_id    uuid,           -- payment_id, expense_id, etc.
  reference_table text,           -- 'payments', 'expenses', etc.
  description     text,
  transaction_date date           not null default current_date,
  fx_rate_used    numeric(12,4),  -- FX rate at time of transaction (if cross-currency display)
  created_by      uuid            references auth.users(id),
  created_at      timestamptz     not null default now()
);

comment on table money_transactions is 'Immutable ledger of all account movements. Do NOT delete records. Account balance = SUM(amount) per account.';
create index idx_txn_business_id   on money_transactions(business_id);
create index idx_txn_account_id    on money_transactions(account_id);
create index idx_txn_date          on money_transactions(business_id, transaction_date);
create index idx_txn_reference     on money_transactions(reference_id);

-- =============================================================
-- FX RATE SNAPSHOTS
-- Historical exchange rate records
-- =============================================================

create table fx_rate_snapshots (
  id            uuid        primary key default uuid_generate_v4(),
  from_currency text        not null default 'USD',
  to_currency   text        not null default 'IQD',
  rate          numeric(12,4) not null,
  source        text        not null default 'manual', -- 'api', 'manual', 'mock'
  fetched_at    timestamptz not null default now()
);

comment on table fx_rate_snapshots is 'Historical FX rate records. Latest row is the current reference rate.';
create index idx_fx_fetched_at on fx_rate_snapshots(fetched_at desc);

-- =============================================================
-- PLATFORM ADMINS
-- Zenqar internal team members
-- =============================================================

create table platform_admins (
  id          uuid        primary key default uuid_generate_v4(),
  user_id     uuid        not null unique references auth.users(id) on delete cascade,
  added_by    uuid        references auth.users(id),
  notes       text,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table platform_admins is 'Zenqar internal platform administrators. Separate from tenant business roles.';

-- =============================================================
-- ADMIN AUDIT LOGS
-- Track all admin inspection/action events
-- =============================================================

create table admin_audit_logs (
  id            uuid        primary key default uuid_generate_v4(),
  admin_user_id uuid        not null references auth.users(id),
  action        text        not null,  -- e.g. 'VIEW_BUSINESS', 'SUSPEND_USER'
  target_type   text,                  -- 'business', 'user', 'invoice'
  target_id     uuid,
  metadata      jsonb,
  ip_address    text,
  user_agent    text,
  created_at    timestamptz not null default now()
);

comment on table admin_audit_logs is 'Immutable audit trail of all platform admin actions';
create index idx_audit_admin_user  on admin_audit_logs(admin_user_id);
create index idx_audit_created_at  on admin_audit_logs(created_at desc);
create index idx_audit_target      on admin_audit_logs(target_type, target_id);

-- =============================================================
-- FILE ATTACHMENTS
-- Logos, receipts, invoice PDFs
-- =============================================================

create table file_attachments (
  id            uuid        primary key default uuid_generate_v4(),
  business_id   uuid        not null references businesses(id) on delete cascade,
  bucket        text        not null,
  path          text        not null,
  mime_type     text,
  size_bytes    bigint,
  reference_id  uuid,
  reference_table text,
  created_by    uuid        references auth.users(id),
  created_at    timestamptz not null default now()
);

create index idx_attachments_business_id on file_attachments(business_id);
create index idx_attachments_reference   on file_attachments(reference_id);

-- =============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =============================================================

create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply updated_at trigger to relevant tables
create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at_column();

create trigger trg_businesses_updated_at
  before update on businesses
  for each row execute function update_updated_at_column();

create trigger trg_memberships_updated_at
  before update on business_memberships
  for each row execute function update_updated_at_column();

create trigger trg_business_settings_updated_at
  before update on business_settings
  for each row execute function update_updated_at_column();

create trigger trg_contacts_updated_at
  before update on contacts
  for each row execute function update_updated_at_column();

create trigger trg_accounts_updated_at
  before update on accounts
  for each row execute function update_updated_at_column();

create trigger trg_invoices_updated_at
  before update on invoices
  for each row execute function update_updated_at_column();

create trigger trg_payments_updated_at
  before update on payments
  for each row execute function update_updated_at_column();

create trigger trg_expenses_updated_at
  before update on expenses
  for each row execute function update_updated_at_column();

create trigger trg_platform_admins_updated_at
  before update on platform_admins
  for each row execute function update_updated_at_column();
