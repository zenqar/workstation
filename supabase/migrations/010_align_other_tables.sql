-- =============================================================
-- Migration 010: Align contacts, accounts, expenses, payments
-- =============================================================

do $$
begin
  -- 1. Align contacts table
  if not exists (select 1 from information_schema.columns where table_name = 'contacts' and column_name = 'company_name') then
    alter table public.contacts add column company_name text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'contacts' and column_name = 'phone') then
    alter table public.contacts add column phone text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'contacts' and column_name = 'address') then
    alter table public.contacts add column address text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'contacts' and column_name = 'city') then
    alter table public.contacts add column city text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'contacts' and column_name = 'country') then
    alter table public.contacts add column country text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'contacts' and column_name = 'notes') then
    alter table public.contacts add column notes text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'contacts' and column_name = 'created_by') then
    alter table public.contacts add column created_by uuid references auth.users(id);
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'contacts' and column_name = 'created_at') then
    alter table public.contacts add column created_at timestamptz not null default now();
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'contacts' and column_name = 'updated_at') then
    alter table public.contacts add column updated_at timestamptz not null default now();
  end if;

  -- 2. Align accounts table
  if not exists (select 1 from information_schema.columns where table_name = 'accounts' and column_name = 'display_detail') then
    alter table public.accounts add column display_detail text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'accounts' and column_name = 'bank_name') then
    alter table public.accounts add column bank_name text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'accounts' and column_name = 'created_by') then
    alter table public.accounts add column created_by uuid references auth.users(id);
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'accounts' and column_name = 'created_at') then
    alter table public.accounts add column created_at timestamptz not null default now();
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'accounts' and column_name = 'updated_at') then
    alter table public.accounts add column updated_at timestamptz not null default now();
  end if;

  -- 3. Align invoice_items table
  if not exists (select 1 from information_schema.columns where table_name = 'invoice_items' and column_name = 'sort_order') then
    alter table public.invoice_items add column sort_order integer not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'invoice_items' and column_name = 'created_at') then
    alter table public.invoice_items add column created_at timestamptz not null default now();
  end if;

  -- 4. Align money_transactions table
  if not exists (select 1 from information_schema.columns where table_name = 'money_transactions' and column_name = 'reference_id') then
    alter table public.money_transactions add column reference_id uuid;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'money_transactions' and column_name = 'reference_table') then
    alter table public.money_transactions add column reference_table text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'money_transactions' and column_name = 'description') then
    alter table public.money_transactions add column description text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'money_transactions' and column_name = 'fx_rate_used') then
    alter table public.money_transactions add column fx_rate_used numeric(12,4);
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'money_transactions' and column_name = 'created_by') then
    alter table public.money_transactions add column created_by uuid references auth.users(id);
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'money_transactions' and column_name = 'created_at') then
    alter table public.money_transactions add column created_at timestamptz not null default now();
  end if;

  -- 5. Create expenses if it doesn't exist
  if not exists (select 1 from information_schema.tables where table_name = 'expenses') then
    create table public.expenses (
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
  end if;

  -- 6. Create payments if it doesn't exist
  if not exists (select 1 from information_schema.tables where table_name = 'payments') then
    create table public.payments (
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
  end if;

  -- 7. Create fx_rate_snapshots if it doesn't exist
  if not exists (select 1 from information_schema.tables where table_name = 'fx_rate_snapshots') then
    create table public.fx_rate_snapshots (
      id            uuid        primary key default uuid_generate_v4(),
      from_currency text        not null default 'USD',
      to_currency   text        not null default 'IQD',
      rate          numeric(12,4) not null,
      source        text        not null default 'manual',
      fetched_at    timestamptz not null default now()
    );
  end if;

end $$;
